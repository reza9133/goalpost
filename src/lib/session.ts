// A browser-local session key for Studionet. Studionet is a free test network and accounts
// need no funds, so a throwaway key removes the wallet requirement for anyone who just wants
// to try the contract. The key never leaves this browser and can be exported or erased.

const KEY_STORAGE = 'goalpost.session-key.v1';
const MODE_STORAGE = 'goalpost.identity-mode.v1';

// secp256k1 group order. A valid private key is in [1, n - 1].
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

export type IdentityMode = 'session' | 'wallet';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function randomKey(): `0x${string}` {
  for (;;) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const value = BigInt('0x' + hex);
    if (value > 0n && value < CURVE_ORDER) return `0x${hex}`;
  }
}

export function isValidPrivateKey(value: string): value is `0x${string}` {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) return false;
  const number = BigInt(value);
  return number > 0n && number < CURVE_ORDER;
}

export function loadSessionKey(): `0x${string}` | null {
  const value = storage()?.getItem(KEY_STORAGE) ?? null;
  return value !== null && isValidPrivateKey(value) ? value : null;
}

export function createSessionKey(): `0x${string}` {
  const key = randomKey();
  storage()?.setItem(KEY_STORAGE, key);
  return key;
}

export function forgetSessionKey(): void {
  storage()?.removeItem(KEY_STORAGE);
}

export function savedMode(): IdentityMode | null {
  const value = storage()?.getItem(MODE_STORAGE);
  return value === 'session' || value === 'wallet' ? value : null;
}

export function saveMode(mode: IdentityMode | null): void {
  const store = storage();
  if (!store) return;
  if (mode === null) store.removeItem(MODE_STORAGE);
  else store.setItem(MODE_STORAGE, mode);
}
