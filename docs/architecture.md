# Architecture

## Components

```
  Browser (static site on Cloudflare Pages)
     |  reads: contract views (JSON text)        writes: signed transactions
     v
  GenLayer Studionet RPC  <----(optional same-origin proxy: functions/rpc.ts)
     |
     v
  Goalpost Intelligent Contract
     |  non-deterministic blocks (leader + validators run independently)
     v
  Public web: pledge pages and report pages (e.g. /evidence on the same Pages site)
```

The contract holds all state and all rules. The web console is a thin reader and signer: it never decides
anything the contract does not already enforce. Its form validation is a convenience mirror, kept in step
with the contract by a differential test.

## Contract

### Storage

All records are canonical JSON text. This keeps the storage layout flat (three maps and five counters),
makes every record directly readable from any client, and avoids nested storage types.

| Field | Type | Meaning |
| --- | --- | --- |
| `pledges` | `TreeMap[str, str]` | `PLG-0001` to pledge record |
| `audits` | `TreeMap[str, str]` | `AUD-0001` to audit record |
| `commitments` | `TreeMap[str, str]` | duplicate-detection digest to pledge id (rejects duplicates) |
| `pledge_seq`, `audit_seq` | `u256` | id counters |
| `settled_total`, `silent_total`, `edit_total` | `u256` | statistics |

### Pledge record

`pledge_id, title, kind, owner, pledge_url, report_prefix, elements[], commitment, status, registered_at,
retired_at, standing, last_verdict, last_audit_id, strikes, audit_ids[], integrity{state, checked_at,
edits_detected, log[]}`

An element is `{key, dimension, quote, anchors[]}`. The commitment is the SHA-256 of a canonical JSON
encoding of `{pledge_url, report_prefix, elements}`, where each element contributes its key, dimension, normalised quote
and normalised, sorted anchors. It excludes title and registrant and ignores case, typography and whitespace.
Keys stay in because attestations name elements by key. Duplicate detection uses a second, label-free digest
(quotes and anchors only, ordered by quote), so a pledge cannot be registered twice by renaming or reordering
its elements.

### Audit record

`audit_id, pledge_id, report_url, period, state, verdict, silent_keys[], elements[], failure_reason,
submitted_by, submitted_at, evaluated_by, evaluated_at, attestation`

Each audit element is `{key, status, report_excerpt, disclosure_excerpt, reason, flag}`.

### Lifecycle

```
register_pledge  --consensus: every quote found on the live page-->  pledge ACTIVE
                                                                       |
check_pledge_integrity  (anytime)  ---> INTACT | EDITED | UNREACHABLE  |
                                                                       v
submit_report  (deterministic)  --> audit PENDING
evaluate_report (consensus)     --> audit SETTLED  (verdict, attestation) --> pledge standing, strikes
retire_pledge (registrant)      --> pledge RETIRED (history kept)
```

An `INCONCLUSIVE` audit settles but does not change standing and does not block submitting the same URL
again. A conclusive audit does block re-submission of that URL; corrections are published at a new URL.

### Views

`contract_info`, `stats`, `list_pledges(offset, limit)`, `get_pledge_bundle(id)`, `get_audit_bundle(id)`,
`standing_of(id)`, `strikes_of(id)`, `recompute_attestation(id)`. The two bundle views return a whole
page's worth of data in one call, because Studionet rate-limits contract reads.

### Deterministic gates

These run before any network access or model call, and fail with a readable message:

- title, kind, element count, quote and anchor bounds, key format, duplicate keys and quotes
- (audit rules, see below) excerpt relevance, disclosure wording and truncation
- every element needs at least one anchor, and every anchor must occur in its own quote
- hosts whose last label is a number (`0x7f.0.0.1`, `127.0.0.0x1`, `127.1`) are refused: URL parsers read them as IPv4
- report URLs and the reporting prefix must not contain a query string, so one report cannot be resubmitted under new spellings to collect strikes
- duplicate detection compares a folded key (`_report_key`), not the raw string: trailing or doubled slashes, `;param` suffixes, percent-escapes of unreserved characters and letter case do not make a second report. The stored URL is left as submitted. `index.html` versus the bare directory is not folded.
- URLs must not contain dot segments (`.`, `..`) or percent-encoded dots and slashes (`%2e`, `%2f`, `%5c`) in the path, so the string prefix test on a report URL cannot be escaped
- URLs: https only, no credentials, fragment, backslash, port or IP literal, public DNS host only
- report prefix ends with `/`, shares the pledge's host **and lies inside the pledge's publisher scope** (see Publisher authority below)
- a report URL must start with the frozen prefix and share its host (so `site.com.evil.com` cannot pass)
- duplicate pledge, duplicate or already-audited report, audit limit per pledge (inconclusive attempts do not count toward it, but stored attempts are capped at twice the limit), retired pledge

### Non-deterministic blocks

There are exactly two, both in module-level helpers and both using `gl.vm.run_nondet_unsafe`:

| Block | Leader returns | Validators accept when |
| --- | --- | --- |
| `_run_scan` (register, integrity) | `{ok, present{key: bool, "@reporting_authority": bool}}` or `{ok:false, reason}` | they fetched the same page and see the same presence map (frozen quotes **and** the declaration of the reporting prefix), or the same failure class |
| `_run_audit` (evaluate) | `{ok, verdict, silent_keys, elements[]}` or `{ok:false, reason}` | their own full re-run gives the same verdict, the same silent set **and the same status for every frozen element, key by key**, and every excerpt the leader cited exists in the validator's own copy of the report |

Expected failures (unreachable page, 404, 5xx, empty page) are returned as values with a coarse class, never
raised, so validators can agree on them. Unexpected errors (for example the model failing) make the
validator disagree, which rotates the leader. Free-text reasons may differ between validators.

### Publisher authority (1.3.0)

A hostname is not a publisher. Hostname equality let an unrelated tenant of a shared host (a gist, a GitHub
account, a Medium page) supply reports against another party's pledge. A reporting prefix is now accepted at
registration only if both of these hold:

1. **Scope.** The prefix lies in the same *publisher scope* as the pledge URL. The scope is the host, plus the
   publisher namespace on hosts that serve many publishers (`github.com/<owner>`, `gist.githubusercontent.com/<user>`,
   `medium.com/@<user>`, `sites.google.com/view/<site>`; see `_PATH_TENANT_HOSTS`, which `contract_info` exposes).
   Hosts that give a publisher no namespace at all (paste sites, file lockers; `_FLAT_SHARED_HOSTS`) cannot carry
   a pledge. This check is deterministic and runs before any network access.
2. **Declaration.** The pledge page itself, fetched by every validator, names the prefix: either
   `<link rel="goalpost-reports" href="...">` / `<meta name="goalpost-reports" content="...">` (relative links are
   resolved against the pledge URL) or the https address written out in the visible text. Ordinary navigation links
   do not count, so a home link cannot authorise a whole host. A declared directory authorises itself and anything
   below it, never a directory above it. Declarations inside comments, scripts, styles and `noscript` do not count.

The declaration travels through the same equivalence rule as the frozen quotes (it is the `@reporting_authority`
entry of the presence map), so validators must agree on it. `check_pledge_integrity` re-checks it: a page that
withdraws its declaration is recorded as an edit, like a vanished quote. The pledge record stores
`authority: {scope, method: "PLEDGE_PAGE_DECLARATION"}`.

### How a model answer becomes a verdict

1. The model sees the frozen quotes and the report text, both fenced as untrusted data, and may only answer
   with a status per element from a fixed vocabulary plus verbatim excerpts.
2. `_judge_element` verifies each excerpt against the report text, applies the anchor rules, and downgrades
   anything unsupported to `UNSUPPORTED`.
3. `_aggregate` derives the verdict from the statuses: silent move, then unverifiable, then disclosed
   change, then omission, then kept.
4. After consensus, `_validate_outcome` re-derives the verdict and silent set from the recorded statuses and
   refuses to store a result that does not follow from them.

### Attestation

`sha256` of a canonical encoding of `{audit_id, pledge_id, pledge_commitment, report_url, period, verdict,
elements[{key, status, report_excerpt, disclosure_excerpt}], evaluated_at}`. `recompute_attestation` rebuilds
it from stored state, so a third party can verify a copy without trusting it.

## Web console

| Module | Role |
| --- | --- |
| `lib/chain.ts` | The only file that imports `genlayer-js`: clients, cached/retried reads, sending and watching transactions, wallet helpers |
| `lib/receipt.ts` | Pure transaction-object parsing (status, execution result, ids). No SDK import, fully tested |
| `lib/validate.ts` | Client mirror of the contract's input rules |
| `lib/diff.ts` | Word-level redline between pledged and reported text. Display only |
| `lib/session.ts`, `lib/identity.tsx` | Session key or wallet identity |
| `lib/tx.tsx`, `components/TxPanel.tsx` | One transaction at a time, with visible progress |
| `lib/api.ts` | Contract-shaped read and write wrappers |
| `pages/*` | Ledger, Register, Pledge, Audit, How |

Reads are cached for a few seconds, de-duplicated while in flight, and retried with backoff. A failed
refresh keeps the last good data on screen.

### Transaction completion in the console

A transaction is reported as completed only with two separate facts: the validators decided it, and the contract
call itself ran successfully (`executionOf` finds an explicit `SUCCESS` / `FINISHED_WITH_RETURN`; a missing or
unreadable result is `unknown` and is never shown as completed). The decision has two levels that the console never
merges: `ACCEPTED` (agreed, still open to appeal; shown as "ACCEPTED, not final") and `FINALIZED` (cannot change).
After an accepted transaction the console keeps polling in the background until the network reports `FINALIZED`; if
the transaction is reopened or overturned the panel says so. `scripts/lib.mjs` applies the same rules
(`describeDecision`, `--await-finality`).

## Evidence rules added in 1.2.0

`_judge_element` applies these after it has verified that a cited excerpt really occurs in the report:

- **Relevance.** A `MOVED_SILENT` or `MOVED_DISCLOSED` claim needs a report excerpt that shares at least one content
  word (numbers as written, other words cut to a 5 letter stem) with the frozen quote. Flag: `excerpt_unrelated_to_pledge`.
- **Disclosure wording.** `MOVED_DISCLOSED` needs a disclosure excerpt that contains a change marker
  (`changed`, `revised`, `instead`, `no longer`, ...). English only and generous on purpose; anything else fails closed.
  Flag: `disclosure_not_about_a_change`. The anchor veto does not apply to disclosed moves, because an honest report
  usually quotes the old definition while admitting the change.
- **Truncation.** The report is cut at `MAX_REPORT_CHARS`. When it was, `NOT_ADDRESSED` is refused, since absence cannot
  be proven from part of a document. Flag: `report_truncated_absence_unproven`.
- **Leader claims are re-judged.** Validators no longer only compare the verdict and the silent set. They also run
  every per-element claim of the leader through `_judge_element` against their own copy of the report and require the
  same status, so a leader cannot slip in a `KEPT` without its anchors or a move claim with unrelated evidence.
- **Every classification is compared (1.3.0).** `_audit_equivalent` also compares `(key, status)` for every frozen
  element between the leader and the validator, in frozen order. Two outcomes with the same verdict and silent set but
  a different status on any element (for example one element `NOT_ADDRESSED` against `MOVED_DISCLOSED`) are different
  findings and are not equivalent. The verdict must also follow from the leader's own statuses. The cost: validators
  must agree element by element, so a genuinely borderline element makes a round fail more often; nothing is written
  in that case and the audit can be evaluated again.

## Other behaviour added in 1.2.0

- Standing follows the most recently *submitted* conclusive audit (`standing_audit_seq`). An older report evaluated later
  still counts as history and earns its strike, but does not overwrite the newer standing. A genuinely old report that
  is submitted late is still the newest submission; periods are free text, so the contract cannot order by them.
- `integrity.edits_detected` counts edit episodes, not checks. A page that is still edited when checked again adds
  nothing; losing further quotes, or a new edit after a restore, adds one. Episodes are kept in `integrity.edits`,
  separate from the rolling `integrity.log`, so repeated checks cannot push them out.
