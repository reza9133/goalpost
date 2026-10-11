import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const at = (relative) => path.join(ROOT, relative);

const R = await import(at('src/lib/receipt.ts'));

// status names from every shape Studio / SDKs have been seen to produce
assert.equal(R.statusNameOf({ statusName: 'Accepted' }), 'ACCEPTED');
assert.equal(R.statusNameOf({ status_name: 'LEADER_TIMEOUT' }), 'LEADER_TIMEOUT');
assert.equal(R.statusNameOf({ status: 5 }), 'ACCEPTED');
assert.equal(R.statusNameOf({ status: 5n }), 'ACCEPTED');
assert.equal(R.statusNameOf({ status: '7' }), 'FINALIZED');
assert.equal(R.statusNameOf({ status: 'validators timeout' }), 'VALIDATORS_TIMEOUT');
assert.equal(R.statusNameOf({ status: 99 }), 'STATUS_99');
assert.equal(R.statusNameOf(null), 'UNKNOWN');
assert.equal(R.statusNameOf({}), 'UNKNOWN');

// phases
const phases = { PENDING: 'queued', UNKNOWN: 'queued', PROPOSING: 'consensus', COMMITTING: 'consensus', REVEALING: 'consensus',
  ACCEPTED: 'decided', FINALIZED: 'decided', UNDETERMINED: 'failed', CANCELED: 'failed', LEADER_TIMEOUT: 'failed', VALIDATORS_TIMEOUT: 'failed' };
for (const [name, phase] of Object.entries(phases)) assert.equal(R.phaseOf(name), phase, name);

// execution success
const ok = { consensus_data: { leader_receipt: [{ execution_result: 'SUCCESS', result: { payload: { readable: '"PLG-0007"' } } }] } };
assert.equal(R.executionFailure(ok), null);
assert.equal(R.executionFailure({ txExecutionResultName: 'FINISHED_WITH_RETURN' }), null);
assert.equal(R.executionFailure({}), null);              // unknown shape => not treated as failure
assert.equal(R.executionFailure(null), null);

// execution failure: user error message is extracted from stderr
const err = { consensus_data: { leader_receipt: [{ execution_result: 'ERROR', genvm_result: { stderr: 'Traceback (most recent call last):\n  File "x"\ngenlayer.gl.vm.UserError: the quote for element "emissions_target" was not found verbatim on the pledge page' } }] } };
assert.equal(R.executionFailure(err), 'the quote for element "emissions_target" was not found verbatim on the pledge page');
// ... from payload.readable
const err2 = { consensus_data: { leader_receipt: [{ execution_result: 'ERROR', result: { payload: { readable: "UserError('title is too short')" } } }] } };
assert.match(R.executionFailure(err2), /title is too short/);
// ... camelCase variant (v2-style) and no message at all
assert.match(R.executionFailure({ consensusData: { leaderReceipt: [{ executionResult: 'ERROR' }] } }), /rejected this transaction/);
assert.match(R.executionFailure({ txExecutionResultName: 'FINISHED_WITH_ERROR' }), /rejected this transaction/);
// very long message is clipped
const long = R.executionFailure({ consensus_data: { leader_receipt: [{ execution_result: 'ERROR', genvm_result: { stderr: 'x'.repeat(2000) } }] } });
assert.ok(long.length <= 300);

// id extraction (bigint-safe)
assert.equal(R.findIdInReceipt(ok, 'PLG'), 'PLG-0007');
assert.equal(R.findIdInReceipt({ a: 1n, readable: 'AUD-0012' }, 'AUD'), 'AUD-0012');
assert.equal(R.findIdInReceipt({ nothing: true }, 'PLG'), null);
assert.equal(R.findIdInReceipt(ok, 'AUD'), null);
// circular structures do not throw
const circular = {}; circular.self = circular;
assert.equal(R.findIdInReceipt(circular, 'PLG'), null);
console.log('receipt parsing checks passed');
