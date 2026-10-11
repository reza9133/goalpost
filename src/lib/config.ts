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
