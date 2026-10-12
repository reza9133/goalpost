import { Fragment, useMemo } from 'react';

import { redline, type DiffToken } from '../lib/diff';

function Tokens({ tokens, side }: { tokens: DiffToken[]; side: 'removed' | 'added' }) {
  return (
    <>
      {tokens.map((token, index) => (
        <Fragment key={index}>
          {token.changed ? <span className={`tok tok--${side}`}>{token.text}</span> : token.text}{' '}
        </Fragment>
      ))}
    </>
  );
}

interface RedlinePairProps {
  pledged: string;
  reported: string;
  pledgedLabel?: string;
  reportedLabel?: string;
}

/** The frozen pledge text next to the text the report uses, with changed words marked. Display only. */
export function RedlinePair({ pledged, reported, pledgedLabel = 'Pledged', reportedLabel = 'Reported' }: RedlinePairProps) {
  const diff = useMemo(() => redline(pledged, reported), [pledged, reported]);
  const hasReport = reported.trim().length > 0;
  const pct = Math.round(diff.overlap * 100);

  const overlapColor = pct >= 80 ? 'var(--held)' : pct >= 50 ? 'var(--revised)' : 'var(--moved)';

  return (
    <div className="redline">
      <figure className="redline__side">
        <figcaption style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ink)' }} />
          <span>{pledgedLabel}</span>
        </figcaption>
        <blockquote className="quote">
          <Tokens tokens={diff.left} side="removed" />
        </blockquote>
      </figure>
      <figure className="redline__side">
        <figcaption style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: hasReport ? 'var(--moved)' : 'var(--neutral)' }} />
          <span>{reportedLabel}</span>
        </figcaption>
        {hasReport ? (
          <blockquote className="quote">
            <Tokens tokens={diff.right} side="added" />
          </blockquote>
        ) : (
          <p className="muted redline__empty">The report offers no excerpt for this element.</p>
        )}
      </figure>
      {hasReport && (
        <div className="redline__foot" style={{ marginTop: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="mono" style={{ fontWeight: 600, color: overlapColor, fontSize: '0.85rem' }}>
                {pct}%
              </span>
              <span className="muted" style={{ fontSize: '0.82rem' }}>wording overlap</span>
            </div>
            <div
              style={{
                flex: '1',
                minWidth: '60px',
                maxWidth: '120px',
                height: '4px',
                background: 'var(--sunken)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
              title={`${pct}% wording overlap`}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: overlapColor,
                  borderRadius: '2px',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <span className="muted" style={{ fontSize: '0.78rem' }}>
              Marked words differ; this comparison is for review only and does not solely decide verdicts.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
