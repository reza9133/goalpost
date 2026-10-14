# Goalpost on Studionet (Kept)

A faithful restatement of the frozen pledge.

- Contract: 0xe0167DeFD7b55bd4C120092Ee340078077186c3f
- Site serving the evidence pages: https://goalpost-8wf.pages.dev
- Signer: 0xD3b505BFE469ea7E0582010C9cA9F583eA6Ab9Dd
- Run started (UTC): 2026-10-14T10:06:13.654Z
- Pledge: PLG-0001

## Transactions

| # | call | note | hash | decision | execution | finality | validator votes |
|---|---|---|---|---|---|---|---|
| 1 | `register_pledge` | freeze the pledge | [0xc9a7c5d8c0fabf6a2b70bf1fc05eaac0a4a06dfc087e1aadd46b4fb9885314dc](https://explorer-studio.genlayer.com/tx/0xc9a7c5d8c0fabf6a2b70bf1fc05eaac0a4a06dfc087e1aadd46b4fb9885314dc) | ACCEPTED | success | ACCEPTED (not final when recorded) | 3 agree, 0 disagree, 2 other (of 5) |
| 2 | `submit_report` | queue the report | [0x439adf91eb5666bc4a87be0af27cd167dfa007869287f83661ff1142209e2204](https://explorer-studio.genlayer.com/tx/0x439adf91eb5666bc4a87be0af27cd167dfa007869287f83661ff1142209e2204) | ACCEPTED | success | ACCEPTED (not final when recorded) | 3 agree, 0 disagree, 2 other (of 5) |
| 3 | `evaluate_report` | validators read the report; this can take minutes | [0x3d9480e27806421d8e3b6df7cc4a511903b3c51b9932d2b79d63c3d0c13d59dd](https://explorer-studio.genlayer.com/tx/0x3d9480e27806421d8e3b6df7cc4a511903b3c51b9932d2b79d63c3d0c13d59dd) | ACCEPTED | success | ACCEPTED (not final when recorded) | 3 agree, 0 disagree, 2 other (of 5) |

## Outcomes

- evaluate_report: decided ACCEPTED, execution success, ACCEPTED (not final when recorded)
- verdict KEPT (expected for this report: KEPT, matches)
- attestation recomputes on chain to the stored value: yes

## Settled audit

| Property | Value |
|---|---|
| Audit ID | `AUD-0001` |
| Report | https://goalpost-8wf.pages.dev/evidence/meridian/reports/2026-faithful.html |
| Verdict | `KEPT` |
| State | `SETTLED` |
| Silent keys | `[]` |
| Pledge standing | `HELD` (silent moves on record: 0) |
| Pledge commitment digest | `0xa986be1a2b11eaa3eedbfae1a101b6da7937e58cbb95eca1e59c7c35e5ca42c0` |
| Attestation digest | `0x89c4cd66388af5937f75b4621b661c28c0d6dc37c3ee328d882daa8d602a0e6a` |

### Element classifications

- **emissions_target**: `KEPT`
  - report excerpt: "Against our 2019 baseline, our absolute Scope 1 and Scope 2 greenhouse gas emissions fell 17% by the end of 2025, keeping us on course for our 40% reduction by 2030."
  - reason: "The report maintains the same baseline, scope, target percentage, and deadline."
- **target_scope**: `KEPT`
  - report excerpt: "The target continues to apply to every wholly owned power plant and excludes no facility."
  - reason: "The scope definition remains identical to the pledge."
- **assurance**: `KEPT`
  - report excerpt: "Progress continues to be verified each year by an independent third-party assurance provider."
  - reason: "The verification method remains the same."

## Notes

- Ledger stats after the run: {"audits":1,"edits_detected":0,"pledges":1,"settled":1,"silent_moves":0}
