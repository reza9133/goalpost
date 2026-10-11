import { useState } from 'react';
import { Link } from 'react-router-dom';

import { StandingChip, Strikes } from '../components/Chips';
import { HeroFigure } from '../components/HeroFigure';
import { Loading, Notice } from '../components/Bits';
import { reads } from '../lib/api';
import { IS_CONFIGURED } from '../lib/config';
import { KIND_LABEL, formatDate, hostOf, plural } from '../lib/format';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import { SCENARIOS } from '../lib/scenarios';
import type { PledgePage, Stats } from '../lib/types';

const PAGE_SIZE = 10;

export function LedgerPage() {
  useDocumentTitle('');
  const [offset, setOffset] = useState(0);
  const stats = useAsync(async (): Promise<Stats | null> => (IS_CONFIGURED ? await reads.stats() : null), [], 30000);
  const list = useAsync(async (): Promise<PledgePage | null> => (IS_CONFIGURED ? await reads.pledges(offset, PAGE_SIZE) : null), [offset], 30000);

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__copy">
          <h1 id="hero-title" className="display">
            A promise can keep its numbers and lose its meaning.
          </h1>
          <p className="lede">
            Goalpost freezes the definition of a public pledge on GenLayer, then checks every later report against it. Validators fetch the
            evidence themselves and must agree on whether the goalposts moved.
          </p>
          <div className="row">
            <Link className="btn btn--primary" to="/new">
              Register a pledge
            </Link>
            <Link className="btn" to="/how">
              How verdicts work
            </Link>
          </div>
        </div>
        <HeroFigure />
      </section>

      <section className="section" aria-labelledby="ledger-title">
        <div className="section__head">
          <h2 id="ledger-title">The ledger</h2>
          {stats.data && (
            <dl className="figures">
              <div>
                <dt>Pledges</dt>
                <dd>{stats.data.pledges}</dd>
              </div>
              <div>
                <dt>Audits settled</dt>
                <dd>{stats.data.settled}</dd>
              </div>
              <div>
                <dt>Silent moves found</dt>
                <dd>{stats.data.silent_moves}</dd>
              </div>
            </dl>
          )}
        </div>

        {list.error && (
          <Notice tone="error" title="Could not load the ledger">
            <p>{list.error}</p>
            <button type="button" className="btn btn--small" onClick={list.reload}>
              Try again
            </button>
          </Notice>
        )}

        {list.loading && list.data === null && IS_CONFIGURED && <Loading />}

        {IS_CONFIGURED && !list.loading && !list.error && items.length === 0 && (
          <div className="empty">
            <h3>Nothing has been registered yet.</h3>
            <p>
              Register a public pledge to freeze its definition. Try one of the bundled demonstration documents; they are served from this
              site so validators can read them.
            </p>
            <div className="row">
              {SCENARIOS.map((scenario) => (
                <Link key={scenario.id} className="btn" to={`/new?scenario=${scenario.id}`}>
                  {scenario.title}
                </Link>
              ))}
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="ledger" role="table" aria-label="Registered pledges">
            <div className="ledger__head" role="row">
              <span role="columnheader">Pledge</span>
              <span role="columnheader">Standing</span>
              <span role="columnheader">Silent moves</span>
              <span role="columnheader">Audits</span>
              <span role="columnheader">Registered</span>
            </div>
            {items.map((pledge) => (
              <Link key={pledge.pledge_id} className="ledger__row" to={`/pledges/${pledge.pledge_id}`} role="row">
                <span className="ledger__title" role="cell">
                  <strong>{pledge.title}</strong>
                  <span className="muted">
                    {pledge.pledge_id}, {KIND_LABEL[pledge.kind]}, {hostOf(pledge.pledge_url)}
                    {pledge.status === 'RETIRED' ? ', retired' : ''}
                    {pledge.integrity_state === 'EDITED' ? ', page edited' : ''}
                  </span>
                </span>
                <span role="cell">
                  <StandingChip standing={pledge.standing} />
                </span>
                <span role="cell">
                  <Strikes count={pledge.strikes} />
                </span>
                <span role="cell" className="muted">
                  {plural(pledge.audits, 'audit')}
                </span>
                <span role="cell" className="muted">
                  {formatDate(pledge.registered_at)}
                </span>
              </Link>
            ))}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="pager">
            <button type="button" className="btn btn--small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              Newer
            </button>
            <span className="muted">
              {offset + 1} to {Math.min(total, offset + PAGE_SIZE)} of {total}
            </span>
            <button
              type="button"
              className="btn btn--small"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Older
            </button>
          </div>
        )}
      </section>
    </>
  );
}
