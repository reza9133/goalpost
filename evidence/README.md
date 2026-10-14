# Goalpost Studionet end-to-end evidence

Live on-chain audit trail for Goalpost on GenLayer Studionet. Every file here is produced from real transactions:
nothing in this folder is written by hand or generated without a network run (`npm run evidence`).

## Status

All rows are recorded on contract 1.3.0 at `0xe0167DeFD7b55bd4C120092Ee340078077186c3f` (Studionet), on 2026-10-14.

| Outcome | Status | Record |
| --- | --- | --- |
| Kept (faithful report) | **Recorded** | [`studionet-e2e-kept-2026-10-14.md`](studionet-e2e-kept-2026-10-14.md) |
| Silent move | **Recorded** | [`studionet-e2e-silent-2026-10-14.md`](studionet-e2e-silent-2026-10-14.md) |
| Disclosed change | **Recorded** | [`studionet-e2e-disclosed-2026-10-14.md`](studionet-e2e-disclosed-2026-10-14.md) |
| Inconclusive | **Recorded** | [`studionet-e2e-inconclusive-2026-10-14.md`](studionet-e2e-inconclusive-2026-10-14.md) |
| Adversarial validator disagreement | **Recorded** | [`studionet-e2e-adversarial-2026-10-14.md`](studionet-e2e-adversarial-2026-10-14.md) |

The runs share one contract and used pledge `PLG-0001` for the first four outcomes and `PLG-0002` for the adversarial
one, so audits and standings accumulate across the files. The records were written while transactions were `ACCEPTED`
and not yet `FINALIZED`.

## How to record your own

```bash
npm install
npm run deploy:contract -- --write-env           # contract 1.3.0
# deploy the site (Cloudflare Pages) so /evidence and /evidence/flapping are public, then:
npm run evidence -- --site https://YOUR-SITE.pages.dev --await-finality
```

Each file lists every transaction with three separate facts, as the network reports them:

- **decision**: the validators' consensus status. `ACCEPTED` means agreed but still open to appeal; `FINALIZED` means final.
- **execution**: whether the contract call itself succeeded. A transaction can be accepted while the call failed.
- **validator votes**: agree and disagree counts, when the network reports them. Otherwise "not reported".

What each scenario shows:

| Scenario | Report | Expected on a healthy network |
| --- | --- | --- |
| silent | `meridian/reports/2026-silent.html` | `MOVED_SILENTLY`, standing `BREACHED`, one strike |
| disclosed | `meridian/reports/2026-disclosed.html` | `MOVED_DISCLOSED`, standing `REVISED` |
| inconclusive | `meridian/reports/2026-withheld.html` (no readable text) | `INCONCLUSIVE` with failure reason `EMPTY`, no model call, standing unchanged |
| adversarial | `flapping/reports/*` (a different document on every request) | Some attempts end with no recorded verdict because validators read different documents; an attempt that does settle records a majority reading |

A verdict that differs from the expectation is recorded as it is. Real validators and models are not deterministic.

## Verifying the recorded runs

Anyone can check them directly against the Studionet RPC:

- `get_audit_bundle("AUD-0001")` returns the settled Kept audit and its attestation.
- `standing_of("PLG-0001")` returns the standing after the last run on that pledge (`REVISED`, one silent move on record).
- `stats()` returns `{"audits": 7, "edits_detected": 0, "pledges": 2, "settled": 7, "silent_moves": 1}` after all five runs.
