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
    <div className="anchors" style={{ marginTop: '0.8rem' }}>
      <span className="muted" style={{ fontSize: '0.8rem' }}>Report anchor verification:</span>
      {element.anchors.map((anchor) => {
        const present = excerpt.length > 0 && haystack.includes(normalize(anchor));
        return (
          <span
            key={anchor}
            className={present ? 'anchor anchor--present' : 'anchor anchor--missing'}
            title={present ? 'Found in report text' : 'Missing from report text'}
          >
            {present ? '✓ ' : '✗ '}
            {anchor}
            <span className="sr-only">{present ? ' (present)' : ' (missing)'}</span>
          </span>
        );
      })}
    </div>
  );
}

function ElementCard({ element, result }: { element: FrozenElement; result: AuditElementResult }) {
  return (
    <li className="element element--audit">
      <div className="element__head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <strong>{DIMENSION_LABEL[element.dimension]}</strong>
          <code style={{ fontSize: '0.8rem', background: 'rgba(var(--ink-rgb), 0.04)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
            {element.key}
          </code>
        </div>
        <StatusChip status={result.status} />
      </div>

      {result.status === 'NOT_ADDRESSED' ? (
        <div style={{ margin: '0.75rem 0' }}>
          <blockquote className="quote">{element.quote}</blockquote>
          <p className="muted" style={{ marginTop: '0.6rem', fontSize: '0.88rem' }}>
            ℹ The submitted report does not address this commitment.
          </p>
        </div>
      ) : (
        <div style={{ margin: '0.75rem 0' }}>
          <RedlinePair pledged={element.quote} reported={result.report_excerpt} />
        </div>
      )}

      {result.disclosure_excerpt && (
        <figure
          className="disclosure"
          style={{
            background: 'rgba(var(--revised-ink), 0.04)',
            borderLeft: '3px solid var(--revised)',
            padding: '0.65rem 1rem',
            borderRadius: '0 6px 6px 0',
          }}
        >
          <figcaption style={{ fontSize: '0.78rem', color: 'var(--revised-ink)', fontWeight: 600 }}>
            Where the report acknowledges the change:
          </figcaption>
          <blockquote className="quote" style={{ border: 'none', background: 'transparent', padding: 0, marginTop: '0.25rem' }}>
            {result.disclosure_excerpt}
          </blockquote>
        </figure>
      )}

      {result.status !== 'NOT_ADDRESSED' && <AnchorList element={element} excerpt={result.report_excerpt} />}

      {result.flag && (
        <div style={{ marginTop: '0.85rem' }}>
          <Notice tone="warn" title="Why this element is not verifiable">
            {explainFlag(result.flag)}
          </Notice>
        </div>
      )}

      {result.reason && (
        <p className="muted element__reason" style={{ fontSize: '0.82rem', marginTop: '0.6rem' }}>
          Validator model note: {result.reason}
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
        <Link to="/">Ledger</Link> <span aria-hidden="true">›</span> <Link to={`/pledges/${pledge.pledge_id}`}>{pledge.pledge_id}</Link> <span aria-hidden="true">›</span> {audit.audit_id}
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
            <div className="verdict__detail" style={{ marginTop: '0.8rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--moved-ink)', fontWeight: 600, marginRight: '0.5rem' }}>
                Moved silently without disclosure:
              </span>
              <div style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {audit.silent_keys.map((key) => (
                  <code key={key} className="verdict__key">
                    ⚠ {key}
                  </code>
                ))}
              </div>
            </div>
          )}
          {audit.failure_reason && (
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              {FAILURE_EXPLANATION[audit.failure_reason] ?? `The report could not be read (${audit.failure_reason}).`}
            </p>
          )}
        </section>
      ) : (
        <section className="verdict verdict--neutral" aria-labelledby="verdict-title">
          <div className="verdict__chip">
            <Chip tone="neutral">Awaiting GenLayer Evaluation</Chip>
          </div>
          <h1 id="verdict-title" className="display display--page">
            This report is queued for validator evaluation.
          </h1>
          <p className="lede">
            Evaluating asks the decentralized validators to independently fetch the report, classify each frozen element against the original pledge, and agree on the result.
          </p>
          <RequireIdentity>
            <button
              type="button"
              className="btn btn--primary"
              disabled={tx.busy || pledge.status !== 'ACTIVE'}
              onClick={() => void evaluate()}
              style={{ marginTop: '0.5rem', padding: '0.75rem 1.4rem' }}
            >
              {tx.busy ? 'Evaluating on network…' : '⚡ Trigger validator consensus'}
            </button>
          </RequireIdentity>
          {signer === null && <p className="field__hint" style={{ marginTop: '0.5rem' }}>Reading is open to all; triggering evaluation requires choosing an identity.</p>}
        </section>
      )}

      <dl className="facts">
        <div>
          <dt>Audited Pledge</dt>
          <dd>
            <Link to={`/pledges/${pledge.pledge_id}`} style={{ fontWeight: 600 }}>{pledge.title} →</Link>
          </dd>
        </div>
        <div>
          <dt>Report Source</dt>
          <dd>
            <ExtLink href={audit.report_url}>
              {hostOf(audit.report_url) + pathOf(audit.report_url)} ↗
            </ExtLink>
            <span style={{ marginLeft: '0.4rem', opacity: 0.8 }}>({audit.period})</span>
          </dd>
        </div>
        <div>
          <dt>Submission</dt>
          <dd>
            {formatDateTime(audit.submitted_at)} by <ExtLink href={explorerAddress(audit.submitted_by)}>{shortHex(audit.submitted_by, 8, 6)} ↗</ExtLink>
          </dd>
        </div>
        {settled && (
          <div>
            <dt>Evaluation Settled</dt>
            <dd>
              {formatDateTime(audit.evaluated_at)} by <ExtLink href={explorerAddress(audit.evaluated_by)}>{shortHex(audit.evaluated_by, 8, 6)} ↗</ExtLink>
            </dd>
          </div>
        )}
      </dl>

      {settled && audit.elements.length > 0 && (
        <section className="section" aria-labelledby="elements-title">
          <div className="section__head">
            <h2 id="elements-title">Element-by-element consensus</h2>
            <span className="muted">Each excerpt was verified verbatim against the report by GenLayer validators</span>
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
        <section
          className="section"
          aria-labelledby="attestation-title"
          style={{
            background: 'rgba(var(--surface-rgb), 0.7)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div className="section__head" style={{ borderBottom: 'none', marginBottom: '0.5rem', paddingBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🔒</span>
              <h2 id="attestation-title" style={{ margin: 0 }}>Cryptographic Attestation</h2>
            </div>
          </div>
          <p className="muted" style={{ maxWidth: '48rem', fontSize: '0.88rem' }}>
            A deterministic hash that binds the frozen pledge, the report document, the final verdict, and every cited excerpt. Anyone can independently recompute it from public on-chain state to verify integrity without trusting any third party.
          </p>
          <div style={{ margin: '1rem 0' }}>
            <HashValue value={audit.attestation} head={18} tail={14} />
          </div>
          <div className="row" style={{ alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => void verify()}
              disabled={check.state === 'checking'}
            >
              {check.state === 'checking' ? '🔄 Recomputing on GenLayer…' : 'Recompute on network'}
            </button>
            {check.state === 'match' && <Chip tone="held">✓ Matches contract state perfectly</Chip>}
            {check.state === 'mismatch' && <Chip tone="moved">⚠ State mismatch detected</Chip>}
            {check.state === 'error' && <span className="field__error">{check.message}</span>}
          </div>
        </section>
      )}
    </>
  );
}
