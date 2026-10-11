import { useEffect, useState } from 'react';

import { explorerTx } from '../lib/config';
import { shortHex } from '../lib/format';
import { useTx } from '../lib/tx';
import { ExtLink } from './Bits';

const STEPS = ['Signature', 'Queue', 'Validators', 'Decision'] as const;

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
        <strong>{state.label}</strong>
        <span className="txpanel__clock">{clock(elapsed)}</span>
      </div>

      <ol className="steps">
        {STEPS.map((step, index) => {
          const status = failed && index === current ? 'failed' : index < current || done ? 'done' : index === current ? 'active' : 'todo';
          return (
            <li key={step} className={`steps__item steps__item--${status}`}>
              {step}
            </li>
          );
        })}
      </ol>

      <p className="txpanel__text">
        {busy && state.phase === 'signing' && 'Waiting for the signature.'}
        {busy && state.phase !== 'signing' && 'Validators are fetching the evidence and reaching agreement. This usually takes one to three minutes.'}
        {done && 'Recorded on Studionet.'}
        {failed && (state.message ?? 'The transaction did not complete.')}
      </p>

      <div className="txpanel__foot">
        {state.hash ? (
          <ExtLink href={explorerTx(state.hash)}>{`Transaction ${shortHex(state.hash, 8, 6)}`}</ExtLink>
        ) : (
          <span className="muted">No transaction yet</span>
        )}
        <button type="button" className="btn btn--quiet btn--small" onClick={dismiss}>
          {busy ? 'Stop watching' : 'Dismiss'}
        </button>
      </div>
    </aside>
  );
}
