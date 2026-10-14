// Runtime configuration, read from Vite environment variables at build time.

const env = import.meta.env;

function absoluteUrl(value: string): string {
  if (value.startsWith('/') && typeof window !== 'undefined') {
    return window.location.origin + value;
  }
  return value;
}

export const CHAIN_ID = 61999;
export const CHAIN_NAME = 'GenLayer Studionet';

/** Canonical public RPC. Wallets are always pointed here, never at a same-origin proxy. */
export const PUBLIC_RPC_URL = 'https://studio.genlayer.com/api';

/** RPC used by the app for reads and session-key writes. May be the same-origin proxy. */
export const RPC_URL = absoluteUrl((env.VITE_RPC_URL ?? PUBLIC_RPC_URL).trim() || PUBLIC_RPC_URL);

export const EXPLORER_URL = (env.VITE_EXPLORER_URL ?? 'https://explorer-studio.genlayer.com').trim().replace(/\/+$/, '');

export const CONTRACT_ADDRESS = (env.VITE_CONTRACT_ADDRESS ?? '').trim();
export const IS_CONFIGURED = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS);

export const explorerTx = (hash: string): string => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (address: string): string => `${EXPLORER_URL}/address/${address}`;

/** Approximate polling budget for one transaction to reach a decision. */
export const TX_POLL_INTERVAL_MS = 3000;
export const TX_TIMEOUT_MS = 8 * 60 * 1000;

/**
 * After a transaction is ACCEPTED the console keeps watching it until it is FINALIZED. Accepted
 * results can still be appealed, so the console never calls them final.
 */
export const FINALITY_POLL_INTERVAL_MS = 15_000;
export const FINALITY_TIMEOUT_MS = 45 * 60 * 1000;
/** A decided transaction whose execution result is not readable yet is re-read this many times before it is refused. */
export const EXECUTION_REREADS = 10;

/** Public links shown in the console. */
export const GITHUB_URL = 'https://github.com/reza9133/goalpost';

/** Test GEN handed out by the faucet button, in wei (100 GEN). 1e20 is exact as a JSON number. */
export const FAUCET_AMOUNT_WEI = 1e20;
export const FAUCET_AMOUNT_LABEL = '100 GEN';
