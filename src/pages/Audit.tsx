import { Fragment, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Chip, StatusChip, VerdictChip } from '../components/Chips';
import { ExtLink, HashValue, Loading, Notice } from '../components/Bits';
import { RedlinePair } from '../components/Redline';
import { RequireIdentity } from '../components/RequireIdentity';
import { reads, writes } from '../lib/api';
import { IS_CONFIGURED, explorerAddress } from '../lib/config';
import {
  DIMENSION_LABEL,
  FAILURE_EXPLANATION,
  VERDICT_EXPLANATION,
  VERDICT_HEADLINE,
  VERDICT_TONE,
  explainFlag,
  formatDateTime,
  hostOf,
  pathOf,
  shortHex,
} from '../lib/format';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import { useIdentity } from '../lib/identity';
import { useTx } from '../lib/tx';
import type { AuditBundle, AuditElementResult, FrozenElement } from '../lib/types';
import { normalize } from '../lib/validate';

type Check = { state: 'idle' } | { state: 'checking' } | { state: 'match' } | { state: 'mismatch'; got: string } | { state: 'error'; message: string };

function AnchorList({ element, excerpt }: { element: FrozenElement; excerpt: string }) {
  if (element.anchors.length === 0) return null;
  const haystack = normalize(excerpt);
  return (
    <p className="anchors">
      <span className="muted">Anchors in the report text</span>
      {element.anchors.map((anchor) => {
        const present = excerpt.length > 0 && haystack.includes(normalize(anchor));
        return (
          <span key={anchor} className={present ? 'anchor anchor--present' : 'anchor anchor--missing'}>
            {anchor}
            <span className="sr-only">{present ? ' (present)' : ' (missing)'}</span>
          </span>
        );
      })}
    </p>
  );
}

function ElementCard({ element, result }: { element: FrozenElement; result: AuditElementResult }) {
  return (
    <li className="element element--audit">
      <div className="element__head">
        <strong>{DIMENSION_LABEL[element.dimension]}</strong>
        <code>{element.key}</code>
        <StatusChip status={result.status} />
      </div>

      {result.status === 'NOT_ADDRESSED' ? (
        <>
          <blockquote className="quote">{element.quote}</blockquote>
          <p className="muted">The report does not address this commitment.</p>
        </>
      ) : (
        <RedlinePair pledged={element.quote} reported={result.report_excerpt} />
      )}

      {result.disclosure_excerpt && (
        <figure className="disclosure">
          <figcaption>Where the report acknowledges the change</figcaption>
          <blockquote className="quote">{result.disclosure_excerpt}</blockquote>
        </figure>
      )}

      {result.status !== 'NOT_ADDRESSED' && <AnchorList element={element} excerpt={result.report_excerpt} />}

      {result.flag && <Notice title="Why this element is not verifiable">{explainFlag(result.flag)}</Notice>}
      {result.reason && (
        <p className="muted element__reason">
          Model note, not part of the verdict: {result.reason}
        </p>
      )}
    </li>
  );
}

export function AuditPage() {
  const { auditId = '' } = useParams();
  const { signer } = useIdentity();
  const tx = useTx();
  const bundle = useAsync(async (): Promise<AuditBundle | null> => (IS_CONFIGURED ? await reads.audit(auditId) : null), [auditId], 20000);
  const [check, setCheck] = useState<Check>({ state: 'idle' });

  const audit = bundle.data?.audit ?? null;
  const pledge = bundle.data?.pledge ?? null;
  useDocumentTitle(audit ? `${audit.audit_id} on ${pledge?.title ?? ''}` : auditId);

  if (bundle.loading && bundle.data === null) return <Loading />;
  if (bundle.error && bundle.data === null) {
    return (
      <Notice tone="error" title="Could not load this audit">
        <p>{bundle.error}</p>
        <button type="button" className="btn btn--small" onClick={bundle.reload}>
          Try again
        </button>
      </Notice>
    );
  }
  if (!audit || !pledge) {
    return (
      <Notice tone="warn" title="No such audit">
        <p>
          {auditId} is not in this contract. <Link to="/">Back to the ledger.</Link>
        </p>
      </Notice>
    );
  }

  const settled = audit.state === 'SETTLED';
  const verdict = audit.verdict === '' ? null : audit.verdict;

  const evaluate = async (): Promise<void> => {
    const outcome = await tx.run(`Evaluate ${audit.audit_id}`, writes.evaluateReport(audit.audit_id));
    if (outcome) bundle.reload();
  };

  const verify = async (): Promise<void> => {
    setCheck({ state: 'checking' });
    try {
      const recomputed = await reads.recomputedAttestation(audit.audit_id);
      setCheck(recomputed === audit.attestation ? { state: 'match' } : { state: 'mismatch', got: recomputed });
    } catch (error) {
      setCheck({ state: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <>
      <p className="crumbs">
        <Link to="/">Ledger</Link> / <Link to={`/pledges/${pledge.pledge_id}`}>{pledge.pledge_id}</Link> / {audit.audit_id}
      </p>

      {settled && verdict ? (
        <section className={`verdict verdict--${VERDICT_TONE[verdict]}`} aria-labelledby="verdict-title">
          <div className="verdict__chip">
            <VerdictChip verdict={verdict} />
          </div>
          <h1 id="verdict-title" className="display display--page">
            {VERDICT_HEADLINE[verdict]}
          </h1>
          <p className="lede">{VERDICT_EXPLANATION[verdict]}</p>
          {audit.silent_keys.length > 0 && (
            <p className="verdict__detail">
              Moved silently:{' '}
              {audit.silent_keys.map((key) => (
                <Fragment key={key}>
                  <code className="verdict__key">{key}</code>{' '}
                </Fragment>
              ))}
            </p>
          )}
          {audit.failure_reason && (
            <p className="muted">{FAILURE_EXPLANATION[audit.failure_reason] ?? `The report could not be read (${audit.failure_reason}).`}</p>
          )}
        </section>
      ) : (
        <section className="verdict verdict--neutral" aria-labelledby="verdict-title">
          <div className="verdict__chip">
            <Chip tone="neutral">Awaiting evaluation</Chip>
          </div>
          <h1 id="verdict-title" className="display display--page">
            This report has not been evaluated yet.
          </h1>
          <p className="lede">
            Evaluating asks the validators to fetch the report, classify each frozen element, and agree on the result. It usually takes one
            to three minutes.
          </p>
          <RequireIdentity>
            <button type="button" className="btn btn--primary" disabled={tx.busy || pledge.status !== 'ACTIVE'} onClick={() => void evaluate()}>
              {tx.busy ? 'Waiting for the network' : 'Evaluate this report'}
            </button>
          </RequireIdentity>
          {signer === null && <p className="field__hint">Reading this page never needs an identity; evaluating does.</p>}
        </section>
      )}

      <dl className="facts">
        <div>
          <dt>Pledge</dt>
          <dd>
            <Link to={`/pledges/${pledge.pledge_id}`}>{pledge.title}</Link>
          </dd>
        </div>
        <div>
          <dt>Report</dt>
          <dd>
            <ExtLink href={audit.report_url}>{hostOf(audit.report_url) + pathOf(audit.report_url)}</ExtLink>, {audit.period}
          </dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>
            {formatDateTime(audit.submitted_at)} by <ExtLink href={explorerAddress(audit.submitted_by)}>{shortHex(audit.submitted_by, 8, 6)}</ExtLink>
          </dd>
        </div>
        {settled && (
          <div>
            <dt>Evaluated</dt>
            <dd>
              {formatDateTime(audit.evaluated_at)} by <ExtLink href={explorerAddress(audit.evaluated_by)}>{shortHex(audit.evaluated_by, 8, 6)}</ExtLink>
            </dd>
          </div>
        )}
      </dl>

      {settled && audit.elements.length > 0 && (
        <section className="section" aria-labelledby="elements-title">
          <div className="section__head">
            <h2 id="elements-title">Element by element</h2>
            <span className="muted">Every quoted excerpt was checked against the report by the validators</span>
          </div>
          <ol className="elements">
            {pledge.elements.map((element) => {
              const result = audit.elements.find((item) => item.key === element.key);
              return result ? <ElementCard key={element.key} element={element} result={result} /> : null;
            })}
          </ol>
        </section>
      )}

      {settled && audit.attestation && (
        <section className="section" aria-labelledby="attestation-title">
          <div className="section__head">
            <h2 id="attestation-title">Attestation</h2>
          </div>
          <p className="muted">
            A hash that binds the frozen pledge, the report address, the verdict and every cited excerpt. Anyone can recompute it from public
            state, so a copy of it can travel without needing to be trusted.
          </p>
          <p>
            <HashValue value={audit.attestation} head={14} tail={10} />
          </p>
          <div className="row">
            <button type="button" className="btn btn--small" onClick={() => void verify()} disabled={check.state === 'checking'}>
              {check.state === 'checking' ? 'Recomputing' : 'Recompute on the network'}
            </button>
            {check.state === 'match' && <Chip tone="held">Matches the contract</Chip>}
            {check.state === 'mismatch' && <Chip tone="moved">Does not match</Chip>}
            {check.state === 'error' && <span className="field__error">{check.message}</span>}
          </div>
        </section>
      )}
    </>
  );
}
