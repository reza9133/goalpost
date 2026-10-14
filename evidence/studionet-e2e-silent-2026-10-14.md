# Goalpost on Studionet (Silent move)

A report that redefines the target and its scope without saying so.

- Contract: 0xe0167DeFD7b55bd4C120092Ee340078077186c3f
- Site serving the evidence pages: https://goalpost-8wf.pages.dev
- Signer: 0xD3b505BFE469ea7E0582010C9cA9F583eA6Ab9Dd
- Run started (UTC): 2026-10-14T10:06:13.654Z
- Pledge: PLG-0001

## Transactions

| # | call | note | hash | decision | execution | finality | validator votes |
|---|---|---|---|---|---|---|---|
| 1 | `register_pledge` | freeze the pledge | [0xc67cca83c1dc0a0de87fda4d8342a7f70dad5807311db4b7e7b3f6b2fe57ac86](https://explorer-studio.genlayer.com/tx/0xc67cca83c1dc0a0de87fda4d8342a7f70dad5807311db4b7e7b3f6b2fe57ac86) | ACCEPTED | failed | not reached | 5 agree, 0 disagree (of 5) |
| 2 | `submit_report` | queue the report | [0xc326933024800c0fd77b5d47032c639bb01450dc634fff0284a01afb35fc6641](https://explorer-studio.genlayer.com/tx/0xc326933024800c0fd77b5d47032c639bb01450dc634fff0284a01afb35fc6641) | ACCEPTED | success | ACCEPTED (not final when recorded) | 3 agree, 0 disagree, 2 other (of 5) |
| 3 | `evaluate_report` | validators read the report; this can take minutes | [0x006bdb38d27369bec8c825b6452763a8c84396d1c7b12239f1d8f193d9aa9e5c](https://explorer-studio.genlayer.com/tx/0x006bdb38d27369bec8c825b6452763a8c84396d1c7b12239f1d8f193d9aa9e5c) | ACCEPTED | success | ACCEPTED (not final when recorded) | 3 agree, 1 disagree, 1 other (of 5) |

## Outcomes

- evaluate_report: decided ACCEPTED, execution success, ACCEPTED (not final when recorded)
- verdict MOVED_SILENTLY (expected for this report: MOVED_SILENTLY, matches)
- attestation recomputes on chain to the stored value: yes

## Settled audit

| Property | Value |
|---|---|
| Audit ID | `AUD-0002` |
| Report | https://goalpost-8wf.pages.dev/evidence/meridian/reports/2026-silent.html |
| Verdict | `MOVED_SILENTLY` |
| State | `SETTLED` |
| Silent keys | `["emissions_target","target_scope"]` |
| Pledge standing | `BREACHED` (silent moves on record: 1) |
| Pledge commitment digest | `0xa986be1a2b11eaa3eedbfae1a101b6da7937e58cbb95eca1e59c7c35e5ca42c0` |
| Attestation digest | `0xce1a94d3922ee535a9c648d4e27b54b30ec42ad61b18af6c16a174c6ef858cb4` |

### Element classifications

- **emissions_target**: `MOVED_SILENT`
  - report excerpt: "We will cut our emissions intensity of Scope 1 and Scope 2 greenhouse gas emissions by 40% by 2035, measured against our 2022 baseline."
  - reason: "Metric shifted from absolute to intensity and baseline/deadline changed without any acknowledgment."
- **target_scope**: `MOVED_SILENT`
  - report excerpt: "The target applies to plants in our continuing portfolio; assets held for sale are not included."
  - reason: "Scope narrowed from every wholly owned plant to continuing portfolio, silently excluding assets held for sale."
- **assurance**: `KEPT`
  - report excerpt: "Progress continues to be verified each year by an independent third-party assurance provider."
  - reason: "Annual independent third-party verification is unchanged."

## Notes

- Ledger stats after the run: {"audits":2,"edits_detected":0,"pledges":1,"settled":2,"silent_moves":1}
