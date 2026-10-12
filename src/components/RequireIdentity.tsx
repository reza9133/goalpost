import type { ReactNode } from 'react';

import { useIdentity } from '../lib/identity';
import { Notice } from './Bits';

/** Renders its children once the visitor has an identity; otherwise offers the two ways to get one. */
export function RequireIdentity({ children }: { children: ReactNode }) {
  const { signer, hasWallet, busy, error, createSession, connectWallet } = useIdentity();
  if (signer) return <>{children}</>;
  return (
    <Notice title="🔑 Choose an identity to broadcast">
      <p style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.88rem' }}>
        Writing to the Intelligent Contract requires an identity to sign transactions. Studionet is a free test network, so an instant browser session key is sufficient.
      </p>
      <div className="row" style={{ gap: '0.6rem' }}>
        <button type="button" className="btn btn--primary" onClick={createSession}>
          ⚡ Create instant session key
        </button>
        <button type="button" className="btn" onClick={() => void connectWallet()} disabled={!hasWallet || busy}>
          {hasWallet ? '🦊 Connect browser wallet' : 'No wallet detected'}
        </button>
      </div>
      {error && <p className="field__error" style={{ marginTop: '0.5rem' }}>{error}</p>}
    </Notice>
  );
}
