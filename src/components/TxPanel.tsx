import { useEffect, useState } from 'react';

import { explorerTx } from '../lib/config';
import { shortHex } from '../lib/format';
import { useTx } from '../lib/tx';
import { ExtLink } from './Bits';

const STEPS = [
  { name: 'Signature', label: '1. Sign' },
  { name: 'Queue', label: '2. Queue' },
  { name: 'Validators', label: '3. Consensus' },
  { name: 'Decision', label: '4. Settle' },
] as const;

function stepIndex(phase: string): number {
  if (phase === 'signing') return 0;
  if (phase === 'submitted' || phase === 'queued') return 1;
  if (phase === 'consensus') return 2;
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
  const done = state.phase === 'decided';
  const current = stepIndex(state.phase);

  return (
    <aside className={`txpanel${failed ? ' txpanel--failed' : ''}${done ? ' txpanel--done' : ''}`} role="status" aria-live="polite">
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
          {done && <span style={{ color: 'var(--held)' }}>✓</span>}
          {failed && <span style={{ color: 'var(--moved)' }}>⚠</span>}
          <strong>{state.label}</strong>
        </div>
        <span className="txpanel__clock">⏱ {clock(elapsed)}</span>
      </div>

      <ol className="steps">
        {STEPS.map((step, index) => {
          const status = failed && index === current ? 'failed' : index < current || done ? 'done' : index === current ? 'active' : 'todo';
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
        {done && 'Transaction settled and verified on Studionet!'}
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
