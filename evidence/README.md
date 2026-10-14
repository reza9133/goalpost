# Goalpost Studionet end-to-end evidence

Live on-chain audit trail for Goalpost on GenLayer Studionet. Every file here is produced from real transactions:
nothing in this folder is written by hand or generated without a network run (`npm run evidence`).

## Status

| Outcome | Contract | Status | Record |
| --- | --- | --- | --- |
| Kept (faithful report) | 1.2.0 at `0xF9545b0b3A58F8e68F2D879E23A4Bc78A9B025B9` | **Recorded** | [`studionet-e2e-kept-2026-10-11.md`](studionet-e2e-kept-2026-10-11.md) |
| Silent move | 1.3.0 | **To be recorded** with `npm run evidence -- --only silent` | `studionet-e2e-silent-<date>.md` |
| Disclosed change | 1.3.0 | **To be recorded** with `--only disclosed` | `studionet-e2e-disclosed-<date>.md` |
| Inconclusive | 1.3.0 | **To be recorded** with `--only inconclusive` | `studionet-e2e-inconclusive-<date>.md` |
| Adversarial validator disagreement | 1.3.0 | **To be recorded** with `--only adversarial` | `studionet-e2e-adversarial-<date>.md` |
| Kept, on the 1.3.0 contract | 1.3.0 | **To be recorded** with `--only kept` | `studionet-e2e-kept-<date>.md` |

The recorded Kept run predates publisher-authority binding and per-element consensus (contract 1.3.0). Its pledge page
does not declare its reporting prefix, so it cannot be registered again on 1.3.0. The rows marked "to be recorded" need
the new contract deployed and the site redeployed (the demonstration pledge pages now carry the declaration, and the
adversarial endpoint is a Pages Function).

## How to record the rest

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

## Verifying the recorded Kept run

Anyone can check it directly against the Studionet RPC:

- `standing_of("PLG-0001")` returns `"HELD"`.
- `get_audit_bundle("AUD-0001")` returns the settled audit and its attestation.
- `stats()` returns `{"audits": 1, "edits_detected": 0, "pledges": 1, "settled": 1, "silent_moves": 0}`.
