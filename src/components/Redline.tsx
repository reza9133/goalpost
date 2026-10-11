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
  return (
    <div className="redline">
      <figure className="redline__side">
        <figcaption>{pledgedLabel}</figcaption>
        <blockquote className="quote">
          <Tokens tokens={diff.left} side="removed" />
        </blockquote>
      </figure>
      <figure className="redline__side">
        <figcaption>{reportedLabel}</figcaption>
        {hasReport ? (
          <blockquote className="quote">
            <Tokens tokens={diff.right} side="added" />
          </blockquote>
        ) : (
          <p className="muted redline__empty">The report offers no excerpt for this element.</p>
        )}
      </figure>
      {hasReport && (
        <p className="redline__foot muted">
          Wording overlap {Math.round(diff.overlap * 100)}%. Marked words differ between the two texts; this view is for reading only and
          does not decide the verdict.
        </p>
      )}
    </div>
  );
}
