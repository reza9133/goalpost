// The adversarial evidence endpoint must serve only the fixed demonstration pages, never cache,
// and really vary between requests.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const F = await import(path.join(ROOT, 'functions/evidence/flapping/reports/[name].ts'));

assert.deepEqual([...F.VARIANTS].sort(), [
  '/evidence/meridian/reports/2026-disclosed.html',
  '/evidence/meridian/reports/2026-faithful.html',
  '/evidence/meridian/reports/2026-silent.html',
]);
// every random value maps to a fixed variant, including the edges
for (const value of [0, 0.2, 0.34, 0.5, 0.67, 0.999999, 1]) assert.ok(F.VARIANTS.includes(F.pickVariant(() => value)), String(value));
assert.equal(new Set([0.1, 0.5, 0.9].map((value) => F.pickVariant(() => value))).size, 3);
// the default source of randomness produces more than one variant over many draws
const seen = new Set(Array.from({ length: 200 }, () => F.pickVariant()));
assert.equal(seen.size, 3);

const fetched = [];
const env = { ASSETS: { fetch: async (request) => { fetched.push(new URL(request.url).pathname); return new Response('<p>page</p>', { status: 200, headers: { 'content-type': 'text/html', 'cache-control': 'public, max-age=3600' } }); } } };
const res = await F.onRequestGet({ request: new Request('https://site.example/evidence/flapping/reports/anything.html'), env });
assert.equal(res.status, 200);
assert.equal(res.headers.get('cache-control'), 'no-store');
assert.equal(res.headers.get('x-robots-tag'), 'noindex');
assert.equal(await res.text(), '<p>page</p>');
assert.ok(F.VARIANTS.includes(fetched[0]));
// the requested name never reaches the asset lookup, so it cannot be used to read other files
await F.onRequestGet({ request: new Request('https://site.example/evidence/flapping/reports/..%2f..%2fsecret'), env });
assert.ok(fetched.every((p) => F.VARIANTS.includes(p)));
console.log('flapping endpoint checks passed');
