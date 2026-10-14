import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Notice, ExtLink } from '../components/Bits';
import { Chip } from '../components/Chips';
import { RequireIdentity } from '../components/RequireIdentity';
import { reads, writes } from '../lib/api';
import { findIdInReceipt } from '../lib/receipt';
import { IS_CONFIGURED } from '../lib/config';
import { DIMENSION_LABEL, KIND_LABEL, isPublicHost } from '../lib/format';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import { useIdentity } from '../lib/identity';
import { SCENARIOS, type Scenario } from '../lib/scenarios';
import { useTx } from '../lib/tx';
import type { Dimension, Kind } from '../lib/types';
import {
  DEFAULT_LIMITS,
  DIMENSIONS,
  KINDS,
  splitAnchors,
  squash,
  validateDraft,
  type Draft,
  type ElementDraft,
} from '../lib/validate';

function draftFromScenario(scenario: Scenario, startId: number): Draft {
  const origin = window.location.origin;
  return {
    title: scenario.title,
    kind: scenario.kind,
    pledgeUrl: origin + scenario.pledge_path,
    reportPrefix: origin + scenario.report_prefix_path,
    elements: scenario.elements.map((element, index) => ({
      id: startId + index,
      key: element.key,
      dimension: element.dimension,
      quote: element.quote,
      anchors: element.anchors.join(', '),
    })),
  };
}

function emptyElement(id: number, index: number): ElementDraft {
  return { id, key: `element_${index + 1}`, dimension: 'target', quote: '', anchors: '' };
}

export function RegisterPage() {
  useDocumentTitle('Register a pledge');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signer } = useIdentity();
  const tx = useTx();
  const nextId = useRef(100);

  const info = useAsync(async () => (IS_CONFIGURED ? await reads.info() : null), [], 0);
  const limits = info.data?.limits ?? DEFAULT_LIMITS;

  const [draft, setDraft] = useState<Draft>(() => ({
    title: '',
    kind: 'climate',
    pledgeUrl: '',
    reportPrefix: '',
    elements: [emptyElement(1, 0)],
  }));
  const [touched, setTouched] = useState(false);

  const scenarioParam = params.get('scenario');
  useEffect(() => {
    const scenario = SCENARIOS.find((item) => item.id === scenarioParam);
    if (scenario) {
      nextId.current += 20;
      setDraft(draftFromScenario(scenario, nextId.current));
      setTouched(false);
    }
  }, [scenarioParam]);

  const { ok, errors } = useMemo(() => validateDraft(draft, limits), [draft, limits]);
  const showErrors = touched;
  const origin = window.location.origin;
  const originIsPublic = isPublicHost(origin);

  const patch = (changes: Partial<Draft>): void => setDraft((current) => ({ ...current, ...changes }));
  const patchElement = (id: number, changes: Partial<ElementDraft>): void =>
    setDraft((current) => ({
      ...current,
      elements: current.elements.map((element) => (element.id === id ? { ...element, ...changes } : element)),
    }));
  const addElement = (): void => {
    nextId.current += 1;
    setDraft((current) => ({ ...current, elements: [...current.elements, emptyElement(nextId.current, current.elements.length)] }));
  };
  const removeElement = (id: number): void =>
    setDraft((current) => ({ ...current, elements: current.elements.filter((element) => element.id !== id) }));
  const loadScenario = (scenario: Scenario): void => {
    nextId.current += 20;
    setDraft(draftFromScenario(scenario, nextId.current));
    setTouched(false);
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setTouched(true);
    if (!ok) return;

    const title = squash(draft.title);
    const pledgeUrl = draft.pledgeUrl.trim();
    const outcome = await tx.run(
      'Register pledge',
      writes.registerPledge({
        title,
        kind: draft.kind,
        pledgeUrl,
        reportPrefix: draft.reportPrefix.trim(),
        elements: draft.elements.map((element) => ({
          key: element.key.trim(),
          dimension: element.dimension,
          quote: squash(element.quote),
          anchors: splitAnchors(element.anchors),
        })),
      }),
    );
    if (!outcome?.ok) return;

    let pledgeId = findIdInReceipt(outcome.receipt, 'PLG');
    if (pledgeId === null) {
      try {
        const recent = await reads.pledges(0, 5);
        const mine = recent.items.find(
          (item) => item.owner.toLowerCase() === signer?.address.toLowerCase() && item.title === title,
        );
        pledgeId = mine?.pledge_id ?? null;
      } catch {
        pledgeId = null;
      }
    }
    navigate(pledgeId ? `/pledges/${pledgeId}` : '/');
  };

  return (
    <div className="split">
      <div>
        <h1 className="display display--page">Register a pledge</h1>
        <p className="lede">
          Name a public page and quote the sentences that define the commitment. Validators fetch the page and confirm every quote is
          really there before anything is frozen, so nobody can freeze words the pledger never published.
        </p>

        <form className="form" onSubmit={(event) => void submit(event)} noValidate>
          {/* Card 1: Pledge details */}
          <div
            style={{
              background: 'rgba(var(--surface-rgb), 0.6)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem 1.5rem',
              display: 'grid',
              gap: '1.2rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.6rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'var(--ink)',
                  color: 'var(--surface)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                1
              </span>
              <strong style={{ fontSize: '0.95rem' }}>Pledge Overview</strong>
            </div>

            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label className="field__label" htmlFor="title">
                  Title
                </label>
                <span className="muted" style={{ fontSize: '0.78rem' }}>
                  {draft.title.length} / {limits.max_title_chars}
                </span>
              </div>
              <input
                id="title"
                className="input"
                value={draft.title}
                maxLength={limits.max_title_chars}
                onChange={(event) => patch({ title: event.target.value })}
                placeholder="e.g. Meridian Grid climate pledge"
                aria-invalid={showErrors && Boolean(errors.title)}
              />
              {showErrors && errors.title && <p className="field__error">{errors.title}</p>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="kind">
                Pledge Category
              </label>
              <select id="kind" className="select" value={draft.kind} onChange={(event) => patch({ kind: event.target.value as Kind })}>
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Card 2: URL configuration */}
          <div
            style={{
              background: 'rgba(var(--surface-rgb), 0.6)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem 1.5rem',
              display: 'grid',
              gap: '1.2rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.6rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'var(--ink)',
                  color: 'var(--surface)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                2
              </span>
              <strong style={{ fontSize: '0.95rem' }}>Source Locations</strong>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="pledge-url">
                Pledge page URL
              </label>
              <input
                id="pledge-url"
                className="input mono"
                inputMode="url"
                value={draft.pledgeUrl}
                onChange={(event) => patch({ pledgeUrl: event.target.value })}
                placeholder="https://example.org/commitments"
                aria-invalid={showErrors && Boolean(errors.pledgeUrl)}
              />
              <p className="field__hint">A public https page. Validators read it as plain text, so it must work without scripts.</p>
              {showErrors && errors.pledgeUrl && <p className="field__error">{errors.pledgeUrl}</p>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="report-prefix">
                Where future reports will be published
              </label>
              <input
                id="report-prefix"
                className="input mono"
                inputMode="url"
                value={draft.reportPrefix}
                onChange={(event) => patch({ reportPrefix: event.target.value })}
                placeholder="https://example.org/reports/"
                aria-invalid={showErrors && Boolean(errors.reportPrefix)}
              />
              <p className="field__hint">
                A prefix on the same host, ending with a slash. Only pages under it can ever be audited against this pledge. On a host
                that serves many publishers (GitHub, Gist, Medium and similar) it must also stay inside the pledge's own publisher
                namespace.
              </p>
              <p className="field__hint">
                The pledge page itself must name this prefix, or validators will refuse to freeze the pledge. Add{' '}
                <code>{`<link rel="goalpost-reports" href="${draft.reportPrefix.trim() || 'https://example.org/reports/'}">`}</code> to the page,
                or write the address in its visible text. A third party cannot aim a pledge at pages the publisher never named.
              </p>
              {showErrors && errors.reportPrefix && <p className="field__error">{errors.reportPrefix}</p>}
            </div>
          </div>

          {/* Card 3: Elements */}
          <fieldset className="fieldset">
            <legend style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'var(--ink)',
                  color: 'var(--surface)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                3
              </span>
              <span>Frozen Definition Elements ({draft.elements.length} of {limits.max_elements})</span>
            </legend>
            <p className="field__hint" style={{ marginTop: '0.4rem', marginBottom: '1rem' }}>
              Each element is one sentence, copied exactly. Give each one at least one anchor, a word or number that defines it (a metric, a baseline year, a scope): a later
              report cannot be called unchanged unless its text still carries every anchor.
            </p>

            {draft.elements.map((element, index) => {
              const problems = errors.perElement[index] ?? {};
              const anchorList = splitAnchors(element.anchors);
              return (
                <div className="element-editor" key={element.id}>
                  <div className="element-editor__head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: 'var(--sunken)',
                          color: 'var(--ink-2)',
                        }}
                      >
                        #{index + 1}
                      </span>
                      <strong>{DIMENSION_LABEL[element.dimension]}</strong>
                    </div>
                    {draft.elements.length > 1 && (
                      <button
                        type="button"
                        className="btn btn--quiet btn--small btn--danger"
                        onClick={() => removeElement(element.id)}
                        title="Remove element"
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>
                  <div className="grid-2">
                    <div className="field">
                      <label className="field__label" htmlFor={`dimension-${element.id}`}>
                        What it defines
                      </label>
                      <select
                        id={`dimension-${element.id}`}
                        className="select"
                        value={element.dimension}
                        onChange={(event) => patchElement(element.id, { dimension: event.target.value as Dimension })}
                      >
                        {DIMENSIONS.map((dimension) => (
                          <option key={dimension} value={dimension}>
                            {DIMENSION_LABEL[dimension]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor={`key-${element.id}`}>
                        Identifier Key
                      </label>
                      <input
                        id={`key-${element.id}`}
                        className="input mono"
                        value={element.key}
                        onChange={(event) => patchElement(element.id, { key: event.target.value })}
                        aria-invalid={showErrors && Boolean(problems.key)}
                      />
                      {showErrors && problems.key && <p className="field__error">{problems.key}</p>}
                    </div>
                  </div>
                  <div className="field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <label className="field__label" htmlFor={`quote-${element.id}`}>
                        Quote from the pledge page
                      </label>
                      <span className="muted" style={{ fontSize: '0.78rem' }}>
                        {squash(element.quote).length} / {limits.max_quote_chars} chars
                      </span>
                    </div>
                    <textarea
                      id={`quote-${element.id}`}
                      className="textarea quote-input"
                      rows={3}
                      value={element.quote}
                      onChange={(event) => patchElement(element.id, { quote: event.target.value })}
                      aria-invalid={showErrors && Boolean(problems.quote)}
                      placeholder="Paste the exact sentence verbatim from the public page…"
                    />
                    {showErrors && problems.quote && <p className="field__error">{problems.quote}</p>}
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor={`anchors-${element.id}`}>
                      Anchors <span className="muted">(comma-separated numbers or defining words)</span>
                    </label>
                    <input
                      id={`anchors-${element.id}`}
                      className="input"
                      value={element.anchors}
                      onChange={(event) => patchElement(element.id, { anchors: event.target.value })}
                      placeholder="e.g. absolute, 40%, 2030, 2019"
                      aria-invalid={showErrors && Boolean(problems.anchors)}
                    />
                    {anchorList.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                        {anchorList.map((anc) => (
                          <span
                            key={anc}
                            className="mono"
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.12rem 0.45rem',
                              borderRadius: '4px',
                              background: 'var(--sunken)',
                              border: '1px solid var(--line)',
                              color: 'var(--ink)',
                            }}
                          >
                            🏷 {anc}
                          </span>
                        ))}
                      </div>
                    )}
                    {showErrors && problems.anchors && <p className="field__error">{problems.anchors}</p>}
                  </div>
                </div>
              );
            })}

            {showErrors && errors.elements && <p className="field__error">{errors.elements}</p>}
            <button
              type="button"
              className="btn btn--small"
              onClick={addElement}
              disabled={draft.elements.length >= limits.max_elements}
              style={{ marginTop: '0.5rem' }}
            >
              + Add another element
            </button>
          </fieldset>

          <RequireIdentity>
            <div className="row" style={{ marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn--primary" disabled={tx.busy || !IS_CONFIGURED} style={{ padding: '0.8rem 1.6rem' }}>
                {tx.busy ? 'Broadcasting to GenLayer…' : '❄ Freeze this pledge on chain'}
              </button>
              {showErrors && !ok && <span className="field__error">Please review and fix the highlighted fields above.</span>}
            </div>
          </RequireIdentity>
        </form>
      </div>

      <aside className="aside" aria-label="Demonstration documents">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📑</span>
          <h2>Demo Scenarios</h2>
        </div>
        <p style={{ fontSize: '0.86rem', color: 'var(--ink-2)', marginBottom: '1rem' }}>
          Bundled fictional corporate commitments served under <code>/evidence</code>. Select any demonstration to populate the form instantly.
        </p>
        {!originIsPublic && (
          <Notice tone="warn" title="Local address notice">
            <p style={{ fontSize: '0.82rem' }}>
              Validators fetch pages directly over public internet, so they cannot resolve {origin}. Deploy to Cloudflare or point at public URLs.
            </p>
          </Notice>
        )}
        <ul className="aside__list">
          {SCENARIOS.map((scenario) => (
            <li
              key={scenario.id}
              style={{
                background: 'rgba(var(--surface-rgb), 0.7)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius)',
                padding: '1rem',
                display: 'grid',
                gap: '0.5rem',
                transition: 'border-color var(--transition-fast), transform var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.92rem' }}>{scenario.title}</strong>
                <Chip tone="neutral">{KIND_LABEL[scenario.kind]}</Chip>
              </div>
              <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>{scenario.summary}</p>
              <div className="row" style={{ marginTop: '0.25rem', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  className="btn btn--primary btn--small"
                  onClick={() => loadScenario(scenario)}
                >
                  Load scenario
                </button>
                <ExtLink href={scenario.pledge_path}>
                  <span style={{ fontSize: '0.8rem' }}>View pledge ↗</span>
                </ExtLink>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
