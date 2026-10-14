# Goalpost on Studionet (Adversarial publisher: validators read different documents)

The reporting address of this pledge is served by a script that returns a different Meridian report (faithful, silently redefined or disclosed) on every request. Independent validators therefore read different documents at the same URL. The contract only records a verdict that the validators share, on every element classification.

- Contract: 0xe0167DeFD7b55bd4C120092Ee340078077186c3f
- Site serving the evidence pages: https://goalpost-8wf.pages.dev
- Signer: 0x9d94000FA7757067f40447661634BD951F47ad88
- Run started (UTC): 2026-10-14T10:16:47.485Z
- Pledge: PLG-0002

## Transactions

| # | call | note | hash | decision | execution | finality | validator votes |
|---|---|---|---|---|---|---|---|
| 1 | `register_pledge` | freeze the pledge | [0xd08c5d95346fe3ad911d4ca9e0915545a2b9432c877f350e9639fdadb4fa4e63](https://explorer-studio.genlayer.com/tx/0xd08c5d95346fe3ad911d4ca9e0915545a2b9432c877f350e9639fdadb4fa4e63) | ACCEPTED | failed | not reached | 5 agree, 0 disagree (of 5) |
| 2 | `submit_report` | queue the report | [0xe5754af9b4051e8f0cb3a939113488c853532d152019929f2294146e00358811](https://explorer-studio.genlayer.com/tx/0xe5754af9b4051e8f0cb3a939113488c853532d152019929f2294146e00358811) | ACCEPTED | failed | not reached | 3 agree, 0 disagree, 2 other (of 5) |
| 3 | `evaluate_report` | attempt 1: each validator fetches a different document | [0xe38144112b18b41cdfa68c4a74f3dd3861f3e0af334c1a11435ba0aa00097519](https://explorer-studio.genlayer.com/tx/0xe38144112b18b41cdfa68c4a74f3dd3861f3e0af334c1a11435ba0aa00097519) | ACCEPTED | failed | not reached | 3 agree, 0 disagree, 2 other (of 5) |
| 4 | `submit_report` | queue the report | [0xb698a33207dd8ba5bcdd82511fab6b7677b9ec2ed227ae09f1b53c6cd4e6c893](https://explorer-studio.genlayer.com/tx/0xb698a33207dd8ba5bcdd82511fab6b7677b9ec2ed227ae09f1b53c6cd4e6c893) | ACCEPTED | success | ACCEPTED (not final when recorded) | 5 agree, 0 disagree (of 5) |
| 5 | `evaluate_report` | attempt 2: each validator fetches a different document | [0xc8ffdecebfe47c93f4aca3c82b1a349871409f54f716f96ce6bee396e323417a](https://explorer-studio.genlayer.com/tx/0xc8ffdecebfe47c93f4aca3c82b1a349871409f54f716f96ce6bee396e323417a) | ACCEPTED | success | ACCEPTED (not final when recorded) | 3 agree, 2 disagree (of 5) |
| 6 | `submit_report` | queue the report | [0x21af67eccb2c2e7f08f85f8a988d8afc7fa00f862d2c48f3fd5ad1a1658d06c0](https://explorer-studio.genlayer.com/tx/0x21af67eccb2c2e7f08f85f8a988d8afc7fa00f862d2c48f3fd5ad1a1658d06c0) | ACCEPTED | success | ACCEPTED (not final when recorded) | 3 agree, 0 disagree, 2 other (of 5) |
| 7 | `evaluate_report` | attempt 3: each validator fetches a different document | [0x3526714ec9bb64de8217e5e4d2e0a4f591ccb9ae4175eb819329419a883b58e4](https://explorer-studio.genlayer.com/tx/0x3526714ec9bb64de8217e5e4d2e0a4f591ccb9ae4175eb819329419a883b58e4) | ACCEPTED | success | ACCEPTED (not final when recorded) | 3 agree, 2 disagree (of 5) |

## Outcomes

- attempt 1 (AUD-0005): decided ACCEPTED but the contract call failed: Validator execution cancelled after quorum; on-chain audit state SETTLED, verdict MOVED_DISCLOSED; votes 3 agree / 0 disagree
- attempt 2 (AUD-0006): decided ACCEPTED, execution success, ACCEPTED (not final when recorded); on-chain audit state SETTLED, verdict KEPT; votes 3 agree / 2 disagree
- attempt 3 (AUD-0007): decided ACCEPTED, execution success, ACCEPTED (not final when recorded); on-chain audit state SETTLED, verdict KEPT; votes 3 agree / 2 disagree
- summary: 0 of 3 attempts ended without a recorded verdict, 3 settled on a majority reading

## Settled audit

| Property | Value |
|---|---|
| Audit ID | `AUD-0007` |
| Report | https://goalpost-8wf.pages.dev/evidence/flapping/reports/attempt-2026-10-14-1791973084111-3.html |
| Verdict | `KEPT` |
| State | `SETTLED` |
| Silent keys | `[]` |
| Pledge standing | `HELD` (silent moves on record: 0) |
| Pledge commitment digest | `0x732d403e9105f2d815ee0c5a8e2739ee069012ab0b0ad6ed04905e580e6550b0` |
| Attestation digest | `0x4410f98e3f36e82815cb2ec8382a59077fa98042a4c58fd42f49ff6d53da180c` |

### Element classifications

- **emissions_target**: `KEPT`
  - report excerpt: "Against our 2019 baseline, our absolute Scope 1 and Scope 2 greenhouse gas emissions fell 17% by the end of 2025, keeping us on course for our 40% reduction by 2030."
  - reason: "The report uses the same metric, baseline, and 2030 target level."
- **target_scope**: `KEPT`
  - report excerpt: "The target continues to apply to every wholly owned power plant and excludes no facility."
  - reason: "The scope definition is stated unchanged."
- **assurance**: `KEPT`
  - report excerpt: "Progress continues to be verified each year by an independent third-party assurance provider."
  - reason: "The assurance method and annual cadence are unchanged."

## Notes

- The outcome of each attempt is whatever the network did. A settled attempt means a majority of validators happened to read documents they classified identically, and then the recorded verdict is that majority reading.
- An attempt without a recorded verdict is the intended result: validators that read different documents cannot agree, so nothing is written and the audit stays PENDING.
- Ledger stats after the run: {"audits":7,"edits_detected":0,"pledges":2,"settled":7,"silent_moves":1}
