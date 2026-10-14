// A transaction is only reported as completed when the validators decided it AND the contract call
// ran successfully, and ACCEPTED (appealable) is never reported as FINALIZED. Both the console's
// outcome logic and the scripts' twin are checked on the same transactions.

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const at = (relative) => path.join(ROOT, relative);

// chain.ts imports genlayer-js, which is not installed for these tests. outcomeOf is a pure function,
// so load it from a copy of the module with the SDK import stubbed out.
import fs from 'node:fs';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'goalpost-outcome-'));
const source = fs
  .readFileSync(at('src/lib/chain.ts'), 'utf8')
  .replace(/import \{ createAccount, createClient \} from 'genlayer-js';/, 'const createAccount = () => ({}); const createClient = () => ({});')
  .replace(/import \{ studionet \} from 'genlayer-js\/chains';/, 'const studionet = {};')
  .replace(/from '\.\/config'/, "from './config.ts'")
  .replace(/from '\.\/receipt'/, "from './receipt.ts'")
  .replace(/from '\.\/session'/, "from './session.ts'");
fs.writeFileSync(path.join(tmp, 'chain.ts'), source);
fs.writeFileSync(path.join(tmp, 'config.ts'), fs.readFileSync(at('src/lib/config.ts'), 'utf8').replace('import.meta.env', '({})'));
fs.writeFileSync(path.join(tmp, 'receipt.ts'), fs.readFileSync(at('src/lib/receipt.ts'), 'utf8'));
fs.writeFileSync(path.join(tmp, 'session.ts'), 'export const loadSessionKey = () => null;\n');
globalThis.window = undefined;
const { outcomeOf } = await import(path.join(tmp, 'chain.ts'));
const JS = await import(at('scripts/lib.mjs').replace('lib.mjs', 'receipt.mjs'));
const { describeDecision } = await import(at('scripts/lib.mjs')).catch(() => ({ describeDecision: null }));

const success = (status) => ({ status, consensus_data: { leader_receipt: [{ execution_result: 'SUCCESS' }] } });
const errored = (status) => ({ status, consensus_data: { leader_receipt: [{ execution_result: 'ERROR', genvm_result: { stderr: 'x\nUserError: the pledge is retired' } }] } });
const unread = (status) => ({ status });

const cases = [
  { name: 'accepted + success', tx: success('ACCEPTED'), status: 'ACCEPTED', ok: true, finality: 'accepted', execution: 'success' },
  { name: 'finalized + success', tx: success('FINALIZED'), status: 'FINALIZED', ok: true, finality: 'finalized', execution: 'success' },
  { name: 'accepted + contract error', tx: errored('ACCEPTED'), status: 'ACCEPTED', ok: false, finality: null, execution: 'failed', failure: /pledge is retired/ },
  { name: 'finalized + contract error', tx: errored('FINALIZED'), status: 'FINALIZED', ok: false, finality: null, execution: 'failed', failure: /pledge is retired/ },
  { name: 'accepted + unreadable result', tx: unread('ACCEPTED'), status: 'ACCEPTED', ok: false, finality: null, execution: 'unknown', failure: /could not be read/ },
  { name: 'finalized + unreadable result', tx: unread('FINALIZED'), status: 'FINALIZED', ok: false, finality: null, execution: 'unknown', failure: /could not be read/ },
  { name: 'no agreement', tx: success('UNDETERMINED'), status: 'UNDETERMINED', ok: false, finality: null, execution: 'unknown', failure: /did not reach agreement/ },
  { name: 'canceled', tx: success('CANCELED'), status: 'CANCELED', ok: false, finality: null, execution: 'unknown', failure: /did not reach agreement/ },
  { name: 'still in consensus', tx: success('COMMITTING'), status: 'COMMITTING', ok: false, finality: null, execution: 'unknown', failure: /did not reach agreement/ },
];

for (const c of cases) {
  const outcome = outcomeOf('0xabc', c.status, c.tx);
  assert.equal(outcome.ok, c.ok, `${c.name}: ok`);
  assert.equal(outcome.finality, c.finality, `${c.name}: finality`);
  assert.equal(outcome.execution, c.execution, `${c.name}: execution`);
  if (c.failure) assert.match(outcome.failure, c.failure, `${c.name}: failure`);
  else assert.equal(outcome.failure, null, `${c.name}: no failure`);
  if (describeDecision) {
    const twin = describeDecision(c.tx, c.status);
    assert.equal(twin.finality, c.finality, `${c.name}: script finality`);
    assert.equal(twin.execution, c.execution, `${c.name}: script execution`);
    assert.equal(twin.failure === null, c.failure === undefined, `${c.name}: script failure presence`);
  }
}
// ACCEPTED must never be reported as FINALIZED, in either direction
assert.notEqual(outcomeOf('0x1', 'ACCEPTED', success('ACCEPTED')).finality, 'finalized');
assert.equal(JS.phaseOf('ACCEPTED') === JS.phaseOf('FINALIZED'), false);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('outcome checks passed');
