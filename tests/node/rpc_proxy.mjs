import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const at = (relative) => path.join(ROOT, relative);

const { onRequest } = await import(at('functions/rpc.ts'));

const upstreamCalls = [];
globalThis.fetch = async (url, init) => { upstreamCalls.push({ url, init }); return new Response('{"jsonrpc":"2.0","id":1,"result":"ok"}', { status: 200, headers: { 'content-type': 'application/json' } }); };

const call = (init = {}, url = 'https://goalpost.pages.dev/rpc') => onRequest({ request: new Request(url, init) });
const post = (body, headers = {}) => call({ method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

// allowed families are forwarded to the fixed upstream, unchanged
for (const method of ['gen_call', 'eth_chainId', 'eth_sendRawTransaction', 'eth_getTransactionByHash', 'net_version', 'zks_L1ChainId', 'web3_clientVersion']) {
  upstreamCalls.length = 0;
  const res = await post({ jsonrpc: '2.0', id: 1, method, params: [] });
  assert.equal(res.status, 200, method);
  assert.equal(upstreamCalls.length, 1);
  assert.equal(upstreamCalls[0].url, 'https://studio.genlayer.com/api');
  assert.equal((await res.json()).result, 'ok');
  assert.equal(res.headers.get('cache-control'), 'no-store');
}

// simulator-mutating and unknown methods are never forwarded
for (const method of ['sim_deleteAllValidators', 'sim_createValidator', 'sim_fundAccount', 'admin_x', 'debug_traceCall', '', 'GEN_call']) {
  upstreamCalls.length = 0;
  const res = await post({ jsonrpc: '2.0', id: 1, method, params: [] });
  assert.equal(res.status, 403, method);
  assert.equal(upstreamCalls.length, 0, 'must not reach upstream: ' + method);
}

// one bad call poisons a whole batch; a clean batch passes; empty/oversized batches are refused
assert.equal((await post([{ method: 'eth_chainId' }, { method: 'sim_x' }])).status, 403);
assert.equal((await post([{ method: 'eth_chainId' }, { method: 'gen_call' }])).status, 200);
assert.equal((await post([])).status, 403);
assert.equal((await post(Array.from({ length: 21 }, () => ({ method: 'eth_chainId' })))).status, 403);

// malformed shapes
assert.equal((await post('not json')).status, 400);
assert.equal((await post({ nothing: true })).status, 403);
assert.equal((await post('null')).status, 403);
assert.equal((await post({ method: 5 })).status, 403);

// size cap
assert.equal((await post(JSON.stringify({ method: 'eth_chainId', pad: 'x'.repeat(300 * 1024) }))).status, 413);

// verbs
assert.equal((await call({ method: 'GET' })).status, 405);
assert.equal((await call({ method: 'OPTIONS' })).status, 204);

// cross-origin browsers are refused, same-origin and non-browser clients are fine
assert.equal((await post({ method: 'eth_chainId' }, { origin: 'https://evil.example' })).status, 403);
assert.equal((await post({ method: 'eth_chainId' }, { origin: 'https://goalpost.pages.dev' })).status, 200);

// upstream failure becomes a clean 502, not a crash
globalThis.fetch = async () => { throw new Error('down'); };
assert.equal((await post({ method: 'eth_chainId' })).status, 502);
console.log('rpc proxy checks passed');
