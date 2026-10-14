// The command-line scripts carry a plain-JavaScript twin of the web client's receipt parser.
// Both must give identical answers on every receipt shape, and the flag parser must behave.

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const at = (relative) => path.join(ROOT, relative);
const TS = await import(at('src/lib/receipt.ts'));
const JS = await import(at('scripts/receipt.mjs'));
const { parseArgs } = await import(at('scripts/args.mjs'));

const circular = {};
circular.self = circular;

const receipts = [
  null,
  {},
  { statusName: 'Accepted' },
  { status_name: 'LEADER_TIMEOUT' },
  { status: 5 },
  { status: 5n },
  { status: '7' },
  { status: 'validators timeout' },
  { status: 99 },
  { consensus_data: { leader_receipt: [{ execution_result: 'SUCCESS', result: { payload: { readable: '"PLG-0007"' } } }] } },
  { consensus_data: { leader_receipt: [{ execution_result: 'ERROR', genvm_result: { stderr: 'x\nUserError: title is too short' } }] } },
  { consensus_data: { leader_receipt: [{ execution_result: 'ERROR', result: { payload: { readable: "UserError('bad quote')" } } }] } },
  { consensus_data: { leader_receipt: [{ execution_result: 'ERROR', result: { payload: 'plain payload' } }] } },
  { consensusData: { leaderReceipt: [{ executionResult: 'ERROR' }] } },
  { txExecutionResultName: 'FINISHED_WITH_ERROR' },
  { txExecutionResultName: 'FINISHED_WITH_RETURN' },
  { txExecutionResultName: 'NOT_VOTED' },
  { consensus_data: { leader_receipt: [{}] } },
  { consensus_data: { leader_receipt: [{ execution_result: 'SUCCESS' }, { execution_result: 'ERROR', genvm_result: { stderr: 'z\nUserError: second receipt failed' } }] } },
  { txExecutionResultName: 'FINISHED_WITH_RETURN', consensus_data: { leader_receipt: [{ execution_result: 'ERROR' }] } },
  { consensus_data: { leader_receipt: [{ execution_result: 'ERROR', genvm_result: { stderr: 'y'.repeat(2000) } }] } },
  { value: 12n, id: 'AUD-0042' },
  circular,
];

receipts.forEach((receipt, index) => {
  assert.equal(JS.statusNameOf(receipt), TS.statusNameOf(receipt), `statusNameOf #${index}`);
  assert.equal(JS.phaseOf(JS.statusNameOf(receipt)), TS.phaseOf(TS.statusNameOf(receipt)), `phaseOf #${index}`);
  assert.equal(JS.executionFailure(receipt), TS.executionFailure(receipt), `executionFailure #${index}`);
  assert.deepEqual(JS.executionOf(receipt), TS.executionOf(receipt), `executionOf #${index}`);
  for (const status of ['ACCEPTED', 'FINALIZED', 'PENDING', 'UNDETERMINED']) {
    assert.equal(JS.settledAs(status, JS.executionOf(receipt)), TS.settledAs(status, TS.executionOf(receipt)), `settledAs ${status} #${index}`);
  }
  for (const prefix of ['PLG', 'AUD']) {
    assert.equal(JS.findIdInReceipt(receipt, prefix), TS.findIdInReceipt(receipt, prefix), `findIdInReceipt ${prefix} #${index}`);
  }
});
for (const name of ['ACCEPTED', 'FINALIZED', 'PENDING', 'UNKNOWN', 'COMMITTING', 'UNDETERMINED', 'LEADER_TIMEOUT', 'APPEAL_COMMITTING', 'WHATEVER']) {
  assert.equal(JS.phaseOf(name), TS.phaseOf(name), name);
  assert.equal(JS.isDecision(JS.phaseOf(name)), TS.isDecision(TS.phaseOf(name)), `isDecision ${name}`);
}
assert.deepEqual([...JS.DECIDED].sort(), [...TS.DECIDED].sort());
assert.deepEqual([...JS.FAILED].sort(), [...TS.FAILED].sort());

// flag parser
const parsed = parseArgs(['--site', 'https://a.example', '--integrity', '--scenario=halden', 'stray', '--report', 'silent']);
assert.equal(parsed.values.site, 'https://a.example');
assert.equal(parsed.values.scenario, 'halden');
assert.equal(parsed.values.report, 'silent');
assert.ok(parsed.flags.has('integrity'));
assert.ok(!parsed.flags.has('site'));
assert.deepEqual(parseArgs([]).values, {});
assert.ok(parseArgs(['--write-env']).flags.has('write-env'));
assert.ok(parseArgs(['--a', '--b']).flags.has('a') && parseArgs(['--a', '--b']).flags.has('b'));

console.log('script parity checks passed');
