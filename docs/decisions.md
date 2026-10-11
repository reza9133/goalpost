# Decisions and runtime assumptions

## Product decisions

**Judge the definition, not the outcome.** Whether a target was achieved is a factual question about the
world that a page cannot settle. Whether a report still *means the same thing* as its pledge is answerable
from two documents. Goalpost only does the second.

**Freeze verified quotes, not extracted summaries.** An earlier shape had a model extract the commitment from
the page. Free extraction varies between validators and invites consensus failure. Requiring the registrant to
quote, and having validators merely confirm presence, makes registration fully deterministic once the page
bytes agree, and makes fabrication impossible.

**The contract disposes.** A model may only pick from a fixed vocabulary and cite verbatim text. Verification,
anchor rules and aggregation are code. This keeps the part that varies as small as possible.

**Anchors.** Free-form judgement alone is too easy to game in both directions. Anchors give the pledger's own
words a deterministic veto over both a lazy "unchanged" and a lazy accusation.

**Fail closed.** Anything unverifiable is `INCONCLUSIVE`: it neither accuses nor reassures, and it does not
change standing.

**Standing is current, strikes are history.** A later clean report can restore standing but cannot erase the
count of silent moves.

**Reports live on the pledge's host.** It binds "the report" to the pledging entity without a registry of
identities, and it is a deterministic check that needs no network.

## Technical decisions

| Decision | Reason |
| --- | --- |
| Records and view results are JSON text | Flat storage, no nested storage types, and no dependence on how an SDK decodes maps or big integers |
| Plain `int` assigned to `u256` fields; sized integers never called | Sized integers are annotations on some runtimes and callable on others; plain integers work on both |
| No `datetime` import; ISO parsing is arithmetic | The transaction timestamp is a string every validator sees; parsing it is a pure function. Some linters forbid `datetime` in contracts |
| No floats | Floats are flagged as non-deterministic by the linter |
| `gl.nondet.web.get` plus an in-contract HTML-to-text step | Independent of a browser service, and the same bytes always give the same text on every validator |
| Expected fetch failures returned as values | Validators can agree on "404" or "unreachable" instead of failing to agree on an exception |
| Vite single-page app, not a server-rendered framework | A static `dist/` deploys to Cloudflare Pages with no server runtime |
| Session key as the default identity | Studionet is gasless and free; a wallet is optional |
| One `genlayer-js` import site (`lib/chain.ts`) | Every SDK assumption is in one file, easy to adjust |

## Studionet specifics

- Chain ID **61999**, RPC `https://studio.genlayer.com/api`, explorer `https://explorer-studio.genlayer.com`.
- Studionet is the **stable** hosted Studio. It is a different chain from the release-candidate "Studio dev"
  (chain ID 61997). Do not mix their tooling.
- The contract pins the stable runner `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`, the
  one used throughout the GenLayer documentation examples and reported as accepted by Studionet. Never use a
  floating tag such as `latest` or `test`.
- The stable SDK is `genlayer-js` **1.1.8** (the npm `latest` tag). The 2.x line is a release candidate for a
  different consensus version with fees; this project does not use it.
- Studionet is gasless, so writes carry no fee parameters.
- Studionet rate-limits contract reads per address, so views return whole pages of data in one call.

## Runtime assumptions the code makes

These are the points where the real runtime could differ from what was tested. If a first deployment fails,
check here first.

| Assumption | Where | If it differs |
| --- | --- | --- |
| `gl.nondet.web.get(url)` returns an object with `.body` (bytes) and an integer `.status` or `.status_code` | `_fetch_text`, `_status_of` | Adjust `_status_of`; it already tries both names |
| `gl.nondet.exec_prompt(prompt, response_format='json')` returns a dict, or JSON text | `_audit_once`, `_coerce_json` | Both forms are handled |
| `gl.vm.run_nondet_unsafe(leader, validator)` returns the leader's return value; validator receives `gl.vm.Return` with `.calldata` | `_run_scan`, `_run_audit` | Adjust the two wrappers |
| `gl.message.sender_address.as_hex` is a property (a method is also tolerated) | `_hex_of` | Handled |
| `gl.message_raw['datetime']` is an ISO-8601 UTC string | `_now`, `_parse_iso` | Adjust the regex |
| A raised `gl.vm.UserError` rejects the transaction and rolls state back | all writes | Core assumption of the design |
| `TreeMap.get(key, default)` and item assignment work on `TreeMap[str, str]` | storage helpers | Core assumption |
| `createClient({chain, endpoint, account, provider})`, `readContract`, `writeContract({value})`, `getTransaction` | `lib/chain.ts`, `scripts/lib.mjs` | Edit those two files |
| `getTransaction` exposes a status name or code and `consensus_data.leader_receipt[0].execution_result` | `lib/receipt.ts` | Unknown shapes degrade to "not failed", and pages re-read state |
| The deploy receipt carries the contract address at one of several known paths | `scripts/deploy.mjs` | Copy it from the explorer |

## Sources

- GenLayer documentation: Networks, Intelligent Contracts (types, storage, equivalence principle, web access,
  non-determinism), GenLayerJS, Studio limitations, Consensus v0.6 migration (for the stable-versus-RC split).
- The `genlayer-js` npm package page (stable `latest` 1.1.8; 2.0 release candidate under the `rc` tag).
- A community Studionet project reporting empirically verified differences between the documentation and the
  stable SDK (pinned runner, `gl.message_raw`, plain integers, gasless accounts). Treated as a secondary,
  unofficial source.
