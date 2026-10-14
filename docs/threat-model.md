# Threat model

Goalpost is a record-keeper and adjudicator. It holds no value and moves no value, so the assets at stake
are the **integrity of the record** and **the fairness of its verdicts**. The table maps each threat to the
rule that defends against it and the test that proves the rule.

Test names refer to files under `tests/`.

## Threats and defences

| # | Threat | Defence | Test |
| --- | --- | --- | --- |
| 1 | A registrant freezes words the pledger never published | Every quote must be found on the live page by every validator before anything is stored | `test_the_registrant_cannot_supply_a_quote_the_page_does_not_contain` |
| 2 | Quotes seeded from text a human cannot see (scripts, styles, comments) | The HTML extractor drops those regions; quotes are matched against visible text only | `test_text_hidden_in_scripts_comments_or_styles_cannot_seed_a_baseline`, `test_scripts_styles_and_comments_are_removed` |
| 3 | A dishonest leader reports a page the validators do not see | Validators fetch independently and compare the presence map | `test_a_dishonest_leader_cannot_pass_a_page_the_validators_do_not_see` |
| 4 | A dishonest leader cites evidence that is not in the report | Every cited excerpt must exist in each validator's own copy of the report | `test_a_leader_that_sees_a_forged_report_is_rejected_by_validators_who_do_not`, `test_audit_equivalence_rejects_an_excerpt_the_validator_cannot_find` |
| 5 | The model fabricates evidence | Excerpts are re-verified by the contract; unverifiable claims become `UNSUPPORTED` and the audit `INCONCLUSIVE` | `test_a_model_that_invents_evidence_never_produces_a_verdict` |
| 6 | Prompt injection in the report text | Report text is fenced as untrusted data; influence is limited to a fixed status vocabulary plus verified excerpts; the anchor gate blocks a bought "unchanged" | `test_prompt_injection_in_the_report_cannot_buy_a_clean_verdict` |
| 7 | A false accusation of a silent move | `MOVED_SILENT` needs a verified excerpt that shares content with the pledged sentence and is rejected if every pledge anchor survives in that excerpt | `test_a_false_accusation_is_rejected_when_the_pledge_anchors_survive_in_the_cited_text` |
| 8 | A false clean bill of health | `KEPT` needs a verified excerpt that still carries every anchor | `test_kept_without_an_anchor_is_unsupported` |
| 9 | An unrelated page audited as "the report" | Report URL must start with the frozen prefix and share its host; host and prefix are compared exactly; URLs with dot segments or encoded dots/slashes are rejected, so the prefix cannot be escaped with `..` | `test_reports_must_live_under_the_frozen_prefix` |
| 9a | An unrelated publisher on a shared host supplies reports against another party's pledge (hostname equality is not publisher equality) | The reporting prefix must lie in the pledge's publisher scope (host, plus the publisher namespace on multi-tenant hosts) and the pledge page itself must declare it; validators agree on the declaration; withdrawing it is a recorded integrity edit; hosts with no publisher namespace are refused | `tests/test_authority.py` (`SharedHostTests`, `RegistrationAuthorityTests`, `IntegrityOfTheDeclarationTests`) |
| 10 | Lookalike hosts (`goalpost.example.evil.com`) | Hosts are compared for equality, not by string prefix | same test |
| 11 | SSRF through user-supplied URLs | https only; no credentials, ports, IP literals (including hex, octal and short IPv4 spellings), private or single-label hosts; GenVM also isolates web access | `test_rejections` (URL), `test_url_rules_agree_with_the_contract_on_every_input` |
| 12 | The pledge page is silently edited after registration | `check_pledge_integrity` re-fetches under consensus; an edit is recorded permanently and the frozen baseline is unaffected | `test_a_silent_edit_of_the_pledge_is_detected_and_recorded_permanently` |
| 13 | Rewriting history after a breach | Silent-move count never decreases; standing follows the latest conclusive audit but the count and the full audit list stay | `test_standing_is_current_but_strikes_are_history` |
| 14 | Spam and griefing | Per-pledge audit cap, input bounds, duplicate-pledge and duplicate-report rejection; an inconclusive audit does not block a retry and does not use up the audit allowance, while stored attempts stay capped at twice the limit; query strings are refused and duplicate reports are matched on a folded URL key (slashes, `;params`, unreserved escapes, case), so one report cannot be resubmitted under new spellings to inflate strikes | `test_the_per_pledge_audit_limit`, `test_the_same_pledge_cannot_be_registered_twice` |
| 15 | A malformed or tampered agreed outcome | `_validate_outcome` re-derives verdict and silent set from the element statuses and rejects any mismatch | `OutcomeValidationTests` |
| 16 | Validators accepting a result that merely looks valid | Equivalence requires the same verdict, the same exact silent set **and the same status for every frozen element**, not just a well-formed answer | `test_validators_must_agree_on_which_elements_moved_not_only_on_the_verdict`, `tests/test_classification_consensus.py` |
| 16a | A publisher serving different documents to different validators (adversarial or merely unstable page) | Validators fetch independently; excerpts and per-element statuses must match; no agreement means nothing is written and the audit stays pending | `AdversarialPublisherTests`; live: `npm run evidence` (scenario `adversarial`) |
| 17 | Partial state after a failure | A transaction that raises rolls all writes back | `test_a_failed_registration_leaves_no_trace`, `test_validators_that_judge_differently_block_the_verdict_and_nothing_is_written` |
| 18 | Hash ambiguity (delimiter forgery) | Digests hash canonical JSON, never joined strings | `test_digest_has_no_delimiter_ambiguity` |
| 19 | Unauthorised retirement | Only the registrant may retire; history stays on chain | `test_only_the_registrant_can_retire_and_history_survives` |
| 19a | The console presenting an unfinished or failed transaction as done | Completion needs an explicit successful execution result; `ACCEPTED` (appealable) is shown as not final and only `FINALIZED` as final | `tests/node/receipt.mjs`, `tests/node/outcome.mjs` |
| 20 | Abuse of the optional RPC proxy | Fixed upstream, standard method families only (the Studio `sim_` methods are never forwarded), same-origin only, size and batch caps. The in-app test-token button calls `sim_fundAccount` on the public RPC from the browser, never through this proxy | `tests/node/rpc_proxy.mjs` |

## Client-side

- **Session key.** A throwaway key in `localStorage`. Studionet accounts need no funds, so a stolen key has no
  monetary value, but anyone with it can sign as that identity. The identity menu says so, and the key can be
  revealed and erased. Do not reuse a key that matters.
- **Rendering of untrusted text.** Report excerpts originate from third-party pages. They are rendered as
  React text nodes, never as HTML.
- **Headers.** `public/_headers` sets `nosniff`, frame denial, a strict referrer policy and a report-only CSP.

## Residual risks, stated plainly

1. **The judgement is a judgement.** Whether two definitions are the same can be genuinely ambiguous. Validators
   may disagree (nothing is written) or agree on a debatable call. The anchors and the evidence rules narrow
   this; they do not remove it.
2. **Cherry-picking.** Anyone may submit any report under the prefix, and standing follows the most recently
   evaluated conclusive audit. The full list is visible, so selection shows, but the contract does not rank
   reports by publication date.
3. **Dynamic pages.** Pages are read as text without running scripts. Content that needs JavaScript is not seen,
   and pages that change between fetches can prevent consensus.
4. **Truncation.** Only the first `MAX_REPORT_CHARS` characters (9000) of a report are considered.
5. **Publisher scope is a table, not a registry.** Reports must be on the pledge's host, inside the publisher
   namespace on the hosts listed in `_PATH_TENANT_HOSTS`, and named by the pledge page. A multi-tenant host that is
   not in the table is treated as having one publisher, so its tenants are only separated by the declaration. The
   declaration is trusted to be written by the page's publisher: a page that lets visitors post text (comments, wikis)
   could be made to carry one. A publisher that hosts reports elsewhere cannot be audited without registering a new
   pledge against a page on that host.
6. **Third-party registration.** Anyone can register a pledge about any public page. The quotes are real, but the
   registrant chooses which sentences to hold the pledger to. The frozen elements are public, so anyone can see
   what was and was not frozen.
7. **Testnet.** Studionet is a test network. Records carry no legal weight and may be reset.
8. **Unverified runtime assumptions.** See [decisions.md](decisions.md). The contract has not yet run on real
   GenVM; the first deployment is the real test.
