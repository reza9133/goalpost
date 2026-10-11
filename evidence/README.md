# Goalpost StudioNet End-to-End Evidence

Live on-chain execution audit trail for the Goalpost Intelligent Contract deployed on GenLayer StudioNet.

- Contract Address: `0xF9545b0b3A58F8e68F2D879E23A4Bc78A9B025B9`
- Detailed Run Log: [`studionet-e2e-kept-2026-10-11.md`](studionet-e2e-kept-2026-10-11.md)

## Lifecycle Summary

1. **Pledge Registration (`register_pledge`):**
   Pledge `PLG-0001` frozen on-chain with definition anchors `["absolute", "40%", "2019"]`. Validators fetched the source text and verified exact verbatim presence before committing state.
   - Transaction: `0x6b16ce687bd0b01ded81f2b23b980573c3b74fb27eb67dadaa57125f9b99bc77`

2. **Report Submission (`submit_report`):**
   Audit `AUD-0001` queued deterministically under the frozen pledge prefix (`https://gist.githubusercontent.com/reza9133/`).
   - Transaction: `0xdc76c2d49075c53fafe8fc16b8f8c8d7aa86dcc280406b4945695594b8ce01a4`

3. **Consensus Adjudication (`evaluate_report`):**
   Validators independently fetched the report, extracted verbatim quotes, confirmed preservation of definition anchors, and settled the audit with verdict `KEPT`.
   - Transaction: `0xccae0eebde5f6c6f951f54de57f24d2109591c3de1f4434a99befcdc9d26b1e2`
   - Standing: `HELD`

## On-Chain Verification

Anyone can verify these states directly from the StudioNet RPC:
- `standing_of("PLG-0001")` returns `"HELD"`.
- `get_audit_bundle("AUD-0001")` returns the complete settled audit record and cryptographic attestation.
- `stats()` returns `{"audits": 1, "edits_detected": 0, "pledges": 1, "settled": 1, "silent_moves": 0}`.
