# Goalpost end-to-end on Studionet (Kept)

- Contract: 0xF9545b0b3A58F8e68F2D879E23A4Bc78A9B025B9
- Pledge: PLG-0001 (Title: "Climate 2030 Target", Kind: "climate")
- Evidence Pledge: https://gist.githubusercontent.com/reza9133/c8275367ecef0dd4a70d6e8e5363bcac/raw/505aee37b00e6a52d4af8b1b468e698e0c61e454/pledge.txt
- Evidence Report: https://gist.githubusercontent.com/reza9133/a9a1b63581ae1f4dd69c680e8180ba3d/raw/356155c7732f24c7b2686174c98cb560f915aadb/report.txt
- Final Standing: **HELD** (Strikes: 0)

## Transactions

| # | call | by | hash | decision | execution | finalized |
|---|---|---|---|---|---|---|
| 1 | `register_pledge` | 0x766a74c162916c4ef37bc4d3ad1920b411c8c03c | 0x6b16ce687bd0b01ded81f2b23b980573c3b74fb27eb67dadaa57125f9b99bc77 | ACCEPTED | SUCCESS | FINALIZED |
| 2 | `submit_report` | 0x766a74c162916c4ef37bc4d3ad1920b411c8c03c | 0xdc76c2d49075c53fafe8fc16b8f8c8d7aa86dcc280406b4945695594b8ce01a4 | ACCEPTED | SUCCESS | FINALIZED |
| 3 | `evaluate_report` | 0x766a74c162916c4ef37bc4d3ad1920b411c8c03c | 0xccae0eebde5f6c6f951f54de57f24d2109591c3de1f4434a99befcdc9d26b1e2 | ACCEPTED | SUCCESS | FINALIZED |

## On-Chain Audit & Verification

| Property | Value |
|---|---|
| Audit ID | `AUD-0001` |
| Verdict | `KEPT` |
| State | `SETTLED` |
| Pledge Commitment Digest | `0x92e90cd761abe7afcddb2fc4d581b21d863cb987bfbfdf03fb50c51b501ce441` |
| Attestation Digest | `0x9d7383496c5af8f1437d6a52bd64b5514f510b5da917570677d58632f0816438` |
| Integrity Status | `VERIFIED` (`INTACT`) |

## Element Adjudication Details

- **Element Key:** `emissions_target`
- **Dimension:** `target`
- **Status:** `KEPT`
- **Anchors Verified:** `["absolute", "40%", "2019"]`
- **Verbatim Report Excerpt:**
  > "We will cut our absolute Scope 1 greenhouse gas emissions by 40% by 2030, measured against our 2019 baseline."
- **Consensus Reason:**
  > "The report restates the pledge verbatim: same metric, baseline, deadline and target level."

## Ledger Stats After Run

```json
{
  "pledges": 1,
  "audits": 1,
  "settled": 1,
  "silent_moves": 0,
  "edits_detected": 0
}
```
