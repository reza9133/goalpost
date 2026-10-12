import { Link } from 'react-router-dom';

import { Chip, StandingChip, VerdictChip } from '../components/Chips';
import { useDocumentTitle } from '../lib/hooks';

export function HowPage() {
  useDocumentTitle('How it works');
  return (
    <article className="prose">
      <h1 className="display display--page">How Goalpost decides</h1>
      <p className="lede">
        Goalpost has one job: tell whether a published report still measures the thing that was promised. It does not tell you whether
        the promise was achieved.
      </p>

      <h2>Four steps</h2>
      <ol className="prose__steps">
        <li>
          <strong>Freeze.</strong> Someone names a public page and quotes the sentences that define a commitment. Every validator fetches the
          page and confirms each quote is there verbatim. Only then are the quotes frozen on chain. The person registering cannot supply
          words the pledger never published, and the contract only reads the visible text of the page: text hidden in scripts, styles or
          comments does not count.
        </li>
        <li>
          <strong>Submit.</strong> Anyone submits a report address. It must sit under the reporting prefix chosen at registration, on the
          same host as the pledge. Anything else is refused immediately, without touching the network.
        </li>
        <li>
          <strong>Evaluate.</strong> Anyone asks the validators to read the report. Each validator independently classifies every frozen
          element and quotes the report as evidence. The contract checks every quote against the page text before believing it.
        </li>
        <li>
          <strong>Agree.</strong> Validators must agree on the verdict and on exactly which elements moved silently. If they cannot, nothing
          is written and the network tries again with another leader.
        </li>
      </ol>

      <h2>What each element can be</h2>
      <dl className="defs">
        <div>
          <dt>Same definition</dt>
          <dd>The report uses the pledged metric, basis, baseline, scope, deadline and level. Progress figures alone do not change a definition.</dd>
        </div>
        <div>
          <dt>Changed, disclosed</dt>
          <dd>The definition changed and the report says so. Both the new wording and the acknowledgement must be quoted from the report.</dd>
        </div>
        <div>
          <dt>Changed silently</dt>
          <dd>The definition changed and the report gives no sign of it. The new wording must be quoted from the report.</dd>
        </div>
        <div>
          <dt>Not addressed</dt>
          <dd>The report does not mention this commitment at all.</dd>
        </div>
        <div>
          <dt>Not verifiable</dt>
          <dd>The evidence the model offered did not hold up against the source. The contract treats this as neither good nor bad.</dd>
        </div>
      </dl>

      <h2>The verdict</h2>
      <p>The verdict is computed by the contract from the element statuses, strictest first. A model never writes it.</p>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Verdict</th>
            <th scope="col">When</th>
            <th scope="col">Pledge standing becomes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <VerdictChip verdict="MOVED_SILENTLY" />
            </td>
            <td>At least one element changed silently, with evidence.</td>
            <td>
              <StandingChip standing="BREACHED" /> and one silent move is added to the permanent count
            </td>
          </tr>
          <tr>
            <td>
              <VerdictChip verdict="INCONCLUSIVE" />
            </td>
            <td>Something could not be verified, or the report could not be read.</td>
            <td>
              <Chip tone="neutral">Unchanged</Chip>
            </td>
          </tr>
          <tr>
            <td>
              <VerdictChip verdict="MOVED_DISCLOSED" />
            </td>
            <td>At least one element changed, and every change is acknowledged.</td>
            <td>
              <StandingChip standing="REVISED" />
            </td>
          </tr>
          <tr>
            <td>
              <VerdictChip verdict="INCOMPLETE" />
            </td>
            <td>Nothing changed, but some elements are not addressed.</td>
            <td>
              <StandingChip standing="PARTIAL" />
            </td>
          </tr>
          <tr>
            <td>
              <VerdictChip verdict="KEPT" />
            </td>
            <td>Every element is restated with the same definition.</td>
            <td>
              <StandingChip standing="HELD" />
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Standing describes the most recently submitted conclusive audit, even if an older report is evaluated later. The silent-move count only ever goes up, so a later clean report cannot erase
        history.
      </p>

      <h2>Anchors make the contract strict</h2>
      <p>
        An anchor is a word or number from a pledged sentence that defines it, such as <em>absolute</em>, <em>2019</em> or <em>40%</em>. Every
        frozen element needs at least one. Two rules follow, and both are enforced by the contract rather than by the model:
      </p>
      <ul>
        <li>
          A report cannot be called <em>unchanged</em> unless the excerpt backing that claim still carries every anchor.
        </li>
        <li>
          A report cannot be accused of a <em>silent change</em> if every anchor survives in the very excerpt used to accuse it.
        </li>
      </ul>
      <p>
        So an accusation needs evidence on both sides, and a clean bill of health needs the pledge&rsquo;s own words to still be there.
      </p>
      <p>Three more rules keep a claim of change honest. The contract enforces them too:</p>
      <ul>
        <li>
          An excerpt offered as proof that a commitment <em>changed</em>, silently or openly, must share content with the pledged sentence.
          A sentence about something else is not evidence about this commitment.
        </li>
        <li>
          A <em>disclosed</em> change needs a disclosure that reads as an admission of change. A report that admits a change may quote the
          old wording while doing so, so the anchor rule above does not apply to it.
        </li>
        <li>
          If the report is longer than the part validators read, <em>not addressed</em> cannot be concluded, because the commitment may sit
          in the part that was cut off. The audit is then not verifiable instead of incomplete.
        </li>
      </ul>

      <h2>What the contract refuses to trust</h2>
      <ul>
        <li>
          <strong>The registrant.</strong> Frozen quotes must exist on the live page, checked by validators, not supplied.
        </li>
        <li>
          <strong>The report text.</strong> It reaches the model as fenced, untrusted data and can only influence the result through a
          fixed vocabulary of statuses plus excerpts that are re-verified against the source.
        </li>
        <li>
          <strong>The leader.</strong> Validators repeat the whole fetch and judgement themselves, and they must find every excerpt the
          leader cited in their own copy of the report.
        </li>
        <li>
          <strong>The model.</strong> A model that returns nothing usable, or cites text that is not there, yields an inconclusive result,
          never an accusation and never reassurance.
        </li>
      </ul>

      <h2>Where it can still be wrong</h2>
      <ul>
        <li>Deciding whether two definitions are the same is a judgement. Validators can disagree, in which case nothing is written.</li>
        <li>Pages are read as text without running scripts, and only the first part of a long report is considered.</li>
        <li>
          Standing follows the most recently evaluated conclusive report. The full list of audits stays visible, so selective submission
          shows, but the contract does not rank reports by date.
        </li>
        <li>This runs on Studionet, a test network. Records demonstrate the mechanism and carry no legal weight.</li>
      </ul>

      <p style={{ marginTop: '2rem' }}>
        <Link className="btn btn--primary" to="/new">
          Register a pledge
        </Link>
      </p>
    </article>
  );
}
