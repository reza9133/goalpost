# Goalpost on Studionet (Disclosed change)

A report that changes the definition and says so.

- Contract: 0xe0167DeFD7b55bd4C120092Ee340078077186c3f
- Site serving the evidence pages: https://goalpost-8wf.pages.dev
- Signer: 0xD3b505BFE469ea7E0582010C9cA9F583eA6Ab9Dd
- Run started (UTC): 2026-10-14T10:06:13.654Z
- Pledge: PLG-0001

## Transactions

| # | call | note | hash | decision | execution | finality | validator votes |
|---|---|---|---|---|---|---|---|
| 1 | `register_pledge` | freeze the pledge | [0x55185477e81016be018c3a65843409207796b1a34613e12a1f78ec293e4a4957](https://explorer-studio.genlayer.com/tx/0x55185477e81016be018c3a65843409207796b1a34613e12a1f78ec293e4a4957) | ACCEPTED | failed | not reached | 3 agree, 0 disagree, 2 other (of 5) |
| 2 | `submit_report` | queue the report | [0x1702450d2b7f210f637cd2965ea603bdf8637197bf3c626e1b06a106d0902fc3](https://explorer-studio.genlayer.com/tx/0x1702450d2b7f210f637cd2965ea603bdf8637197bf3c626e1b06a106d0902fc3) | ACCEPTED | failed | not reached | 3 agree, 0 disagree, 2 other (of 5) |
| 3 | `evaluate_report` | validators read the report; this can take minutes | [0xce1ce390d66f3bded9e122611911ecafee4e4f3df19f13ba016ad4b5f2da9c4f](https://explorer-studio.genlayer.com/tx/0xce1ce390d66f3bded9e122611911ecafee4e4f3df19f13ba016ad4b5f2da9c4f) | ACCEPTED | success | ACCEPTED (not final when recorded) | 3 agree, 0 disagree, 2 other (of 5) |

## Outcomes

- evaluate_report: decided ACCEPTED, execution success, ACCEPTED (not final when recorded)
- verdict MOVED_DISCLOSED (expected for this report: MOVED_DISCLOSED, matches)
- attestation recomputes on chain to the stored value: yes

## Settled audit

| Property | Value |
|---|---|
| Audit ID | `AUD-0003` |
| Report | https://goalpost-8wf.pages.dev/evidence/meridian/reports/2026-disclosed.html |
| Verdict | `MOVED_DISCLOSED` |
| State | `SETTLED` |
| Silent keys | `[]` |
| Pledge standing | `REVISED` (silent moves on record: 1) |
| Pledge commitment digest | `0xa986be1a2b11eaa3eedbfae1a101b6da7937e58cbb95eca1e59c7c35e5ca42c0` |
| Attestation digest | `0x99133eef2403d2e2c80148cd80437d78aa53167a599ae7a40deb72dd795a748e` |

### Element classifications

- **emissions_target**: `MOVED_DISCLOSED`
  - report excerpt: "Our target is now a 40% reduction in emissions intensity per megawatt-hour by 2035, against a 2022 baseline."
  - disclosure excerpt: "It replaces the absolute 2030 target, and we set out the reasons for the change in Section 4."
  - reason: "The report explicitly changes the metric, deadline, and baseline from the pledge."
- **target_scope**: `MOVED_DISCLOSED`
  - report excerpt: "The revised target excludes assets held for sale."
  - disclosure excerpt: "This is a change from the original pledge and is explained in Section 4."
  - reason: "The report explicitly narrows the scope compared with the no-exclusions pledge."
- **assurance**: `KEPT`
  - report excerpt: "Progress continues to be verified each year by an independent third-party assurance provider."
  - reason: "The report uses the same annual independent third-party assurance definition."

## Notes

- Ledger stats after the run: {"audits":3,"edits_detected":0,"pledges":1,"settled":3,"silent_moves":1}
