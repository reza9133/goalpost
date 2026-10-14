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
  EXECUTION_REREADS,
  EXPLORER_URL,
  FAUCET_AMOUNT_WEI,
  FINALITY_POLL_INTERVAL_MS,
  FINALITY_TIMEOUT_MS,
  PUBLIC_RPC_URL,
  RPC_URL,
  TX_POLL_INTERVAL_MS,
  TX_TIMEOUT_MS,
} from './config';
import {
  executionOf,
  isDecision,
  phaseOf,
  settledAs,
  statusNameOf,
  type Execution,
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
  message?: string;
}

export interface TxOutcome {
  /**
   * True only when the validators accepted the transaction AND the transaction carries an explicit
   * successful execution result. An accepted transaction whose contract call raised an error, or
   * whose result cannot be read, is not ok.
   */
  ok: boolean;
  hash: string;
  statusName: string;
  /** 'accepted' can still be appealed; 'finalized' cannot change. Null when the call did not succeed. */
  finality: 'accepted' | 'finalized' | null;
  /** What running the contract call produced, read from the transaction itself. */
  execution: Execution['state'];
  /** Human-readable reason when the call did not complete. */
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
  let rereads = 0;
  for (;;) {
    if (signal?.aborted) throw new Error('Stopped watching this transaction. It may still complete on the network.');
    if (Date.now() - started > TX_TIMEOUT_MS) {
      throw new Error('The network has not decided this transaction yet. It may still complete; check the explorer.');
    }
    try {
      lastTransaction = await readClient().getTransaction({ hash: hash as Hex });
      lastStatus = statusNameOf(lastTransaction);
      const phase = phaseOf(lastStatus);
      if (isDecision(phase) && phase !== 'failed' && executionOf(lastTransaction).state === 'unknown' && rereads < EXECUTION_REREADS) {
        // The status can move before the execution result is attached to the transaction. Read it again
        // instead of guessing, and keep the panel in the consensus step meanwhile.
        rereads += 1;
        onUpdate({ phase: 'consensus', hash, statusName: lastStatus });
      } else if (isDecision(phase)) {
        // Do not announce a decision yet: whether it counts as completed depends on the execution result.
        break;
      } else {
        onUpdate({ phase, hash, statusName: lastStatus });
      }
    } catch (error) {
      // The transaction may not be indexed for a moment after submission. Keep polling unless it persists.
      if (Date.now() - started > 45_000 && !TRANSIENT.test(messageOf(error))) {
        throw new Error(`Could not follow the transaction: ${messageOf(error)}`);
      }
    }
    await sleep(TX_POLL_INTERVAL_MS);
  }

  const outcome = outcomeOf(hash, lastStatus, lastTransaction);
  onUpdate({
    phase: outcome.ok ? (outcome.finality ?? 'accepted') : 'failed',
    hash,
    statusName: lastStatus,
    message: outcome.failure ?? undefined,
  });
  return outcome;
}

/**
 * Turn a decided (or failed) transaction into the one thing the UI may show. Completion needs two
 * separate facts: the validators decided (ACCEPTED or FINALIZED) and the contract call itself ran
 * successfully. The second is never assumed.
 */
export function outcomeOf(hash: string, statusName: string, transaction: unknown): TxOutcome {
  const phase = phaseOf(statusName);
  if (phase === 'failed' || !isDecision(phase)) {
    return {
      ok: false,
      hash,
      statusName,
      finality: null,
      execution: 'unknown',
      failure: `The validators did not reach agreement (${statusName.toLowerCase().replace(/_/g, ' ')}). Nothing was written. Try again.`,
      receipt: transaction,
    };
  }
  const execution = executionOf(transaction);
  const finality = settledAs(statusName, execution);
  let failure: string | null = null;
  if (execution.state === 'failed') failure = execution.message;
  else if (execution.state === 'unknown') {
    failure =
      'The network decided this transaction, but its execution result could not be read, so it is not reported as completed. Open it in the explorer to check.';
  }
  return { ok: finality !== null, hash, statusName, finality, execution: execution.state, failure, receipt: transaction };
}

/**
 * Keep reading an ACCEPTED transaction until it is FINALIZED. Updates are only informational: the
 * transaction was already reported as accepted. A transaction that stops being accepted (for
 * example because an appeal overturned it) is reported as failed.
 */
export async function watchFinality(
  hash: string,
  onUpdate: (update: TxUpdate) => void,
  signal?: AbortSignal,
): Promise<void> {
  const started = Date.now();
  for (;;) {
    await sleep(FINALITY_POLL_INTERVAL_MS);
    if (signal?.aborted || Date.now() - started > FINALITY_TIMEOUT_MS) return;
    try {
      const transaction = await readClient().getTransaction({ hash: hash as Hex });
      const statusName = statusNameOf(transaction);
      const phase = phaseOf(statusName);
      if (phase === 'finalized') {
        const outcome = outcomeOf(hash, statusName, transaction);
        onUpdate(
          outcome.ok
            ? { phase: 'finalized', hash, statusName }
            : { phase: 'failed', hash, statusName, message: outcome.failure ?? undefined },
        );
        return;
      }
      if (phase === 'failed') {
        onUpdate({
          phase: 'failed',
          hash,
          statusName,
          message: `This transaction was accepted earlier but is now ${statusName.toLowerCase().replace(/_/g, ' ')}. Treat its result as not recorded.`,
        });
        return;
      }
      // Still accepted, or reopened for an appeal. Either way it is not final.
      onUpdate({ phase: 'accepted', hash, statusName });
    } catch {
      // A missed poll changes nothing; the next one will read it.
    }
  }
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

// ------------------------------------------------------------------------------ test tokens

async function rpcCall(endpoint: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || 'RPC error');
  return body.result;
}

/** Balance of an address in wei. Read through the app RPC (the proxy allows eth_ methods). */
export async function getBalanceWei(address: string): Promise<bigint> {
  const result = await rpcCall(RPC_URL, 'eth_getBalance', [address, 'latest']);
  return typeof result === 'string' ? BigInt(result) : 0n;
}

export type FaucetResult = { ok: true } | { ok: false; reason: string };

/**
 * Ask Studionet to credit test GEN to an address. This uses the Studio-only `sim_fundAccount`
 * method. It goes to the public RPC directly, never through the same-origin proxy, which refuses
 * every `sim_` method on purpose. The tokens are worthless test funds on a resettable network.
 */
export async function requestTestTokens(address: string): Promise<FaucetResult> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return { ok: false, reason: 'That is not a valid address.' };
  try {
    await rpcCall(PUBLIC_RPC_URL, 'sim_fundAccount', [address, FAUCET_AMOUNT_WEI]);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      reason: `The faucet did not answer (${messageOf(cause)}). Open studio.genlayer.com, use its faucet for ${address}, then come back.`,
    };
  }
}
