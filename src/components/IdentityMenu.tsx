import { useEffect, useRef, useState } from 'react';

import { explorerAddress } from '../lib/config';
import { shortHex } from '../lib/format';
import { useIdentity } from '../lib/identity';
import { CopyButton, ExtLink } from './Bits';

export function IdentityMenu() {
  const { signer, hasWallet, busy, error, createSession, connectWallet, disconnect, forgetSession, exportSessionKey } = useIdentity();
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const root = useRef<HTMLDivElement | null>(null);

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

  const label = signer
    ? `${signer.kind === 'session' ? 'Session key' : 'Wallet'} ${shortHex(signer.address, 6, 4)}`
    : 'Choose identity';

  return (
    <div className="identity" ref={root}>
      <button
        type="button"
        className={signer ? 'btn btn--small' : 'btn btn--primary btn--small'}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open && (
        <div className="identity__menu" role="dialog" aria-label="Identity">
          {!signer && (
            <>
              <p className="identity__text">
                You need an identity to submit pledges, reports and evaluations. Reading the ledger never requires one.
              </p>
              <button type="button" className="btn btn--primary" onClick={createSession}>
                Create a session key
              </button>
              <button type="button" className="btn" onClick={() => void connectWallet()} disabled={!hasWallet || busy}>
                {hasWallet ? 'Connect a wallet' : 'No wallet detected'}
              </button>
            </>
          )}

          {signer && (
            <>
              <p className="identity__label">{signer.kind === 'session' ? 'Session key' : 'Browser wallet'}</p>
              <p className="identity__address">
                <code>{signer.address}</code>
              </p>
              <div className="row">
                <CopyButton value={signer.address} label="Copy address" />
                <ExtLink href={explorerAddress(signer.address)}>View in explorer</ExtLink>
              </div>

              {signer.kind === 'session' ? (
                <>
                  <p className="identity__text">
                    This key lives only in this browser and has no funds. Studionet is a test network. Export it to reuse the same
                    identity elsewhere.
                  </p>
                  {revealed === null ? (
                    <button type="button" className="btn btn--small" onClick={() => setRevealed(exportSessionKey() ?? '')}>
                      Reveal private key
                    </button>
                  ) : (
                    <>
                      <input className="input mono" readOnly value={revealed} onFocus={(event) => event.currentTarget.select()} aria-label="Private key" />
                      <p className="identity__text">Anyone with this key can sign as you. Do not paste it anywhere you do not trust.</p>
                    </>
                  )}
                  <div className="row">
                    <button type="button" className="btn btn--danger btn--small" onClick={forgetSession}>
                      Forget this key
                    </button>
                    {hasWallet && (
                      <button type="button" className="btn btn--small" onClick={() => void connectWallet()} disabled={busy}>
                        Use a wallet
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <button type="button" className="btn btn--small" onClick={disconnect}>
                  Disconnect
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
