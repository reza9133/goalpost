import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const L = await import(path.join(ROOT, 'scripts/evidence-lib.mjs'));

// votes from a map, in either letter case
const mapTx = { consensus_data: { votes: { '0xa': 'agree', '0xb': 'AGREE', '0xc': 'disagree', '0xd': 'timeout', '0xe': 'weird' } } };
const v = L.votesOf(mapTx);
assert.deepEqual([v.total, v.agree, v.disagree, v.timeout, v.other], [5, 2, 1, 1, 1]);
assert.equal(L.votesCell(v), '2 agree, 1 disagree, 1 timeout, 1 other (of 5)');
// votes from validator receipts
const arrayTx = { consensusData: { validators: [{ vote: 'Agree', node_config: { address: '0x1' } }, { vote: 'Disagree' }, { result: 'no vote field' }] } };
const w = L.votesOf(arrayTx);
assert.deepEqual([w.total, w.agree, w.disagree], [2, 1, 1]);
assert.equal(w.entries[1].validator, 'validator-2');
// nothing reported => null, printed as "not reported", never guessed
for (const tx of [null, {}, { consensus_data: {} }, { consensus_data: { votes: {} } }, { consensus_data: { validators: [] } }]) assert.equal(L.votesOf(tx), null);
assert.equal(L.votesCell(null), 'not reported');

// table rows escape pipes and link the explorer
const table = L.txTable([{ call: 'evaluate_report', note: 'a | b', hash: '0xabc', decision: 'ACCEPTED', execution: 'success', finality: 'ACCEPTED', votes: v }]);
assert.match(table, /a \\\| b/);
assert.match(table, /\(https:\/\/explorer-studio\.genlayer\.com\/tx\/0xabc\)/);

assert.equal(L.finalityLabel('finalized'), 'FINALIZED');
assert.match(L.finalityLabel('accepted'), /not final/);
assert.equal(L.finalityLabel(null), 'not reached');
assert.match(L.describeEvaluation({ finality: 'accepted', statusName: 'ACCEPTED', execution: 'success' }), /accepted|ACCEPTED/);
assert.match(L.describeEvaluation({ finality: null, statusName: 'UNDETERMINED', execution: 'unknown', failure: 'no agreement' }), /no settled result: no agreement/);
assert.match(L.describeEvaluation({ finality: null, statusName: 'ACCEPTED', execution: 'failed', failure: 'boom' }), /contract call failed: boom/);

const md = L.renderEvidence({
  title: 'Goalpost on Studionet (Silent)', contract: '0xC', site: 'https://x.example', signer: '0xS', startedAt: '2026-10-13T00:00:00Z',
  rows: [{ call: 'register_pledge', hash: '0x1', decision: 'ACCEPTED', execution: 'success', finality: 'FINALIZED', votes: null }],
  pledgeId: 'PLG-0001',
  audit: { audit_id: 'AUD-0001', report_url: 'https://x.example/r', verdict: 'MOVED_SILENTLY', state: 'SETTLED', silent_keys: ['a'], attestation: '0xAT', failure_reason: '', elements: [{ key: 'a', status: 'MOVED_SILENT', flag: '', report_excerpt: 'q', disclosure_excerpt: '', reason: 'r' }] },
  pledge: { standing: 'BREACHED', strikes: 1, commitment: '0xCM' },
  outcomes: ['evaluate: ok'], notes: ['n'],
});
for (const needle of ['# Goalpost on Studionet (Silent)', 'PLG-0001', '`MOVED_SILENTLY`', 'BREACHED', '**a**: `MOVED_SILENT`', '## Notes']) assert.ok(md.includes(needle), needle);
console.log('evidence helper checks passed');
