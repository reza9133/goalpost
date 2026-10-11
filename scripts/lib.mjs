// Shared helpers for the deploy and end-to-end scripts. Targets GenLayer Studionet with
// genlayer-js 1.x. Studionet is gasless, so no fee parameters are needed.

import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAccount, createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

import { DECIDED, executionFailure, phaseOf, statusNameOf } from './receipt.mjs';

export { parseArgs } from './args.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RPC_URL = (process.env.GOALPOST_RPC || 'https://studio.genlayer.com/api').trim();
export const CHAIN_ID = 61999;

const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function sha256Of(text) {
  return '0x' + createHash('sha256').update(text).digest('hex');
}

export function readText(relative) {
  return readFileSync(path.join(ROOT, relative), 'utf8');
}

/** The key from GOALPOST_PRIVATE_KEY, or a fresh throwaway key. Studionet accounts need no funds. */
export function loadKey() {
  const supplied = (process.env.GOALPOST_PRIVATE_KEY || '').trim();
  if (supplied) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(supplied)) throw new Error('GOALPOST_PRIVATE_KEY must be 0x followed by 64 hex characters.');
    return { key: supplied, generated: false };
  }
  for (;;) {
    const hex = randomBytes(32).toString('hex');
    const value = BigInt('0x' + hex);
    if (value > 0n && value < CURVE_ORDER) return { key: '0x' + hex, generated: true };
  }
}

function chainConfig() {
  return { ...studionet, rpcUrls: { ...(studionet.rpcUrls ?? {}), default: { http: [RPC_URL] } } };
}

export function makeClient(key) {
  const account = key ? createAccount(key) : undefined;
  return { client: createClient({ chain: chainConfig(), endpoint: RPC_URL, account }), account };
}

/** Poll until the transaction is decided or failed. Returns { transaction, statusName, failure }. */
export async function waitForDecision(client, hash, { timeoutMs = 10 * 60 * 1000, intervalMs = 3000, onStatus } = {}) {
  const started = Date.now();
  let last = null;
  let lastStatus = 'PENDING';
  let reported = '';
  for (;;) {
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${hash}.`);
    try {
      last = await client.getTransaction({ hash });
      lastStatus = statusNameOf(last);
      if (onStatus && lastStatus !== reported) {
        reported = lastStatus;
        onStatus(lastStatus);
      }
      const phase = phaseOf(lastStatus);
      if (phase === 'decided' || phase === 'failed') break;
    } catch (error) {
      if (Date.now() - started > 45_000) throw error;
    }
    await sleep(intervalMs);
  }
  const decided = DECIDED.has(lastStatus);
  const failure = decided
    ? executionFailure(last)
    : `The validators did not reach agreement (${lastStatus.toLowerCase().replace(/_/g, ' ')}). Nothing was written.`;
  return { transaction: last, statusName: lastStatus, failure };
}

/** Read a view method that returns JSON text. Retries transient errors. */
export async function readJson(client, address, functionName, args = []) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const raw = await client.readContract({
        address,
        functionName,
        args: args.map((value) => (typeof value === 'number' ? BigInt(value) : value)),
      });
      return JSON.parse(String(raw));
    } catch (error) {
      lastError = error;
      await sleep(800 * attempt);
    }
  }
  throw new Error(`Could not read ${functionName}: ${lastError instanceof Error ? lastError.message : lastError}`);
}

export async function send(client, address, functionName, args, label) {
  console.log(`  -> ${label}`);
  const hash = String(
    await client.writeContract({
      address,
      functionName,
      args: args.map((value) => (typeof value === 'number' ? BigInt(value) : value)),
      value: 0n,
    }),
  );
  console.log(`     submitted ${hash}`);
  const outcome = await waitForDecision(client, hash, { onStatus: (name) => console.log(`     status: ${name}`) });
  if (outcome.failure) throw new Error(`${label} failed: ${outcome.failure}`);
  return { hash, ...outcome };
}
