import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const at = (relative) => path.join(ROOT, relative);

const { redline } = await import(at('src/lib/diff.ts'));
const F = await import(at('src/lib/format.ts'));

// --- redline: the real Meridian hero strings (what the product exists to show)
const pledged = 'We will cut our absolute Scope 1 and Scope 2 greenhouse gas emissions by 40% by 2030, measured against our 2019 baseline.';
const reported = 'We will cut our emissions intensity of Scope 1 and Scope 2 greenhouse gas emissions by 40% by 2035, measured against our 2022 baseline.';
const r = redline(pledged, reported);
const marked = (tokens) => tokens.filter(t => t.changed).map(t => t.text.replace(/[,.]$/, ''));
const unmarked = (tokens) => tokens.filter(t => !t.changed).map(t => t.text.replace(/[,.]$/, ''));
assert.deepEqual(marked(r.left), ['absolute', '2030', '2019'], 'only the moved definition is marked on the pledge side');
assert.deepEqual(marked(r.right), ['emissions', 'intensity', 'of', '2035', '2022'], 'only the new definition is marked on the report side');
assert.ok(unmarked(r.left).includes('40%') && unmarked(r.right).includes('40%'), 'the number that stayed is not marked');
assert.ok(r.overlap > 0.7 && r.overlap < 1, 'overlap should be high but not total: ' + r.overlap);
// every token of each side is preserved in order
assert.equal(r.left.map(t => t.text).join(' '), pledged);
assert.equal(r.right.map(t => t.text).join(' '), reported);

// identical text => no changes, overlap 1
const same = redline('Progress will be verified each year.', 'progress will be verified each year');
assert.equal(same.left.some(t => t.changed) || same.right.some(t => t.changed), false);
assert.equal(same.overlap, 1);

// empty sides do not throw
assert.equal(redline('', '').overlap, 1);
assert.equal(redline('a b c', '').right.length, 0);
assert.equal(redline('', 'a b c').right.every(t => t.changed), true);

// curly quotes / trailing punctuation are not reported as changes
const punct = redline('the \u201ctarget\u201d is 40%,', 'the "target" is 40%');
assert.equal(punct.left.some(t => t.changed), false);

// very long input stays bounded and fast
const long = Array.from({length: 2000}, (_, i) => 'w' + i).join(' ');
const t0 = Date.now(); redline(long, long.split(' ').reverse().join(' ')); assert.ok(Date.now() - t0 < 1500);

// --- format helpers
assert.equal(F.shortHex('0x1234567890abcdef1234567890abcdef12345678'), '0x1234...5678');
assert.equal(F.shortHex('0xabc'), '0xabc');
assert.equal(F.hostOf('https://Example.com/a?b=1'), 'example.com');
assert.equal(F.hostOf('not a url'), 'not a url');
assert.equal(F.pathOf('https://example.com/a/b?x=1'), '/a/b?x=1');
assert.equal(F.plural(1, 'audit'), '1 audit');
assert.equal(F.plural(3, 'audit'), '3 audits');
assert.equal(F.formatDateTime(0), 'not yet');
for (const [url, ok] of [['https://example.com/', true], ['http://example.com/', false], ['https://localhost/', false], ['https://127.0.0.1/', false], ['https://intranet/', false], ['https://x.internal/', false], ['nonsense', false]]) {
  assert.equal(F.isPublicHost(url), ok, url);
}
// every enum has a label/tone everywhere it is used
for (const v of ['KEPT','MOVED_DISCLOSED','MOVED_SILENTLY','INCOMPLETE','INCONCLUSIVE']) {
  for (const m of ['VERDICT_LABEL','VERDICT_TONE','VERDICT_HEADLINE','VERDICT_EXPLANATION']) assert.ok(F[m][v], m + ' ' + v);
}
for (const s of ['UNAUDITED','HELD','REVISED','PARTIAL','BREACHED']) { assert.ok(F.STANDING_LABEL[s]); assert.ok(F.STANDING_TONE[s]); }
for (const s of ['KEPT','MOVED_DISCLOSED','MOVED_SILENT','NOT_ADDRESSED','UNSUPPORTED']) { assert.ok(F.STATUS_LABEL[s]); assert.ok(F.STATUS_TONE[s]); }
assert.match(F.explainFlag('anchors_intact_silent_claim_rejected'), /anchor/);
assert.match(F.explainFlag('something_new'), /could not be verified/);
console.log('client pure-logic checks passed');

// --- formatGen: wei to a readable GEN amount
assert.equal(F.formatGen(0n), '0');
assert.equal(F.formatGen(100n * 10n ** 18n), '100');
assert.equal(F.formatGen(1500000000000000000n), '1.5');
assert.equal(F.formatGen(1234567890000000000n, 3), '1.234');
assert.equal(F.formatGen(1000n), '0', 'dust below the displayed precision is not shown');
