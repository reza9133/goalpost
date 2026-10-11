import type { ReactNode } from 'react';

import { useIdentity } from '../lib/identity';
import { Notice } from './Bits';

/** Renders its children once the visitor has an identity; otherwise offers the two ways to get one. */
export function RequireIdentity({ children }: { children: ReactNode }) {
  const { signer, hasWallet, busy, error, createSession, connectWallet } = useIdentity();
  if (signer) return <>{children}</>;
  return (
    <Notice title="Choose who signs">
      <p>
        Writing to the contract needs an identity. Studionet is a free test network, so a session key kept in this browser is enough.
      </p>
      <div className="row">
        <button type="button" className="btn btn--primary" onClick={createSession}>
          Create a session key
        </button>
        <button type="button" className="btn" onClick={() => void connectWallet()} disabled={!hasWallet || busy}>
          {hasWallet ? 'Connect a wallet' : 'No wallet detected'}
        </button>
      </div>
      {error && <p className="field__error">{error}</p>}
    </Notice>
  );
}
