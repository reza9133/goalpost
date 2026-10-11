# Deploying the web console to Cloudflare Pages

The console is a static single-page app. `npm run build` produces `dist/`, which Cloudflare Pages serves
directly. There is no server to run.

Do this **after** the contract is deployed, because the contract address is baked into the build.

## 0. Decide your final address first

A pledge freezes URLs on chain: the pledge page and the reporting prefix. If you register the demonstration
pledges on `https://goalpost.pages.dev` and later move to `https://goalpost.example`, those pledges keep
pointing at the old host. Choose your final domain before you register anything you want to keep.

## 1. Option A: Git integration (recommended)

1. Push the repository to GitHub or GitLab.
2. Cloudflare dashboard, **Workers & Pages**, **Create**, **Pages**, **Connect to Git**, pick the repository.
3. Build settings:

   | Setting | Value |
   | --- | --- |
   | Framework preset | None (or Vite) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | repository root |

4. **Environment variables** (Production, and Preview if you use previews):

   | Variable | Value |
   | --- | --- |
   | `VITE_CONTRACT_ADDRESS` | the address printed by `npm run deploy:contract` |
   | `VITE_RPC_URL` | optional, `/rpc` to use the same-origin proxy (section 4) |
   | `NODE_VERSION` | optional, `20` (the repository also ships `.node-version`) |

   Vite reads these when it **builds**. Changing one means triggering a new deployment.

5. Save and deploy.

## 2. Option B: direct upload

```bash
cp .env.example .env.local        # set VITE_CONTRACT_ADDRESS
npm install
npm run build
npx wrangler login
npx wrangler pages deploy dist --project-name goalpost
```

`wrangler.toml` already names the project and the output directory. If you want the optional proxy, deploy from
the repository root so the `functions/` directory is included.

## 3. Make sure validators can read `/evidence`

This is the step that most often goes wrong. Validators are automated clients on the public internet. Cloudflare
protections designed to stop automated clients can stop them too, and the failure looks like "the pledge page
could not be retrieved (HTTP_4XX)".

The default `*.pages.dev` domain works. If you attach a custom domain on a zone with extra protections, check:

- **Security, Bots, Bot Fight Mode.** Turn it off for the zone, or exempt `/evidence/*` with a WAF skip rule.
- **WAF custom rule.** Add a rule: *URI Path starts with* `/evidence/`, action **Skip** (all remaining custom
  rules and managed rules). Place it first.
- **I'm Under Attack mode / managed challenge.** Do not enable on `/evidence/*`.
- **Scrape Shield: Email Address Obfuscation, Rocket Loader, Auto Minify.** These rewrite HTML. The demonstration
  pages contain no email addresses, but if you publish your own pages, disable them for those paths so the
  text validators read is the text you wrote.

Verify from outside, with an ordinary non-browser user agent:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -A "python-requests/2.32" https://YOUR-SITE/evidence/meridian/pledge.html
curl -s -o /dev/null -w "%{http_code}\n" -A "Mozilla/5.0" https://YOUR-SITE/evidence/meridian/reports/2026-silent.html
```

Both must print `200`. A `403`, `429` or a challenge page means validators will be blocked too.
`npm run e2e -- --site https://YOUR-SITE` runs this reachability check as its first step.

Evidence responses are sent with `Cache-Control: no-cache` (see `public/_headers`) so an edit is visible
immediately. To demonstrate the integrity check, change one frozen sentence in
`public/evidence/meridian/pledge.html` (for example `40%` to `25%`), redeploy, and press
**Re-verify the pledge page** on the registered pledge. The pledge is then marked as edited, permanently.

## 4. Optional: the same-origin RPC proxy

Browsers read from `https://studio.genlayer.com/api` directly. That endpoint has been reported to omit CORS
headers occasionally under load. `functions/rpc.ts` is a Pages Function that forwards a safe subset of JSON-RPC
from your own origin, so CORS cannot fail.

To enable it, set `VITE_RPC_URL=/rpc` at build time and redeploy. To check it:

```bash
curl -s -X POST https://YOUR-SITE/rpc -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
# expect {"jsonrpc":"2.0","id":1,"result":"0xf22f"}   (61999)

curl -s -X POST https://YOUR-SITE/rpc -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"sim_getValidators","params":[]}'
# expect 403: simulator methods are never forwarded
```

The proxy only forwards `eth_`, `gen_`, `net_`, `web3_` and `zks_` methods. If a future SDK needs another family,
add it to `ALLOWED_PREFIXES` deliberately. Browser wallets are always pointed at the public RPC, never the proxy.

If something misbehaves with the proxy on, unset `VITE_RPC_URL`, rebuild, and you are back to direct reads.

## 5. Headers and CSP

`public/_headers` ships `nosniff`, frame denial, a strict referrer policy, long caching for hashed assets, and
a **report-only** Content-Security-Policy. Report-only logs violations in the browser console without blocking
anything. Load the site, exercise it, and confirm the console shows no violations. Then rename the header to
`Content-Security-Policy` to enforce it. If you use a custom RPC endpoint, add its origin to `connect-src`.

## 6. Routing

Pages serves `index.html` for unknown paths when the project has no top-level `404.html`, which is what a
single-page app needs. Do not add a `404.html`. Deep links such as `/pledges/PLG-0001` work for that reason.

## 7. Checklist

- [ ] The site loads and the ledger shows "Studionet" with no warning banner
- [ ] `https://YOUR-SITE/evidence/meridian/pledge.html` returns 200 to the `curl` commands above
- [ ] `npm run e2e -- --site https://YOUR-SITE` completes
- [ ] The footer shows your contract address and links to the explorer
- [ ] Optional: `/rpc` answers `eth_chainId` and refuses `sim_` methods
