#!/usr/bin/env node
// Live end-to-end run against a deployed Goalpost contract on Studionet.
//
//   npm run e2e -- --site https://YOUR-SITE.pages.dev
//
// Flags
//   --site <origin>      Public origin that serves /evidence. Validators fetch from here. Required.
//   --scenario <id>      meridian (default) or halden
//   --report <id>        faithful, silent, disclosed or partial (default silent)
//   --integrity          also ask validators to re-verify the pledge page
//   --address <0x...>    contract address (default: artifacts/deployment.json, then VITE_CONTRACT_ADDRESS)
//
// What it proves: a pledge can be frozen from a live page, a report under the frozen prefix
// can be submitted and evaluated, and the on-chain attestation can be recomputed. The verdict
// depends on real validators and real models, so a different verdict than the one expected is
// reported, not treated as an error. Broken contract invariants are errors.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ROOT, RPC_URL, loadKey, makeClient, parseArgs, readJson, readText, send } from './lib.mjs';

const { flags, values } = parseArgs(process.argv.slice(2));

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

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
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS)) fail('No contract address. Pass --address, run the deploy script first, or set VITE_CONTRACT_ADDRESS.');

const SITE = (values.site || '').replace(/\/+$/, '');
if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(SITE)) {
  fail('Pass --site with the public https origin that serves /evidence, for example --site https://goalpost.pages.dev');
}

const scenarios = JSON.parse(readText('src/data/scenarios.json')).scenarios;
const scenario = scenarios.find((item) => item.id === (values.scenario || 'meridian'));
if (!scenario) fail(`Unknown scenario. Choose one of: ${scenarios.map((item) => item.id).join(', ')}`);
const report = scenario.reports.find((item) => item.id === (values.report || 'silent'));
if (!report) fail(`Unknown report. Choose one of: ${scenario.reports.map((item) => item.id).join(', ')}`);

const { key, generated } = loadKey();
const { client, account } = makeClient(key);

function check(condition, message) {
  if (!condition) fail(`Invariant broken: ${message}`);
  console.log(`  ok  ${message}`);
}

async function main() {
  console.log('Goalpost end-to-end');
  console.log(`  contract  ${ADDRESS}`);
  console.log(`  rpc       ${RPC_URL}`);
  console.log(`  signer    ${account.address}${generated ? '  (throwaway key)' : ''}`);
  console.log(`  evidence  ${SITE}/evidence  (${scenario.id} / ${report.id})`);

  console.log('\n1. Reachability of the evidence');
  for (const urlPath of [scenario.pledge_path, report.path]) {
    const response = await fetch(SITE + urlPath);
    if (!response.ok) fail(`${SITE + urlPath} answered ${response.status}. Validators need to read it too. Check your Cloudflare Bot Fight Mode and WAF rules for /evidence/*.`);
    console.log(`  ok  ${response.status} ${SITE + urlPath}`);
  }

  console.log('\n2. Contract');
  const info = await readJson(client, ADDRESS, 'contract_info');
  const before = await readJson(client, ADDRESS, 'stats');
  console.log(`  ${info.name} ${info.version}, ${before.pledges} pledges, ${before.audits} audits`);

  console.log('\n3. Freeze the pledge');
  const pledgeUrl = SITE + scenario.pledge_path;
  const elements = JSON.stringify(scenario.elements);
  let pledgeId = null;
  try {
    await send(client, ADDRESS, 'register_pledge', [scenario.title, scenario.kind, pledgeUrl, SITE + scenario.report_prefix_path, elements], 'register_pledge');
  } catch (error) {
    if (!/already registered/i.test(String(error.message))) throw error;
    console.log('  this exact pledge already exists; reusing it');
  }
  const list = await readJson(client, ADDRESS, 'list_pledges', [0, 50]);
  const mine = list.items.find((item) => item.pledge_url === pledgeUrl);
  pledgeId = mine?.pledge_id ?? null;
  if (!pledgeId) fail('The pledge was not found in the ledger after registration.');
  const pledgeBundle = await readJson(client, ADDRESS, 'get_pledge_bundle', [pledgeId]);
  check(pledgeBundle.pledge.elements.length === scenario.elements.length, `${pledgeId} froze ${scenario.elements.length} elements`);
  check(pledgeBundle.pledge.integrity.state === 'VERIFIED', 'every frozen quote was verified on the live page');

  if (flags.has('integrity')) {
    console.log('\n3b. Re-verify the pledge page');
    await send(client, ADDRESS, 'check_pledge_integrity', [pledgeId], 'check_pledge_integrity');
    const after = await readJson(client, ADDRESS, 'get_pledge_bundle', [pledgeId]);
    console.log(`  integrity: ${after.pledge.integrity.state}, edits detected: ${after.pledge.integrity.edits_detected}`);
  }

  console.log('\n4. Submit and evaluate the report');
  const reportUrl = SITE + report.path;
  let auditId = pledgeBundle.audits.find((audit) => audit.report_url === reportUrl && audit.state === 'PENDING')?.audit_id ?? null;
  if (!auditId) {
    await send(client, ADDRESS, 'submit_report', [pledgeId, reportUrl, report.period], 'submit_report');
    const refreshed = await readJson(client, ADDRESS, 'get_pledge_bundle', [pledgeId]);
    auditId = [...refreshed.audits].reverse().find((audit) => audit.report_url === reportUrl && audit.state === 'PENDING')?.audit_id ?? null;
  }
  if (!auditId) fail('The submitted report was not found as a pending audit.');
  console.log(`  audit ${auditId}`);
  await send(client, ADDRESS, 'evaluate_report', [auditId], 'evaluate_report (validators read the report; this can take a few minutes)');

  console.log('\n5. Result');
  const { audit, pledge } = await readJson(client, ADDRESS, 'get_audit_bundle', [auditId]);
  check(audit.state === 'SETTLED', `${auditId} is settled`);
  console.log(`\n  verdict   ${audit.verdict}   (expected for this report: ${report.expected})`);
  console.log(`  standing  ${pledge.standing}, silent moves on record: ${pledge.strikes}`);
  if (audit.failure_reason) console.log(`  failure   ${audit.failure_reason}`);
  for (const element of audit.elements) {
    console.log(`\n  [${element.status}] ${element.key}${element.flag ? `  (${element.flag})` : ''}`);
    if (element.report_excerpt) console.log(`      report: "${element.report_excerpt}"`);
    if (element.disclosure_excerpt) console.log(`      disclosure: "${element.disclosure_excerpt}"`);
  }

  console.log('\n6. Attestation');
  const recomputed = await client.readContract({ address: ADDRESS, functionName: 'recompute_attestation', args: [auditId] });
  check(String(recomputed) === audit.attestation, 'the attestation recomputes to the stored value');

  const unsupported = audit.elements.filter((element) => element.status === 'UNSUPPORTED').length;
  const matched = audit.verdict === report.expected;
  console.log(`\nDone. ${matched ? 'The verdict matches the expectation.' : `The verdict differs from the expectation (${unsupported} unverifiable elements). Real models are not deterministic; inspect the excerpts above.`}`);
  console.log(`Open it in the app: /audits/${auditId}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
