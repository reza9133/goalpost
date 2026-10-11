import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Chip, StandingChip, Strikes, VerdictChip } from '../components/Chips';
import { ExtLink, HashValue, Loading, Notice } from '../components/Bits';
import { RequireIdentity } from '../components/RequireIdentity';
import { reads, writes } from '../lib/api';
import { IS_CONFIGURED, explorerAddress } from '../lib/config';
import {
  DIMENSION_LABEL,
  KIND_LABEL,
  formatDate,
  formatDateTime,
  hostOf,
  pathOf,
  plural,
  shortHex,
} from '../lib/format';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import { useIdentity } from '../lib/identity';
import { scenarioForPledgeUrl } from '../lib/scenarios';
import { useTx } from '../lib/tx';
import type { IntegrityResult, PledgeBundle, Tone } from '../lib/types';
import { periodProblem, reportUrlProblem } from '../lib/validate';

const INTEGRITY_TONE: Record<IntegrityResult, Tone> = { INTACT: 'held', EDITED: 'moved', UNREACHABLE: 'neutral' };
const INTEGRITY_LABEL: Record<IntegrityResult, string> = {
  INTACT: 'Every quote present',
  EDITED: 'Quotes missing',
  UNREACHABLE: 'Page unreachable',
};

export function PledgePage() {
  const { pledgeId = '' } = useParams();
  const navigate = useNavigate();
  const { signer } = useIdentity();
  const tx = useTx();
  const bundle = useAsync(async (): Promise<PledgeBundle | null> => (IS_CONFIGURED ? await reads.pledge(pledgeId) : null), [pledgeId], 20000);

  const [reportUrl, setReportUrl] = useState('');
  const [period, setPeriod] = useState('');
  const [touched, setTouched] = useState(false);

  const pledge = bundle.data?.pledge ?? null;
  const audits = useMemo(() => [...(bundle.data?.audits ?? [])].reverse(), [bundle.data]);
  useDocumentTitle(pledge ? pledge.title : pledgeId);

  if (bundle.loading && bundle.data === null) return <Loading />;
  if (bundle.error && bundle.data === null) {
    return (
      <Notice tone="error" title="Could not load this pledge">
        <p>{bundle.error}</p>
        <button type="button" className="btn btn--small" onClick={bundle.reload}>
          Try again
        </button>
      </Notice>
    );
  }
  if (!pledge) {
    return (
      <Notice tone="warn" title="No such pledge">
        <p>
          {pledgeId} is not in this contract. <Link to="/">Back to the ledger.</Link>
        </p>
      </Notice>
    );
  }

  const isOwner = signer?.address.toLowerCase() === pledge.owner;
  const active = pledge.status === 'ACTIVE';
  const scenario = scenarioForPledgeUrl(pledge.pledge_url);
  const prefixOrigin = (() => {
    try {
      return new URL(pledge.report_prefix).origin;
    } catch {
      return '';
    }
  })();
  const alreadyAudited = new Set(audits.filter((audit) => audit.state === 'PENDING' || audit.verdict !== 'INCONCLUSIVE').map((audit) => audit.report_url));

  const reportProblem = touched ? reportUrlProblem(reportUrl, pledge.report_prefix) : null;
  const periodIssue = touched ? periodProblem(period) : null;

  const verify = async (): Promise<void> => {
    const outcome = await tx.run(`Re-verify ${pledge.pledge_id}`, writes.checkIntegrity(pledge.pledge_id));
    if (outcome?.ok) bundle.reload();
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setTouched(true);
    if (reportUrlProblem(reportUrl, pledge.report_prefix) || periodProblem(period)) return;
    const outcome = await tx.run('Submit report', writes.submitReport(pledge.pledge_id, reportUrl.trim(), period.trim()));
    if (outcome?.ok) {
      setReportUrl('');
      setPeriod('');
      setTouched(false);
    }
    bundle.reload();
  };

  const evaluate = async (auditId: string): Promise<void> => {
    const outcome = await tx.run(`Evaluate ${auditId}`, writes.evaluateReport(auditId));
    if (outcome?.ok) navigate(`/audits/${auditId}`);
    else bundle.reload();
  };

  const retire = async (): Promise<void> => {
    if (!window.confirm('Retire this pledge? Its record and history stay on chain, but no new reports can be audited.')) return;
    const outcome = await tx.run(`Retire ${pledge.pledge_id}`, writes.retirePledge(pledge.pledge_id));
    if (outcome?.ok) bundle.reload();
  };

  const integrity = pledge.integrity;
  // Edit episodes have their own record; older pledges only have the rolling log to go on.
  const lastEdit = integrity.edits?.length
    ? integrity.edits[integrity.edits.length - 1]
    : [...integrity.log].reverse().find((entry) => entry.result === 'EDITED');

  return (
    <>
      <p className="crumbs">
        <Link to="/">Ledger</Link> / {pledge.pledge_id}
      </p>

      <header className="pledge-head">
        <div>
          <h1 className="display display--page">{pledge.title}</h1>
          <div className="row row--tight">
            <StandingChip standing={pledge.standing} />
            <Chip tone="neutral">{KIND_LABEL[pledge.kind]}</Chip>
            {!active && <Chip tone="neutral">Retired</Chip>}
          </div>
        </div>
        <div className="pledge-head__tally">
          <span className="muted">Silent moves found</span>
          <Strikes count={pledge.strikes} />
        </div>
      </header>

      <dl className="facts">
        <div>
          <dt>Pledge page</dt>
          <dd>
            <ExtLink href={pledge.pledge_url}>{hostOf(pledge.pledge_url) + pathOf(pledge.pledge_url)}</ExtLink>
          </dd>
        </div>
        <div>
          <dt>Reports must be under</dt>
          <dd className="mono">{pledge.report_prefix}</dd>
        </div>
        <div>
          <dt>Registered</dt>
          <dd>
            {formatDateTime(pledge.registered_at)} by <ExtLink href={explorerAddress(pledge.owner)}>{shortHex(pledge.owner, 8, 6)}</ExtLink>
          </dd>
        </div>
        <div>
          <dt>Commitment</dt>
          <dd>
            <HashValue value={pledge.commitment} />
          </dd>
        </div>
      </dl>

      <section className="section" aria-labelledby="frozen-title">
        <div className="section__head">
          <h2 id="frozen-title">Frozen definition</h2>
          <span className="muted">{plural(pledge.elements.length, 'element')}, verified on the page by validators at registration</span>
        </div>
        <ol className="elements">
          {pledge.elements.map((element) => (
            <li key={element.key} className="element">
              <div className="element__head">
                <strong>{DIMENSION_LABEL[element.dimension]}</strong>
                <code>{element.key}</code>
              </div>
              <blockquote className="quote">{element.quote}</blockquote>
              {element.anchors.length > 0 && (
                <p className="anchors">
                  <span className="muted">Anchors</span>
                  {element.anchors.map((anchor) => (
                    <span className="anchor" key={anchor}>
                      {anchor}
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="integrity-title">
        <div className="section__head">
          <h2 id="integrity-title">Has the pledge page been edited?</h2>
          {active && (
            <button type="button" className="btn btn--small" disabled={tx.busy || !signer} onClick={() => void verify()}>
              Re-verify the pledge page
            </button>
          )}
        </div>

        {integrity.state === 'EDITED' ? (
          <Notice tone="warn" title="The live pledge page no longer carries every frozen quote">
            <p>
              Validators found {plural(lastEdit?.missing.length ?? 0, 'frozen quote')} missing on {formatDateTime(lastEdit?.at ?? 0)}.
              The frozen definition above is unaffected, and {plural(integrity.edits_detected, 'edit')} {integrity.edits_detected === 1 ? 'has' : 'have'}{' '}
              been recorded permanently.
            </p>
          </Notice>
        ) : (
          <p className="muted">
            Validators last confirmed every frozen quote on {formatDateTime(integrity.checked_at)}.
            {integrity.edits_detected > 0 && ` ${plural(integrity.edits_detected, 'earlier edit')} remain on record.`}
          </p>
        )}

        <ul className="log">
          {[...integrity.log].reverse().slice(0, 5).map((entry) => (
            <li key={`${entry.at}-${entry.result}`}>
              <Chip tone={INTEGRITY_TONE[entry.result]}>{INTEGRITY_LABEL[entry.result]}</Chip>
              <span className="muted">
                {formatDateTime(entry.at)}
                {entry.missing.length > 0 && `, missing: ${entry.missing.join(', ')}`}
              </span>
            </li>
          ))}
        </ul>
        {!signer && active && <p className="field__hint">Choose an identity at the top right to request a re-verification.</p>}
      </section>

      <section className="section" aria-labelledby="audits-title">
        <div className="section__head">
          <h2 id="audits-title">Reports</h2>
          <span className="muted">{plural(audits.length, 'report')} submitted</span>
        </div>

        {audits.length === 0 ? (
          <p className="muted">No report has been submitted for this pledge.</p>
        ) : (
          <ul className="audits">
            {audits.map((audit) => (
              <li key={audit.audit_id} className="audit-row">
                <div className="audit-row__main">
                  <strong>{audit.period}</strong>
                  <span className="muted">
                    {audit.audit_id}, {hostOf(audit.report_url) + pathOf(audit.report_url)}
                  </span>
                </div>
                <VerdictChip verdict={audit.state === 'PENDING' ? '' : audit.verdict} />
                <div className="audit-row__actions">
                  {audit.state === 'PENDING' ? (
                    <button
                      type="button"
                      className="btn btn--primary btn--small"
                      disabled={tx.busy || !signer || !active}
                      onClick={() => void evaluate(audit.audit_id)}
                    >
                      Evaluate
                    </button>
                  ) : (
                    <Link className="btn btn--small" to={`/audits/${audit.audit_id}`}>
                      Open
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {active && (
          <form className="form form--inline" onSubmit={(event) => void submit(event)} noValidate>
            <h3>Submit a report</h3>
            <p className="field__hint">
              Anyone may submit a report and anyone may evaluate it. Submitting is cheap and checks the address only; evaluating asks the
              validators to read the report. The address must sit under the reporting prefix, with no query string and no <code>..</code> or
              encoded dots in the path.
            </p>
            {scenario && prefixOrigin && (
              <div className="row row--tight">
                <span className="muted">Demonstration reports:</span>
                {scenario.reports.map((report) => {
                  const url = prefixOrigin + report.path;
                  return (
                    <button
                      key={report.id}
                      type="button"
                      className="btn btn--small"
                      disabled={alreadyAudited.has(url)}
                      onClick={() => {
                        setReportUrl(url);
                        setPeriod(report.period);
                      }}
                    >
                      {report.label}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="grid-2 grid-2--wide-first">
              <div className="field">
                <label className="field__label" htmlFor="report-url">
                  Report URL
                </label>
                <input
                  id="report-url"
                  className="input mono"
                  inputMode="url"
                  value={reportUrl}
                  onChange={(event) => setReportUrl(event.target.value)}
                  placeholder={`${pledge.report_prefix}2026.html`}
                  aria-invalid={Boolean(reportProblem)}
                />
                {reportProblem && <p className="field__error">{reportProblem}</p>}
              </div>
              <div className="field">
                <label className="field__label" htmlFor="period">
                  Period
                </label>
                <input
                  id="period"
                  className="input"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  placeholder="FY2026"
                  aria-invalid={Boolean(periodIssue)}
                />
                {periodIssue && <p className="field__error">{periodIssue}</p>}
              </div>
            </div>
            <RequireIdentity>
              <button type="submit" className="btn btn--primary" disabled={tx.busy}>
                Submit report
              </button>
            </RequireIdentity>
          </form>
        )}
      </section>

      {isOwner && active && (
        <section className="section section--quiet" aria-label="Registrant controls">
          <p className="muted">
            You registered this pledge. Retiring it stops new audits; the record and its history stay on chain.
          </p>
          <button type="button" className="btn btn--danger btn--small" disabled={tx.busy} onClick={() => void retire()}>
            Retire this pledge
          </button>
        </section>
      )}

      <p className="muted pledge-foot">
        Registered {formatDate(pledge.registered_at)}
        {pledge.retired_at > 0 && `, retired ${formatDate(pledge.retired_at)}`}.
      </p>
    </>
  );
}
