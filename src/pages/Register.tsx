import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Notice, ExtLink } from '../components/Bits';
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

  // Depend on the value, never on the identity of the params object: a visitor's edits must
  // not be overwritten just because the router handed back a fresh URLSearchParams.
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
      // The receipt did not carry the return value; find the pledge by registrant and title instead.
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
          <div className="field">
            <label className="field__label" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className="input"
              value={draft.title}
              maxLength={limits.max_title_chars}
              onChange={(event) => patch({ title: event.target.value })}
              placeholder="Meridian Grid climate pledge"
              aria-invalid={showErrors && Boolean(errors.title)}
            />
            {showErrors && errors.title && <p className="field__error">{errors.title}</p>}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="kind">
              Kind
            </label>
            <select id="kind" className="select" value={draft.kind} onChange={(event) => patch({ kind: event.target.value as Kind })}>
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABEL[kind]}
                </option>
              ))}
            </select>
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
              Where reports will be published
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
              A prefix on the same host, ending with a slash and with no query string. Only pages under it can ever be audited against this pledge.
            </p>
            {showErrors && errors.reportPrefix && <p className="field__error">{errors.reportPrefix}</p>}
          </div>

          <fieldset className="fieldset">
            <legend>Frozen elements</legend>
            <p className="field__hint">
              Each element is one sentence, copied exactly. Give each one at least one anchor, a word or number that defines it (a metric, a baseline year, a scope): a later
              report cannot be called unchanged unless its text still carries every anchor.
            </p>

            {draft.elements.map((element, index) => {
              const problems = errors.perElement[index] ?? {};
              return (
                <div className="element-editor" key={element.id}>
                  <div className="element-editor__head">
                    <strong>Element {index + 1}</strong>
                    {draft.elements.length > 1 && (
                      <button type="button" className="btn btn--quiet btn--small" onClick={() => removeElement(element.id)}>
                        Remove
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
                        Key
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
                    <label className="field__label" htmlFor={`quote-${element.id}`}>
                      Quote from the pledge page
                    </label>
                    <textarea
                      id={`quote-${element.id}`}
                      className="textarea quote-input"
                      rows={3}
                      value={element.quote}
                      onChange={(event) => patchElement(element.id, { quote: event.target.value })}
                      aria-invalid={showErrors && Boolean(problems.quote)}
                    />
                    <p className="field__hint">
                      {squash(element.quote).length} of {limits.max_quote_chars} characters. Case, spacing and typographic quotes are
                      ignored when matching.
                    </p>
                    {showErrors && problems.quote && <p className="field__error">{problems.quote}</p>}
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor={`anchors-${element.id}`}>
                      Anchors <span className="muted">(at least one, separated by commas)</span>
                    </label>
                    <input
                      id={`anchors-${element.id}`}
                      className="input"
                      value={element.anchors}
                      onChange={(event) => patchElement(element.id, { anchors: event.target.value })}
                      placeholder="absolute, 40%, 2030, 2019"
                      aria-invalid={showErrors && Boolean(problems.anchors)}
                    />
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
            >
              Add an element
            </button>
          </fieldset>

          <RequireIdentity>
            <div className="row">
              <button type="submit" className="btn btn--primary" disabled={tx.busy || !IS_CONFIGURED}>
                {tx.busy ? 'Waiting for the network' : 'Freeze this pledge'}
              </button>
              {showErrors && !ok && <span className="field__error">Fix the highlighted fields first.</span>}
            </div>
          </RequireIdentity>
        </form>
      </div>

      <aside className="aside" aria-label="Demonstration documents">
        <h2>Try a demonstration</h2>
        <p>
          These fictional documents ship with this site, under <code>/evidence</code>. Loading one fills the form from them.
        </p>
        {!originIsPublic && (
          <Notice tone="warn" title="This address is not public">
            <p>
              Validators fetch pages themselves, so they cannot read {origin}. Deploy the site first, or point the form at any public page.
            </p>
          </Notice>
        )}
        <ul className="aside__list">
          {SCENARIOS.map((scenario) => (
            <li key={scenario.id}>
              <button type="button" className="btn btn--block" onClick={() => loadScenario(scenario)}>
                {scenario.title}
              </button>
              <p className="muted">{scenario.summary}</p>
              <ExtLink href={scenario.pledge_path}>Read the pledge page</ExtLink>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
