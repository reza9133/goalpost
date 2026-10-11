# Goalpost

**An on-chain audit for silently moved goalposts.**

A public promise can keep every number and still walk away from its meaning: measure a different
thing, against a different baseline, over a different scope, by a different date. Goalpost freezes
the *definition* of a pledge on [GenLayer](https://docs.genlayer.com) and checks every later report
against it. Validators fetch the evidence themselves and must agree on whether the goalposts moved.

> It does **not** judge whether a target was achieved. It judges whether the definition of success
> stayed the same.

```
Pledged   We will cut our absolute Scope 1 and Scope 2 greenhouse gas emissions by 40% by 2030,
          measured against our 2019 baseline.
Reported  We will cut our emissions intensity of Scope 1 and Scope 2 greenhouse gas emissions by 40%
          by 2035, measured against our 2022 baseline.

          -> moved: "absolute" -> "emissions intensity of", 2030 -> 2035, 2019 -> 2022.   unchanged: 40%
```

Target network: **GenLayer Studionet** (chain ID 61999). The web console is a static site built for
**Cloudflare Pages**.

## How it works

1. **Freeze.** Someone names a public page and quotes the sentences that define a commitment. Every
   validator fetches the page and confirms each quote is present verbatim. Only then are the quotes
   frozen. The registrant never supplies the baseline text, and text hidden in scripts, styles or
   comments does not count.
2. **Submit.** Anyone submits a report URL. It must live under the reporting prefix chosen at
   registration, on the same host as the pledge. Anything else is refused on-chain without touching
   the network.
3. **Evaluate.** Anyone asks the validators to read the report. Each classifies every frozen element
   and quotes the report as evidence. The contract checks every quote against the page text itself.
4. **Agree.** Validators repeat the whole fetch and judgement independently and must agree on the
   verdict and on exactly which elements moved silently. No agreement, nothing is written.

Anyone can also ask validators to re-fetch the pledge page; if a frozen quote has vanished, the silent
edit is recorded permanently.

### Verdicts

The verdict is computed by the contract from element statuses, strictest first. A model never writes it.

| Verdict | When | Pledge standing |
| --- | --- | --- |
| Moved silently | an element changed and the report does not say so, with evidence | Goalposts moved, and a permanent silent-move count increases |
| Inconclusive | something could not be verified, or the report could not be read | unchanged |
| Changed, disclosed | elements changed and each change is acknowledged | Revised openly |
| Incomplete | nothing changed, but some elements are not addressed | Partly reported |
| Kept | every element restated with the same definition | Held |

**Anchors** make the contract strict. An anchor is a word or number from a pledged sentence that
defines it (`absolute`, `2019`, `40%`). A report cannot be called *unchanged* unless the excerpt
backing that claim still carries every anchor, and it cannot be accused of a *silent change* if every
anchor survives in the very excerpt used to accuse it. Accusations need evidence on both sides, so
every frozen element needs at least one anchor. A claim that a commitment changed also needs an excerpt that shares
content with the pledged sentence, a disclosure has to read as an admission of change, and `not addressed` is refused
when the report was too long to be read in full.

## Repository layout

```
contracts/goalpost.py      The Intelligent Contract (single file, Studionet stable runner)
tests/                     Python test suite (standard library only) + Node logic tests
  gensim.py                In-process stand-in for the GenVM runtime used by the tests
  node/                    Client logic tests (diff, validation mirror, receipts, RPC proxy)
scripts/                   deploy.mjs and e2e.mjs (genlayer-js, Node 20+)
src/                       Web console (Vite, React, TypeScript, plain CSS)
public/evidence/           Fictional demonstration documents the validators can fetch
functions/rpc.ts           OPTIONAL same-origin RPC proxy for Cloudflare Pages
docs/                      Architecture, threat model, decisions, Cloudflare guide
```

## Quick start

### 1. Run the tests (no installs needed)

```bash
python3 -m unittest discover -s tests -t tests -v
```

This runs the real contract file on a simulated runtime plus the client logic under Node
(22.18+ for the built-in TypeScript type stripping; those tests are skipped with a reason on
older Node). See [Verification status](#verification-status) for what this does and does not prove.

### 2. Lint the contract

```bash
pip install genvm-linter
npm run lint:contract
```

### 3. Deploy the contract to Studionet

Pick one.

**Studio UI (simplest).** Open [studio.genlayer.com](https://studio.genlayer.com), create a contract,
paste `contracts/goalpost.py`, and press Deploy. There are no constructor arguments. Copy the
contract address.

**Script.**

```bash
npm install
npm run deploy:contract -- --write-env
```

It deploys from a throwaway key (Studionet needs no funds; set `GOALPOST_PRIVATE_KEY` to use your
own), verifies the deployed contract, writes `artifacts/deployment.json` and, with `--write-env`,
`.env.local`.

**GenLayer CLI.**

```bash
npm install -g genlayer
genlayer network set studionet
genlayer deploy --contract contracts/goalpost.py
```

**Live deployment.** The Studionet contract used for the reference run is
`0xF9545b0b3A58F8e68F2D879E23A4Bc78A9B025B9`. Its full lifecycle run (register, submit, evaluate,
verdict `KEPT`, standing `HELD`) is recorded in [`evidence/`](evidence/README.md).

### 4. Run the web console locally

```bash
cp .env.example .env.local        # then set VITE_CONTRACT_ADDRESS
npm install
npm run dev
```

Reading the ledger needs no identity. To write, create a **session key** from the identity menu (a
throwaway key kept in your browser; Studionet is free) or connect a browser wallet.

> The bundled demonstration documents are served from `/evidence`. Validators fetch pages from the
> public internet, so they cannot read `localhost`. Use the console locally to browse and read, and
> deploy it (next section) to freeze the demonstration pledges.

### 5. Deploy the site to Cloudflare Pages

Short version: connect the repository, build command `npm run build`, output directory `dist`, and set
`VITE_CONTRACT_ADDRESS` as a build variable. Full guide, including the two Cloudflare settings that can
silently stop validators from reading `/evidence`, in [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md).

### 6. Exercise the whole lifecycle on the live network

```bash
npm run e2e -- --site https://YOUR-SITE.pages.dev
npm run e2e -- --site https://YOUR-SITE.pages.dev --scenario halden --report silent --integrity
```

It checks the evidence is reachable, freezes a pledge, submits and evaluates a report, prints each
element's status and cited excerpts, and confirms the attestation recomputes on chain. A verdict that
differs from the expectation is reported, not treated as an error: real validators and real models are
not deterministic. Broken contract invariants are errors.

## Verification status

Read this before you rely on anything. It states what was actually exercised and how.

| Part | What was done | What was **not** done |
| --- | --- | --- |
| Contract | 100+ tests run the real `goalpost.py` on a simulated runtime (`tests/gensim.py`) that enforces GenVM's rules: no `gl.nondet` outside a block, no storage inside a block, validator majority, rollback on error. Mutation testing: 21 deliberate rule removals were each caught by the suite. | Never executed on real GenVM. `genvm-lint` not run. The simulator is not GenVM; it verifies logic, not runtime behaviour. |
| Evidence pages | Every frozen quote and every excerpt is checked against the page text by the contract's own extractor; every demo report yields its expected verdict under an ideal model. | Real LLMs were not asked. Real model output will vary. |
| Web console | Type-checked (strict) with TypeScript against hand-written stubs for React, the router and genlayer-js. Bundled with esbuild and exercised in headless Chromium against a fake chain whose data was produced by the real contract: rendering (light, dark, mobile), forms, validation, transaction success, rejection, no-agreement, declined signature, read outage, empty and not-found states. | Not built with Vite, and not type-checked against the real `@types/react`, `react-router-dom` or `genlayer-js` types. The real `genlayer-js` 1.1.8 calls were never executed. The browser-wallet path (`provider`) in particular is unverified; the session-key path is the default. |
| Scripts | Syntax-checked; their receipt parser is parity-tested against the client's. | `deploy.mjs` and `e2e.mjs` have not run against the network. |
| Cloudflare proxy | Unit-tested with a mocked upstream: method allow-list, origin check, batch and size caps. | Not deployed. |

The first real deployment is the real test. If something fails, [docs/decisions.md](docs/decisions.md)
lists every runtime assumption the code makes and where it lives, so you can find it quickly.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Registration fails with `quote ... not found verbatim` | The quote differs from the page text, or the page needs JavaScript to show it. Copy the sentence exactly from the page source. |
| Registration fails with `could not be retrieved (HTTP_4XX)` | Validators cannot read the URL. On Cloudflare, check Bot Fight Mode and WAF rules for `/evidence/*`. |
| The form says a URL "must name a public DNS host" | Validators cannot read `localhost`, IP addresses or private names; use a deployed URL. |
| A transaction ends with "did not reach agreement" | Validators disagreed; nothing was written. Try again. Persistent disagreement usually means the page changes between fetches. |
| Reads fail intermittently from the browser | Studionet rate-limits and occasionally omits CORS headers under load. Build with `VITE_RPC_URL=/rpc` to use the same-origin proxy. |
| The console says it is not connected to a contract | `VITE_CONTRACT_ADDRESS` was not set at build time. Vite reads it when building, so rebuild after changing it. |

## Documentation

- [Architecture](docs/architecture.md): data model, equivalence rules, client structure
- [Threat model](docs/threat-model.md): what is defended, by what, and what remains
- [Decisions](docs/decisions.md): why it is built this way, and every Studionet-specific assumption
- [Cloudflare Pages guide](docs/deploy-cloudflare.md)

## License

MIT. The demonstration documents under `public/evidence` are fictional.
