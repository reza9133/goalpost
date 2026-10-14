import { useEffect, useState } from 'react';

import { explorerTx } from '../lib/config';
import { shortHex } from '../lib/format';
import { useTx } from '../lib/tx';
import { ExtLink } from './Bits';

const STEPS = [
  { name: 'Signature', label: '1. Sign' },
  { name: 'Queue', label: '2. Queue' },
  { name: 'Validators', label: '3. Consensus' },
  { name: 'Accepted', label: '4. Accepted' },
  { name: 'Finalized', label: '5. Final' },
] as const;

/** Index of the step that is currently running. STEPS.length means everything is done. */
function stepIndex(phase: string): number {
  if (phase === 'signing') return 0;
  if (phase === 'submitted' || phase === 'queued') return 1;
  if (phase === 'consensus') return 2;
  if (phase === 'accepted') return 4;
  if (phase === 'finalized') return STEPS.length;
  return 3;
}

function useElapsed(startedAt: number, finishedAt: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (finishedAt !== undefined) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [finishedAt]);
  return Math.max(0, Math.round(((finishedAt ?? now) - startedAt) / 1000));
}

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function TxPanel() {
  const { state, busy, dismiss } = useTx();
  const elapsed = useElapsed(state?.startedAt ?? 0, state?.finishedAt);
  if (!state) return null;

  const failed = state.phase === 'failed';
  const finalized = state.phase === 'finalized';
  const accepted = state.phase === 'accepted';
  const reopened = accepted && state.statusName !== undefined && state.statusName !== 'ACCEPTED';
  const current = stepIndex(state.phase);

  return (
    <aside className={`txpanel${failed ? ' txpanel--failed' : ''}${finalized ? ' txpanel--done' : ''}${accepted ? ' txpanel--accepted' : ''}`} role="status" aria-live="polite">
      <div className="txpanel__head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {busy && (
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--revised)',
                boxShadow: '0 0 8px var(--revised)',
                animation: 'pulse 1s infinite alternate',
              }}
            />
          )}
          {finalized && <span style={{ color: 'var(--held)' }}>✓</span>}
          {accepted && <span style={{ color: 'var(--revised)' }}>◐</span>}
          {failed && <span style={{ color: 'var(--moved)' }}>⚠</span>}
          <strong>{state.label}</strong>
        </div>
        <span className="txpanel__clock">
          {state.statusName && (accepted || finalized) && (
            <span className={`txpanel__status txpanel__status--${finalized ? 'final' : 'accepted'}`}>{finalized ? 'FINALIZED' : 'ACCEPTED · not final'}</span>
          )}
          ⏱ {clock(elapsed)}
        </span>
      </div>

      <ol className="steps">
        {STEPS.map((step, index) => {
          const status = failed && index === current ? 'failed' : index < current ? 'done' : index === current && !failed ? 'active' : 'todo';
          return (
            <li key={step.name} className={`steps__item steps__item--${status}`}>
              <span>{status === 'done' ? '✓ ' : ''}{step.label}</span>
            </li>
          );
        })}
      </ol>

      <p className="txpanel__text">
        {busy && state.phase === 'signing' && 'Waiting for your signature in browser / session key…'}
        {busy && state.phase !== 'signing' && 'GenLayer validators are independently fetching the documents and agreeing on the verdict. This usually takes 1–3 minutes.'}
        {accepted && !reopened &&
          'Accepted by the validators, and the contract call ran successfully. Accepted is not final: the result can still be appealed. Goalpost keeps watching and will mark it final when the network does.'}
        {reopened && `The accepted result has been reopened (${state.statusName?.toLowerCase().replace(/_/g, ' ')}). It is not final and may change.`}
        {finalized && 'Finalized on Studionet. The contract call ran successfully and the result can no longer change.'}
        {failed && (state.message ?? 'The transaction did not complete.')}
      </p>

      <div className="txpanel__foot">
        {state.hash ? (
          <ExtLink href={explorerTx(state.hash)}>
            <span>TX {shortHex(state.hash, 8, 6)} ↗</span>
          </ExtLink>
        ) : (
          <span className="muted">Pending hash…</span>
        )}
        <button type="button" className="btn btn--quiet btn--small" onClick={dismiss}>
          {busy ? 'Run in background' : 'Dismiss'}
        </button>
      </div>
    </aside>
  );
}
