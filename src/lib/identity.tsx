import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { addressOfSessionKey, existingWalletAccount, requestWalletAccount, type Signer } from './chain';
import { createSessionKey, forgetSessionKey, loadSessionKey, saveMode, savedMode } from './session';

interface IdentityValue {
  signer: Signer | null;
  hasWallet: boolean;
  busy: boolean;
  error: string | null;
  createSession: () => void;
  connectWallet: () => Promise<void>;
  disconnect: () => void;
  forgetSession: () => void;
  exportSessionKey: () => string | null;
}

const IdentityContext = createContext<IdentityValue | null>(null);

function sessionSigner(): Signer | null {
  const key = loadSessionKey();
  if (key === null) return null;
  try {
    return { kind: 'session', address: addressOfSessionKey(key) };
  } catch {
    return null;
  }
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [signer, setSigner] = useState<Signer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasWallet = typeof window !== 'undefined' && Boolean(window.ethereum);

  // Resume the previous identity without prompting.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (savedMode() === 'wallet') {
        const account = await existingWalletAccount();
        if (!cancelled && account) {
          setSigner({ kind: 'wallet', address: account });
          return;
        }
      }
      const session = sessionSigner();
      if (!cancelled && session) setSigner(session);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Follow account switches made inside the wallet.
  useEffect(() => {
    const provider = window.ethereum;
    if (!provider?.on) return undefined;
    const handler = (...args: unknown[]): void => {
      const accounts = args[0];
      setSigner((current) => {
        if (current?.kind !== 'wallet') return current;
        if (Array.isArray(accounts) && typeof accounts[0] === 'string') return { kind: 'wallet', address: accounts[0] };
        return sessionSigner();
      });
    };
    provider.on('accountsChanged', handler);
    return () => provider.removeListener?.('accountsChanged', handler);
  }, []);

  const createSession = useCallback(() => {
    setError(null);
    try {
      createSessionKey();
      saveMode('session');
      setSigner(sessionSigner());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const address = await requestWalletAccount();
      saveMode('wallet');
      setSigner({ kind: 'wallet', address });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(/rejected|denied|4001/i.test(message) ? 'The wallet request was declined.' : message);
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    saveMode(null);
    setSigner(null);
  }, []);

  const forgetSession = useCallback(() => {
    forgetSessionKey();
    saveMode(null);
    setSigner(null);
  }, []);

  const exportSessionKey = useCallback(() => loadSessionKey(), []);

  const value = useMemo<IdentityValue>(
    () => ({ signer, hasWallet, busy, error, createSession, connectWallet, disconnect, forgetSession, exportSessionKey }),
    [signer, hasWallet, busy, error, createSession, connectWallet, disconnect, forgetSession, exportSessionKey],
  );
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useIdentity(): IdentityValue {
  const value = useContext(IdentityContext);
  if (value === null) throw new Error('useIdentity must be used inside IdentityProvider');
  return value;
}
