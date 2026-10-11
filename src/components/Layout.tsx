import { Link, NavLink, Outlet } from 'react-router-dom';

import { CHAIN_ID, CONTRACT_ADDRESS, EXPLORER_URL, IS_CONFIGURED, explorerAddress } from '../lib/config';
import { shortHex } from '../lib/format';
import { ExtLink, Notice } from './Bits';
import { BrandMark } from './Brand';
import { IdentityMenu } from './IdentityMenu';
import { TxPanel } from './TxPanel';

export function Layout() {
  return (
    <div className="shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar__inner">
          <Link to="/" className="brand" aria-label="Goalpost home">
            <BrandMark />
            <span className="brand__name">Goalpost</span>
          </Link>
          <nav className="nav" aria-label="Primary">
            <NavLink to="/" end>
              Ledger
            </NavLink>
            <NavLink to="/new">Register a pledge</NavLink>
            <NavLink to="/how">How it works</NavLink>
          </nav>
          <span className="netpill" title={`GenLayer Studionet, chain ID ${CHAIN_ID}`}>
            Studionet
          </span>
          <IdentityMenu />
        </div>
      </header>

      <main id="main" className="page">
        {!IS_CONFIGURED && (
          <Notice tone="warn" title="This build is not connected to a contract yet">
            <p>
              Set <code>VITE_CONTRACT_ADDRESS</code> to the address printed by <code>npm run deploy:contract</code>, then rebuild. The README
              walks through it.
            </p>
          </Notice>
        )}
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer__inner">
          <p>
            Goalpost runs on GenLayer Studionet, a test network. Records here demonstrate the mechanism and carry no legal weight.
          </p>
          <p className="muted">
            {IS_CONFIGURED ? (
              <>
                Contract <ExtLink href={explorerAddress(CONTRACT_ADDRESS)}>{shortHex(CONTRACT_ADDRESS, 8, 6)}</ExtLink> on{' '}
                <ExtLink href={EXPLORER_URL}>the Studionet explorer</ExtLink>
              </>
            ) : (
              'No contract configured'
            )}
          </p>
        </div>
      </footer>

      <TxPanel />
    </div>
  );
}
