import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const at = (relative) => path.join(ROOT, relative);

const V = await import(at('src/lib/validate.ts'));

const scen = JSON.parse(fs.readFileSync(at('src/data/scenarios.json'),'utf8')).scenarios;
const draftFrom = (s, origin='https://goalpost.example') => ({
  title: s.title, kind: s.kind, pledgeUrl: origin + s.pledge_path, reportPrefix: origin + s.report_prefix_path,
  elements: s.elements.map((e,i)=>({id:i,key:e.key,dimension:e.dimension,quote:e.quote,anchors:e.anchors.join(', ')})),
});

// shipped scenarios must satisfy the client mirror of the contract rules
for (const s of scen) { const r = V.validateDraft(draftFrom(s)); assert.equal(r.ok, true, s.id + ' ' + JSON.stringify(r.errors)); }

// rejections mirror the contract
const base = draftFrom(scen[0]);
const bad = (patch) => V.validateDraft({ ...base, ...patch });
assert.ok(bad({ title: 'x' }).errors.title);
assert.ok(bad({ pledgeUrl: 'http://goalpost.example/p' }).errors.pledgeUrl);
assert.ok(bad({ pledgeUrl: 'https://localhost/p' }).errors.pledgeUrl);
assert.ok(bad({ pledgeUrl: 'https://127.0.0.1/p' }).errors.pledgeUrl);
assert.ok(bad({ pledgeUrl: 'https://goalpost.example:8443/p' }).errors.pledgeUrl);
assert.ok(bad({ reportPrefix: 'https://goalpost.example/evidence/meridian/reports' }).errors.reportPrefix);
assert.ok(bad({ reportPrefix: 'https://other.example/reports/' }).errors.reportPrefix);
assert.equal(bad({ elements: [] }).ok, false);
assert.equal(bad({ elements: Array.from({length:7},(_,i)=>({id:i,key:'key_'+i,dimension:'target',quote:'quote number '+i+' is long enough',anchors:''})) }).ok, false);

const withEl = (patch) => V.validateDraft({ ...base, elements: [{ ...base.elements[0], ...patch }] }).errors.perElement[0];
assert.ok(withEl({ key: 'Bad-Key' }).key);
assert.ok(withEl({ quote: 'too short' }).quote);
assert.ok(withEl({ anchors: 'intensity' }).anchors);          // anchor not in quote
assert.ok(withEl({ anchors: 'absolute, ABSOLUTE' }).anchors);   // duplicate
assert.ok(withEl({ anchors: 'a, b, c, d, e' }).anchors);        // too many (also not in quote)
assert.ok(withEl({ anchors: '' }).anchors);                      // at least one anchor is required
assert.deepEqual(withEl({ anchors: 'absolute' }), {});
// duplicate keys / quotes across elements
const dup = V.validateDraft({ ...base, elements: [base.elements[0], { ...base.elements[1], key: base.elements[0].key }] });
assert.ok(dup.errors.perElement[1].key);
const dupQ = V.validateDraft({ ...base, elements: [base.elements[0], { ...base.elements[1], quote: base.elements[0].quote.toUpperCase() }] });
assert.ok(dupQ.errors.perElement[1].quote);

// publisher scope: a hostname is not a publisher
const shared = (pledgeUrl, reportPrefix) => V.validateDraft({ ...base, pledgeUrl, reportPrefix }).errors.reportPrefix;
assert.equal(shared('https://gist.githubusercontent.com/alice/p/raw/pledge.txt', 'https://gist.githubusercontent.com/alice/'), undefined);
assert.match(shared('https://gist.githubusercontent.com/alice/p/raw/pledge.txt', 'https://gist.githubusercontent.com/bob/'), /publisher scope/);
assert.match(shared('https://gist.githubusercontent.com/alice/p/raw/pledge.txt', 'https://gist.githubusercontent.com/'), /publisher namespace/);
assert.equal(V.validateDraft({ ...base, pledgeUrl: 'https://pastebin.com/raw/abc', reportPrefix: 'https://pastebin.com/raw/' }).ok, false);
assert.equal(V.publisherScope('https://GitHub.com/ACME/repo', 'u').scope, 'github.com/acme');

// normalisation matches the contract's documented folding
assert.equal(V.normalize('Cut  \u201cabsolute\u201d\n emissions \u2014 40%'), 'cut "absolute" emissions - 40%');
assert.deepEqual(V.splitAnchors('absolute, 40%\n2030 ,  '), ['absolute', '40%', '2030']);

// report URL rules
const prefix = 'https://goalpost.example/evidence/meridian/reports/';
assert.equal(V.reportUrlProblem(prefix + '2026.html', prefix), null);
assert.equal(V.reportUrlProblem('https://GOALPOST.example/evidence/meridian/reports/x.html', prefix), null);
for (const u of [
  'https://goalpost.example/evidence/meridian/reports/../pledge.html',
  'https://goalpost.example/evidence/meridian/reports/../../halden/reports/final-faithful.html',
  'https://goalpost.example/evidence/meridian/reports/%2e%2e/pledge.html',
  'https://goalpost.example/evidence/meridian/reports/./x.html',
  'https://goalpost.example/evidence/meridian/reports/..;/pledge.html',
]) {
  assert.ok(V.reportUrlProblem(u, prefix), u);
}
assert.ok(V.reportUrlProblem('https://goalpost.example/evidence/meridian/reports/x.html?v=2', prefix));
assert.ok(bad({ reportPrefix: 'https://goalpost.example/evidence/meridian/reports/?x=/' }).errors.reportPrefix);
for (const u of ['https://goalpost.example/evidence/halden/reports/x.html', 'https://goalpost.example.evil.com/evidence/meridian/reports/x.html', 'https://goalpost.example/evidence/meridian/reports', 'http://goalpost.example/evidence/meridian/reports/x.html', '']) {
  assert.ok(V.reportUrlProblem(u, prefix), u);
}
assert.ok(V.periodProblem('')); assert.ok(V.periodProblem('x'.repeat(41))); assert.equal(V.periodProblem('FY2026'), null);
console.log('validation mirror checks passed');
