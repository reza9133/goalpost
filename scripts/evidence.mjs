#!/usr/bin/env node
// Produces LIVE Studionet evidence for every outcome the contract can reach, as Markdown files in
// evidence/. Run it from a machine that can reach Studionet and the public site that serves /evidence.
//
//   npm run evidence -- --site https://YOUR-SITE.pages.dev
//   npm run evidence -- --site https://YOUR-SITE.pages.dev --only silent,inconclusive --await-finality
//
// Flags
//   --site <origin>       Public https origin serving /evidence and the /evidence/flapping function. Required.
//   --only <list>         Comma list of: kept, silent, disclosed, inconclusive, adversarial (default: all)
//   --attempts <n>        Evaluation attempts for the adversarial scenario (default 3)
//   --await-finality      After each ACCEPTED transaction, keep polling until FINALIZED (slow)
//   --address <0x...>     Contract address (default: artifacts/deployment.json, then VITE_CONTRACT_ADDRESS)
//
// Scenarios
//   kept          Meridian pledge, faithful report                  -> KEPT
//   silent        Meridian pledge, silently redefined report        -> MOVED_SILENTLY (a strike is recorded)
//   disclosed     Meridian pledge, report that admits its changes   -> MOVED_DISCLOSED
//   inconclusive  Meridian pledge, report page with no readable text -> INCONCLUSIVE (EMPTY), no model call
//   adversarial   A pledge whose report URL serves a different document on every request. Independent
//                 validators read different reports, so they disagree and nothing is recorded, or only a
//                 majority reading is. The run records what the network actually did on every attempt.
//
// Honesty rules: nothing is written to evidence/ unless a transaction really ran. Every value comes
// from the network; a field it did not return is printed as "not reported". Verdicts that differ from
// the expectation are recorded as they are. Real validators and real models are not deterministic.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describeEvaluation, finalityLabel, renderEvidence, votesOf } from './evidence-lib.mjs';
import { ROOT, RPC_URL, loadKey, makeClient, parseArgs, readJson, readText, waitForDecision } from './lib.mjs';

const { flags, values } = parseArgs(process.argv.slice(2));
const fail = (message) => {
  console.error(`\n${message}`);
  process.exit(1);
};

function resolveAddress() {
  if (values.address) return values.address;
  const artifact = path.join(ROOT, 'artifacts', 'deployment.json');
  if (existsSync(artifact)) return JSON.parse(readFileSync(artifact, 'utf8')).address;
  for (const file of ['.env.local', '.env']) {
    const target = path.join(ROOT, file);
    if (!existsSync(target)) continue;
    const match = readFileSync(target, 'utf8').match(/^VITE_CONTRACT_ADDRESS=(0x[0-9a-fA-F]{40})$/m);
    if (match) return match[1];
  }
  return process.env.VITE_CONTRACT_ADDRESS || '';
}

const ADDRESS = resolveAddress();
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS)) fail('No contract address. Pass --address, deploy first, or set VITE_CONTRACT_ADDRESS.');
const SITE = (values.site || '').replace(/\/+$/, '');
if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(SITE)) fail('Pass --site with the public https origin that serves /evidence, for example --site https://goalpost.pages.dev');

const ALL = ['kept', 'silent', 'disclosed', 'inconclusive', 'adversarial'];
const chosen = (values.only ? values.only.split(',').map((item) => item.trim()) : ALL);
for (const name of chosen) if (!ALL.includes(name)) fail(`Unknown scenario "${name}". Choose from: ${ALL.join(', ')}`);
const ATTEMPTS = Math.max(1, Math.min(10, Number(values.attempts || 3)));
const AWAIT_FINALITY = flags.has('await-finality');

const scenarios = JSON.parse(readText('src/data/scenarios.json')).scenarios;
const meridian = scenarios.find((item) => item.id === 'meridian');
const reportOf = (id) => meridian.reports.find((item) => item.id === id);

const { key, generated } = loadKey();
const { client, account } = makeClient(key);
const startedAt = new Date().toISOString();
const dateStamp = startedAt.slice(0, 10);
mkdirSync(path.join(ROOT, 'evidence'), { recursive: true });

// ------------------------------------------------------------------------------- helpers

async function reachable(urlPath) {
  const response = await fetch(SITE + urlPath);
  if (!response.ok) fail(`${SITE + urlPath} answered ${response.status}. Validators must be able to read it too (check Bot Fight Mode and WAF rules for /evidence/*).`);
  return response;
}

/** Send one transaction and record what the network did. Never throws for a rejected or undecided transaction. */
async function transact(rows, functionName, args, note) {
  console.log(`  -> ${functionName}${note ? ` (${note})` : ''}`);
  const hash = String(
    await client.writeContract({ address: ADDRESS, functionName, args: args.map((v) => (typeof v === 'number' ? BigInt(v) : v)), value: 0n }),
  );
  console.log(`     submitted ${hash}`);
  const result = await waitForDecision(client, hash, {
    onStatus: (name) => console.log(`     status: ${name}`),
    waitForFinality: AWAIT_FINALITY,
  });
  const row = {
    call: functionName,
    note,
    hash,
    decision: result.statusName,
    execution: result.execution,
    finality: finalityLabel(result.finality),
    votes: votesOf(result.transaction),
  };
  rows.push(row);
  console.log(`     ${describeEvaluation(result)}`);
  return { ...result, hash };
}

async function registerPledge(rows, scenario, pledgePath, prefixPath) {
  const pledgeUrl = SITE + pledgePath;
  const result = await transact(rows, 'register_pledge', [scenario.title, scenario.kind, pledgeUrl, SITE + prefixPath, JSON.stringify(scenario.elements)], 'freeze the pledge');
  if (result.failure) {
    const already = String(result.failure).match(/already registered as (PLG-\d+)/);
    if (!already) fail(`register_pledge failed: ${result.failure}\nIf this mentions the reporting prefix, deploy the updated evidence pages first.`);
    console.log(`     the pledge already exists as ${already[1]}; reusing it`);
    return already[1];
  }
  const list = await readJson(client, ADDRESS, 'list_pledges', [0, 50]);
  const mine = list.items.find((item) => item.pledge_url === pledgeUrl);
  if (!mine) fail('The pledge was not found in the ledger after registration.');
  return mine.pledge_id;
}

async function submitReport(rows, pledgeId, reportUrl, period) {
  const result = await transact(rows, 'submit_report', [pledgeId, reportUrl, period], 'queue the report');
  const bundle = await readJson(client, ADDRESS, 'get_pledge_bundle', [pledgeId]);
  const audit = [...bundle.audits].reverse().find((item) => item.report_url === reportUrl && (result.failure === null ? item.state === 'PENDING' : true));
  if (!audit) fail(`The report ${reportUrl} is not queued. ${result.failure ?? ''}`);
  return audit.audit_id;
}

function save(name, markdown) {
  const file = path.join('evidence', `studionet-e2e-${name}-${dateStamp}.md`);
  writeFileSync(path.join(ROOT, file), markdown);
  console.log(`  wrote ${file}`);
  return file;
}

const header = { contract: ADDRESS, site: SITE, signer: account.address, startedAt };

// ----------------------------------------------------------------- single-report scenarios

async function runReport(name, title, intro, reportId, expectedVerdict) {
  console.log(`\n== ${name}: ${title}`);
  const report = reportOf(reportId);
  await reachable(meridian.pledge_path);
  await reachable(report.path);
  const rows = [];
  const pledgeId = await registerPledge(rows, meridian, meridian.pledge_path, meridian.report_prefix_path);
  const auditId = await submitReport(rows, pledgeId, SITE + report.path, report.period);
  const evaluation = await transact(rows, 'evaluate_report', [auditId], 'validators read the report; this can take minutes');

  const outcomes = [`evaluate_report: ${describeEvaluation(evaluation)}`];
  let audit = null;
  let pledge = null;
  const bundle = await readJson(client, ADDRESS, 'get_audit_bundle', [auditId]);
  if (bundle && bundle.audit.state === 'SETTLED') {
    audit = bundle.audit;
    pledge = bundle.pledge;
    const recomputed = String(await client.readContract({ address: ADDRESS, functionName: 'recompute_attestation', args: [auditId] }));
    outcomes.push(`verdict ${audit.verdict} (expected for this report: ${expectedVerdict}${audit.verdict === expectedVerdict ? ', matches' : ', DIFFERS: real validators and models are not deterministic'})`);
    outcomes.push(`attestation recomputes on chain to the stored value: ${recomputed === audit.attestation ? 'yes' : 'NO'}`);
  } else {
    outcomes.push('the audit is still PENDING: nothing was recorded for this report');
  }
  const stats = await readJson(client, ADDRESS, 'stats');
  save(name, renderEvidence({ ...header, title, intro, rows, pledgeId, audit, pledge, outcomes, notes: [`Ledger stats after the run: ${JSON.stringify(stats)}`] }));
}

// ----------------------------------------------------------------------------- adversarial

async function runAdversarial() {
  console.log('\n== adversarial: a publisher whose report changes on every request');
  const pledgePath = '/evidence/flapping/pledge.html';
  const prefixPath = '/evidence/flapping/reports/';
  await reachable(pledgePath);
  const scenario = { ...meridian, title: 'Adversarial publisher demonstration', pledge_path: pledgePath };
  const rows = [];
  const pledgeId = await registerPledge(rows, scenario, pledgePath, prefixPath);
  const outcomes = [];
  let lastAudit = null;
  let lastPledge = null;
  let agreed = 0;
  let blocked = 0;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const reportUrl = `${SITE}${prefixPath}attempt-${dateStamp}-${Date.now()}-${attempt}.html`;
    const auditId = await submitReport(rows, pledgeId, reportUrl, `FY2026-try-${attempt}`);
    const evaluation = await transact(rows, 'evaluate_report', [auditId], `attempt ${attempt}: each validator fetches a different document`);
    const bundle = await readJson(client, ADDRESS, 'get_audit_bundle', [auditId]);
    const settled = bundle && bundle.audit.state === 'SETTLED';
    if (settled) {
      agreed += 1;
      lastAudit = bundle.audit;
      lastPledge = bundle.pledge;
    } else {
      blocked += 1;
    }
    const votes = rows[rows.length - 1].votes;
    outcomes.push(
      `attempt ${attempt} (${auditId}): ${describeEvaluation(evaluation)}; on-chain audit state ${bundle ? bundle.audit.state : 'unknown'}` +
        (settled ? `, verdict ${bundle.audit.verdict}` : ', nothing recorded') +
        (votes ? `; votes ${votes.agree} agree / ${votes.disagree} disagree` : ''),
    );
  }
  outcomes.push(`summary: ${blocked} of ${ATTEMPTS} attempts ended without a recorded verdict, ${agreed} settled on a majority reading`);
  const stats = await readJson(client, ADDRESS, 'stats');
  save(
    'adversarial',
    renderEvidence({
      ...header,
      title: 'Goalpost on Studionet (Adversarial publisher: validators read different documents)',
      intro:
        'The reporting address of this pledge is served by a script that returns a different Meridian report (faithful, silently redefined or disclosed) on every request. ' +
        'Independent validators therefore read different documents at the same URL. The contract only records a verdict that the validators share, on every element classification.',
      rows,
      pledgeId,
      audit: lastAudit,
      pledge: lastPledge,
      outcomes,
      notes: [
        'The outcome of each attempt is whatever the network did. A settled attempt means a majority of validators happened to read documents they classified identically, and then the recorded verdict is that majority reading.',
        'An attempt without a recorded verdict is the intended result: validators that read different documents cannot agree, so nothing is written and the audit stays PENDING.',
        `Ledger stats after the run: ${JSON.stringify(stats)}`,
      ],
    }),
  );
}

// ---------------------------------------------------------------------------------- main

async function main() {
  console.log('Goalpost live evidence run');
  console.log(`  contract  ${ADDRESS}`);
  console.log(`  rpc       ${RPC_URL}`);
  console.log(`  signer    ${account.address}${generated ? '  (throwaway key)' : ''}`);
  console.log(`  site      ${SITE}`);
  console.log(`  scenarios ${chosen.join(', ')}${AWAIT_FINALITY ? '   (waiting for finality)' : ''}`);
  const info = await readJson(client, ADDRESS, 'contract_info');
  if (!info.authority) fail(`The contract at ${ADDRESS} is version ${info.version}, which predates publisher-authority binding. Deploy the current contract first.`);
  console.log(`  contract version ${info.version}`);

  const plan = {
    kept: () => runReport('kept', 'Goalpost on Studionet (Kept)', 'A faithful restatement of the frozen pledge.', 'faithful', 'KEPT'),
    silent: () => runReport('silent', 'Goalpost on Studionet (Silent move)', 'A report that redefines the target and its scope without saying so.', 'silent', 'MOVED_SILENTLY'),
    disclosed: () => runReport('disclosed', 'Goalpost on Studionet (Disclosed change)', 'A report that changes the definition and says so.', 'disclosed', 'MOVED_DISCLOSED'),
    inconclusive: () => runReport('inconclusive', 'Goalpost on Studionet (Inconclusive)', 'A report page that carries no readable text. Validators agree on the unreadable outcome without any model call, so the audit settles INCONCLUSIVE and the pledge standing is unchanged.', 'withheld', 'INCONCLUSIVE'),
    adversarial: runAdversarial,
  };
  for (const name of chosen) await plan[name]();
  console.log('\nDone. Review the files in evidence/ and commit them.');
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
