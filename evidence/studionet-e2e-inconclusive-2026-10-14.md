# Goalpost on Studionet (Inconclusive)

A report page that carries no readable text. Validators agree on the unreadable outcome without any model call, so the audit settles INCONCLUSIVE and the pledge standing is unchanged.

- Contract: 0xe0167DeFD7b55bd4C120092Ee340078077186c3f
- Site serving the evidence pages: https://goalpost-8wf.pages.dev
- Signer: 0xD3b505BFE469ea7E0582010C9cA9F583eA6Ab9Dd
- Run started (UTC): 2026-10-14T10:06:13.654Z
- Pledge: PLG-0001

## Transactions

| # | call | note | hash | decision | execution | finality | validator votes |
|---|---|---|---|---|---|---|---|
| 1 | `register_pledge` | freeze the pledge | [0x84f9f5d85c4f931038ea81f3c580c632d65a63ecb1d2940613256aa90a266016](https://explorer-studio.genlayer.com/tx/0x84f9f5d85c4f931038ea81f3c580c632d65a63ecb1d2940613256aa90a266016) | ACCEPTED | failed | not reached | 5 agree, 0 disagree (of 5) |
| 2 | `submit_report` | queue the report | [0x710dd0e2b49713b30d910d145cacb022f41cd3bce2cc4829194af23190c1cc3b](https://explorer-studio.genlayer.com/tx/0x710dd0e2b49713b30d910d145cacb022f41cd3bce2cc4829194af23190c1cc3b) | ACCEPTED | failed | not reached | 3 agree, 0 disagree, 2 other (of 5) |
| 3 | `evaluate_report` | validators read the report; this can take minutes | [0x461726e61ded123b757a7a44e1c3401c2e7c74c0b2848c093c3856eca6428c46](https://explorer-studio.genlayer.com/tx/0x461726e61ded123b757a7a44e1c3401c2e7c74c0b2848c093c3856eca6428c46) | ACCEPTED | success | ACCEPTED (not final when recorded) | 3 agree, 0 disagree, 2 other (of 5) |

## Outcomes

- evaluate_report: decided ACCEPTED, execution success, ACCEPTED (not final when recorded)
- verdict INCONCLUSIVE (expected for this report: INCONCLUSIVE, matches)
- attestation recomputes on chain to the stored value: yes

## Settled audit

| Property | Value |
|---|---|
| Audit ID | `AUD-0004` |
| Report | https://goalpost-8wf.pages.dev/evidence/meridian/reports/2026-withheld.html |
| Verdict | `INCONCLUSIVE` |
| State | `SETTLED` |
| Failure reason | `EMPTY` |
| Silent keys | `[]` |
| Pledge standing | `REVISED` (silent moves on record: 1) |
| Pledge commitment digest | `0xa986be1a2b11eaa3eedbfae1a101b6da7937e58cbb95eca1e59c7c35e5ca42c0` |
| Attestation digest | `0xde29c127f1185f97c4e7e527418417f30d836aea963a8c8ba25e76ae4ffeb878` |

## Notes

- Ledger stats after the run: {"audits":4,"edits_detected":0,"pledges":1,"settled":4,"silent_moves":1}
