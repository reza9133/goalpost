import { useCallback, useEffect, useRef, useState } from 'react';

import { getBalanceWei, requestTestTokens } from '../lib/chain';
import { FAUCET_AMOUNT_LABEL, explorerAddress } from '../lib/config';
import { formatGen, shortHex } from '../lib/format';
import { useIdentity } from '../lib/identity';
import { CopyButton, ExtLink } from './Bits';

export function IdentityMenu() {
  const { signer, hasWallet, busy, error, createSession, connectWallet, disconnect, forgetSession, exportSessionKey } = useIdentity();
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);
  const [fundingNote, setFundingNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const address = signer?.address ?? null;

  const refreshBalance = useCallback(async (target: string): Promise<void> => {
    try {
      setBalance(formatGen(await getBalanceWei(target)));
    } catch {
      setBalance(null);
    }
  }, []);

  useEffect(() => {
    setFundingNote(null);
    if (open && address !== null) void refreshBalance(address);
    else setBalance(null);
  }, [open, address, refreshBalance]);

  const getTestTokens = async (): Promise<void> => {
    if (address === null) return;
    setFunding(true);
    setFundingNote(null);
    const result = await requestTestTokens(address);
    if (result.ok) {
      setFundingNote({ tone: 'ok', text: `${FAUCET_AMOUNT_LABEL} of test GEN requested.` });
      await refreshBalance(address);
    } else {
      setFundingNote({ tone: 'bad', text: result.reason });
    }
    setFunding(false);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent): void => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setRevealed(null);
  }, [open]);

  return (
    <div className="identity" ref={root}>
      <button
        type="button"
        className={signer ? 'btn btn--small' : 'btn btn--primary btn--small'}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
      >
        {signer ? (
          <>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: signer.kind === 'session' ? 'var(--revised)' : 'var(--held)',
                boxShadow: signer.kind === 'session' ? '0 0 6px var(--revised)' : '0 0 6px var(--held)',
              }}
              aria-hidden="true"
            />
            <span>{signer.kind === 'session' ? 'Session' : 'Wallet'}</span>
            <span className="mono" style={{ opacity: 0.85 }}>{shortHex(signer.address, 4, 3)}</span>
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 8.68 10.05 8 8 8c-2.05 0-3.515.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z" />
            </svg>
            <span>Choose identity</span>
          </>
        )}
      </button>

      {open && (
        <div className="identity__menu" role="dialog" aria-label="Identity">
          {!signer && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🔑</span>
                <strong style={{ fontSize: '0.95rem' }}>Network Identity</strong>
              </div>
              <p className="identity__text">
                You need an identity to submit pledges, reports and evaluations. Reading the ledger never requires one.
              </p>
              <button type="button" className="btn btn--primary" onClick={createSession} style={{ justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M7.5 1v7h-7v1h7v7h1v-7h7v-1h-7v-7h-1z" />
                </svg>
                Create a session key
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void connectWallet()}
                disabled={!hasWallet || busy}
                style={{ justifyContent: 'center' }}
              >
                {hasWallet ? '🦊 Connect browser wallet' : 'No wallet detected'}
              </button>
            </>
          )}

          {signer && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="identity__label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: signer.kind === 'session' ? 'var(--revised)' : 'var(--held)',
                    }}
                  />
                  {signer.kind === 'session' ? 'Local Session Key' : 'Connected Browser Wallet'}
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    background: 'var(--sunken)',
                    color: 'var(--ink-2)',
                    fontWeight: 600,
                  }}
                >
                  Studionet
                </span>
              </div>

              <div
                style={{
                  background: 'rgba(var(--ink-rgb), 0.03)',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                }}
              >
                <p className="identity__address" style={{ marginBottom: '0.4rem' }}>
                  <code style={{ fontSize: '0.82rem' }}>{signer.address}</code>
                </p>
                <div className="row" style={{ gap: '0.4rem' }}>
                  <CopyButton value={signer.address} label="Copy address" />
                  <ExtLink href={explorerAddress(signer.address)}>
                    <span style={{ fontSize: '0.82rem' }}>View on explorer ↗</span>
                  </ExtLink>
                </div>
              </div>

              <div className="identity__faucet">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="identity__text" style={{ fontSize: '0.84rem' }}>Balance</span>
                  <strong className="mono" style={{ fontSize: '0.92rem' }}>
                    {balance === null ? '…' : `${balance} GEN`}
                  </strong>
                </div>
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => void getTestTokens()}
                  disabled={funding}
                  style={{ justifyContent: 'center' }}
                >
                  {funding ? 'Requesting test GEN…' : `Get ${FAUCET_AMOUNT_LABEL} of test tokens`}
                </button>
                {fundingNote && (
                  <p className={fundingNote.tone === 'ok' ? 'identity__text' : 'field__error'} role="status" style={{ fontSize: '0.8rem' }}>
                    {fundingNote.text}
                  </p>
                )}
              </div>

              {signer.kind === 'session' ? (
                <>
                  <p className="identity__text" style={{ fontSize: '0.8rem', lineHeight: '1.45', opacity: 0.9 }}>
                    This key lives only in this browser storage. Export the private key to reuse this identity elsewhere.
                  </p>
                  {revealed === null ? (
                    <button
                      type="button"
                      className="btn btn--small btn--quiet"
                      onClick={() => setRevealed(exportSessionKey() ?? '')}
                      style={{ border: '1px dashed var(--line-strong)', justifyContent: 'center' }}
                    >
                      👁 Reveal private key
                    </button>
                  ) : (
                    <>
                      <input
                        className="input mono"
                        readOnly
                        value={revealed}
                        onFocus={(event) => event.currentTarget.select()}
                        aria-label="Private key"
                        style={{ fontSize: '0.78rem' }}
                      />
                      <p className="identity__text" style={{ fontSize: '0.75rem', color: 'var(--moved)' }}>
                        Anyone with this key can sign as you. Keep it safe.
                      </p>
                    </>
                  )}
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: '0.25rem' }}>
                    <button type="button" className="btn btn--danger btn--small" onClick={forgetSession}>
                      Forget key
                    </button>
                    {hasWallet && (
                      <button type="button" className="btn btn--small" onClick={() => void connectWallet()} disabled={busy}>
                        Switch to wallet
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <button type="button" className="btn btn--small btn--danger" onClick={disconnect} style={{ justifyContent: 'center' }}>
                  Disconnect wallet
                </button>
              )}
            </>
          )}
          {error && <p className="field__error">{error}</p>}
        </div>
      )}
    </div>
  );
}
