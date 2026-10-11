// The only module that talks to genlayer-js. Everything the rest of the app needs from the
// network goes through the functions exported here.
//
// genlayer-js 1.x is viem-style. Two facts about Studionet shape this file:
//   * Studionet is gasless, so writes carry no fee parameters.
//   * The public RPC rate-limits contract reads per address, so reads are cached for a few
//     seconds, de-duplicated while in flight, and retried with backoff on transient errors.

import { createAccount, createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

import {
  CHAIN_ID,
  CHAIN_NAME,
  CONTRACT_ADDRESS,
  EXPLORER_URL,
  PUBLIC_RPC_URL,
  RPC_URL,
  TX_POLL_INTERVAL_MS,
  TX_TIMEOUT_MS,
} from './config';
import {
  DECIDED,
  executionFailure,
  phaseOf,
  statusNameOf,
  type Phase,
} from './receipt';
import { loadSessionKey } from './session';

type Hex = `0x${string}`;
export type CallArg = string | number;

export interface Call {
  functionName: string;
  args: CallArg[];
}

interface GenLayerClientLike {
  readContract(args: { address: Hex; functionName: string; args?: unknown[] }): Promise<unknown>;
  writeContract(args: { address: Hex; functionName: string; args?: unknown[]; value?: bigint }): Promise<unknown>;
  getTransaction(args: { hash: Hex }): Promise<unknown>;
}

export interface Signer {
  kind: 'session' | 'wallet';
  address: string;
}

export interface TxUpdate {
  phase: Phase;
  hash?: string;
  statusName?: string;
}

export interface TxOutcome {
  ok: boolean;
  hash: string;
  statusName: string;
  /** Human-readable reason when the transaction was decided but the contract rejected the call. */
  failure: string | null;
  /** Raw receipt. Only used to extract ids and diagnostics. */
  receipt: unknown;
}

// ------------------------------------------------------------------------------ clients

function chainConfig(): never {
  const base = studionet as unknown as { rpcUrls?: Record<string, unknown> };
  return {
    ...studionet,
    rpcUrls: { ...(base.rpcUrls ?? {}), default: { http: [RPC_URL] } },
  } as never;
}

let cachedReadClient: GenLayerClientLike | null = null;

function readClient(): GenLayerClientLike {
  if (cachedReadClient === null) {
    cachedReadClient = createClient({ chain: chainConfig(), endpoint: RPC_URL } as never) as unknown as GenLayerClientLike;
  }
  return cachedReadClient;
}

function writeClient(signer: Signer): GenLayerClientLike {
  if (signer.kind === 'session') {
    const key = loadSessionKey();
    if (key === null) throw new Error('The session key is missing from this browser. Create a new one from the identity menu.');
    return createClient({
      chain: chainConfig(),
      endpoint: RPC_URL,
      account: createAccount(key),
    } as never) as unknown as GenLayerClientLike;
  }
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No browser wallet was found.');
  }
  return createClient({
    chain: chainConfig(),
    endpoint: RPC_URL,
    account: signer.address as Hex,
    provider: window.ethereum,
  } as never) as unknown as GenLayerClientLike;
}

export function addressOfSessionKey(key: Hex): string {
  return String((createAccount(key) as unknown as { address: string }).address);
}

// -------------------------------------------------------------------------------- utils

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

const TRANSIENT = /busy|rate|too many|timeout|timed out|fetch|network|econn|429|502|503|504|slot|load failed/i;

function toCalldataArg(value: CallArg): unknown {
  return typeof value === 'number' ? BigInt(value) : value;
}

// ----------------------------------------------------------------------------- reading

const READ_TTL_MS = 4000;
const readCache = new Map<string, { at: number; value: string }>();
const readInflight = new Map<string, Promise<string>>();

export function invalidateReads(): void {
  readCache.clear();
}

export async function readString(functionName: string, args: CallArg[] = [], ttlMs = READ_TTL_MS): Promise<string> {
  if (!CONTRACT_ADDRESS) throw new Error('The contract address is not configured.');
  const key = `${functionName}:${JSON.stringify(args)}`;
  const hit = readCache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const running = readInflight.get(key);
  if (running) return running;

  const task = (async () => {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        const raw = await readClient().readContract({
          address: CONTRACT_ADDRESS as Hex,
          functionName,
          args: args.map(toCalldataArg),
        });
        const text = typeof raw === 'string' ? raw : raw === null || raw === undefined ? '' : String(raw);
        readCache.set(key, { at: Date.now(), value: text });
        return text;
      } catch (error) {
        lastError = error;
        if (!TRANSIENT.test(messageOf(error)) || attempt === 4) break;
        await sleep(700 * attempt + Math.floor(Math.random() * 250));
      }
    }
    throw new Error(`Could not read ${functionName} from the network: ${messageOf(lastError)}`);
  })();

  readInflight.set(key, task);
  try {
    return await task;
  } finally {
    readInflight.delete(key);
  }
}

export async function readJson<T>(functionName: string, args: CallArg[] = [], ttlMs = READ_TTL_MS): Promise<T> {
  const text = await readString(functionName, args, ttlMs);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`The contract returned something that is not JSON for ${functionName}.`);
  }
}

// ------------------------------------------------------------------------------ writing

export async function sendTransaction(
  signer: Signer,
  call: Call,
  onUpdate: (update: TxUpdate) => void,
  signal?: AbortSignal,
): Promise<TxOutcome> {
  if (!CONTRACT_ADDRESS) throw new Error('The contract address is not configured.');
  onUpdate({ phase: 'signing' });

  let hash: string;
  try {
    const client = writeClient(signer);
    hash = String(
      await client.writeContract({
        address: CONTRACT_ADDRESS as Hex,
        functionName: call.functionName,
        args: call.args.map(toCalldataArg),
        value: 0n,
      }),
    );
  } catch (error) {
    throw new Error(friendlyWriteError(error));
  }
  onUpdate({ phase: 'submitted', hash });

  const started = Date.now();
  let lastTransaction: unknown = null;
  let lastStatus = 'PENDING';
  for (;;) {
    if (signal?.aborted) throw new Error('Stopped watching this transaction. It may still complete on the network.');
    if (Date.now() - started > TX_TIMEOUT_MS) {
      throw new Error('The network has not decided this transaction yet. It may still complete; check the explorer.');
    }
    try {
      lastTransaction = await readClient().getTransaction({ hash: hash as Hex });
      lastStatus = statusNameOf(lastTransaction);
      const phase = phaseOf(lastStatus);
      onUpdate({ phase, hash, statusName: lastStatus });
      if (phase === 'decided' || phase === 'failed') break;
    } catch (error) {
      // The transaction may not be indexed for a moment after submission. Keep polling unless it persists.
      if (Date.now() - started > 45_000 && !TRANSIENT.test(messageOf(error))) {
        throw new Error(`Could not follow the transaction: ${messageOf(error)}`);
      }
    }
    await sleep(TX_POLL_INTERVAL_MS);
  }

  const decided = DECIDED.has(lastStatus);
  const failure = decided
    ? executionFailure(lastTransaction)
    : `The validators did not reach agreement (${lastStatus.toLowerCase().replace(/_/g, ' ')}). Nothing was written. Try again.`;
  const outcome: TxOutcome = { ok: decided && failure === null, hash, statusName: lastStatus, failure, receipt: lastTransaction };
  onUpdate({ phase: outcome.ok ? 'decided' : 'failed', hash, statusName: lastStatus });
  return outcome;
}

function friendlyWriteError(error: unknown): string {
  const text = messageOf(error);
  if (/user rejected|user denied|rejected the request|4001/i.test(text)) return 'The signature request was declined.';
  if (/no browser wallet/i.test(text)) return text;
  return `Could not submit the transaction: ${text.length > 240 ? `${text.slice(0, 237)}...` : text}`;
}

// ---------------------------------------------------------------------------- wallets

export async function requestWalletAccount(): Promise<string> {
  const provider = window.ethereum;
  if (!provider) throw new Error('No browser wallet was found. Install one, or use a session key instead.');
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  if (!Array.isArray(accounts) || accounts.length === 0) throw new Error('The wallet did not share an account.');
  await ensureWalletChain(provider);
  return accounts[0];
}

export async function existingWalletAccount(): Promise<string | null> {
  const provider = window.ethereum;
  if (!provider) return null;
  try {
    const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
    return Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : null;
  } catch {
    return null;
  }
}

export async function ensureWalletChain(provider: EthereumProvider): Promise<void> {
  const chainId = `0x${CHAIN_ID.toString(16)}`;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
  } catch (error) {
    const code = (error as { code?: number } | null)?.code;
    if (code !== 4902 && !/unrecognized|not added|unknown chain/i.test(messageOf(error))) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId,
          chainName: CHAIN_NAME,
          nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
          rpcUrls: [PUBLIC_RPC_URL],
          blockExplorerUrls: [EXPLORER_URL],
        },
      ],
    });
  }
}
