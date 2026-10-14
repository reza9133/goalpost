// Pure helpers for scripts/evidence.mjs: reading validator votes out of a transaction and
// rendering a run as a Markdown evidence file. No network and no SDK import, so they are unit
// tested in tests/node/evidence_lib.mjs. Nothing here invents data: every value comes from a
// transaction object the network returned, and a field the network did not return is printed as
// "not reported", never guessed.

export const EXPLORER = 'https://explorer-studio.genlayer.com';

export function explorerTx(hash) {
  return `${EXPLORER}/tx/${hash}`;
}

const AGREE = new Set(['AGREE', 'AGREED', 'ACCEPT', 'ACCEPTED']);
const DISAGREE = new Set(['DISAGREE', 'DISAGREED', 'REJECT', 'REJECTED']);
const TIMEOUT = new Set(['TIMEOUT', 'TIMED_OUT']);

function bucket(value) {
  const name = String(value ?? '').toUpperCase().replace(/[\s-]+/g, '_');
  if (AGREE.has(name)) return 'agree';
  if (DISAGREE.has(name)) return 'disagree';
  if (TIMEOUT.has(name)) return 'timeout';
  return 'other';
}

/**
 * Validator votes on the final round, as the transaction reports them. Studio has used both a map
 * of validator address to vote and an array of validator receipts carrying a vote.
 * Returns null when the transaction carries no votes at all.
 */
export function votesOf(transaction) {
  const consensus = transaction?.consensus_data ?? transaction?.consensusData;
  if (!consensus || typeof consensus !== 'object') return null;
  const entries = [];
  const votes = consensus.votes;
  if (votes && typeof votes === 'object' && !Array.isArray(votes)) {
    for (const [validator, vote] of Object.entries(votes)) entries.push({ validator, vote: bucket(vote) });
  }
  const validators = consensus.validators;
  if (entries.length === 0 && Array.isArray(validators)) {
    validators.forEach((entry, index) => {
      if (entry && typeof entry === 'object' && entry.vote !== undefined) {
        entries.push({ validator: String(entry.node_config?.address ?? entry.address ?? `validator-${index + 1}`), vote: bucket(entry.vote) });
      }
    });
  }
  if (entries.length === 0) return null;
  const count = (kind) => entries.filter((entry) => entry.vote === kind).length;
  return { total: entries.length, agree: count('agree'), disagree: count('disagree'), timeout: count('timeout'), other: count('other'), entries };
}

export function votesCell(votes) {
  if (!votes) return 'not reported';
  const parts = [`${votes.agree} agree`, `${votes.disagree} disagree`];
  if (votes.timeout > 0) parts.push(`${votes.timeout} timeout`);
  if (votes.other > 0) parts.push(`${votes.other} other`);
  return `${parts.join(', ')} (of ${votes.total})`;
}

const cell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** One row per transaction. `decision` is the network status, `execution` the contract call's result. */
export function txTable(rows) {
  const lines = [
    '| # | call | note | hash | decision | execution | finality | validator votes |',
    '|---|---|---|---|---|---|---|---|',
  ];
  rows.forEach((row, index) => {
    lines.push(
      `| ${index + 1} | \`${cell(row.call)}\` | ${cell(row.note ?? '')} | [${cell(row.hash)}](${explorerTx(row.hash)}) | ${cell(row.decision)} | ${cell(row.execution)} | ${cell(row.finality)} | ${cell(votesCell(row.votes))} |`,
    );
  });
  return lines.join('\n');
}

export function finalityLabel(finality) {
  if (finality === 'finalized') return 'FINALIZED';
  if (finality === 'accepted') return 'ACCEPTED (not final when recorded)';
  return 'not reached';
}

/** Markdown for one scenario run. `audit` and `pledge` are the contract's own JSON, when a settled audit exists. */
export function renderEvidence({ title, intro, contract, site, signer, startedAt, rows, pledgeId, audit, pledge, outcomes, notes }) {
  const out = [];
  out.push(`# ${title}`, '');
  if (intro) out.push(intro, '');
  out.push(`- Contract: ${contract}`);
  out.push(`- Site serving the evidence pages: ${site}`);
  out.push(`- Signer: ${signer}`);
  out.push(`- Run started (UTC): ${startedAt}`);
  if (pledgeId) out.push(`- Pledge: ${pledgeId}`);
  out.push('', '## Transactions', '', txTable(rows), '');
  if (outcomes && outcomes.length > 0) {
    out.push('## Outcomes', '');
    for (const line of outcomes) out.push(`- ${line}`);
    out.push('');
  }
  if (audit) {
    out.push('## Settled audit', '');
    out.push('| Property | Value |', '|---|---|');
    out.push(`| Audit ID | \`${audit.audit_id}\` |`);
    out.push(`| Report | ${audit.report_url} |`);
    out.push(`| Verdict | \`${audit.verdict}\` |`);
    out.push(`| State | \`${audit.state}\` |`);
    if (audit.failure_reason) out.push(`| Failure reason | \`${audit.failure_reason}\` |`);
    out.push(`| Silent keys | \`${JSON.stringify(audit.silent_keys)}\` |`);
    if (pledge) {
      out.push(`| Pledge standing | \`${pledge.standing}\` (silent moves on record: ${pledge.strikes}) |`);
      out.push(`| Pledge commitment digest | \`${pledge.commitment}\` |`);
    }
    out.push(`| Attestation digest | \`${audit.attestation}\` |`, '');
    if (audit.elements.length > 0) {
      out.push('### Element classifications', '');
      for (const element of audit.elements) {
        out.push(`- **${element.key}**: \`${element.status}\`${element.flag ? ` (flag: ${element.flag})` : ''}`);
        if (element.report_excerpt) out.push(`  - report excerpt: "${element.report_excerpt}"`);
        if (element.disclosure_excerpt) out.push(`  - disclosure excerpt: "${element.disclosure_excerpt}"`);
        if (element.reason) out.push(`  - reason: "${element.reason}"`);
      }
      out.push('');
    }
  }
  if (notes && notes.length > 0) {
    out.push('## Notes', '');
    for (const note of notes) out.push(`- ${note}`);
    out.push('');
  }
  return out.join('\n');
}

/** A short, honest label for how an evaluate transaction ended. */
export function describeEvaluation(result) {
  if (result.finality !== null) return `decided ${result.statusName}, execution ${result.execution}, ${finalityLabel(result.finality)}`;
  if (result.execution === 'failed') return `decided ${result.statusName} but the contract call failed: ${result.failure}`;
  return `no settled result: ${result.failure ?? result.statusName}`;
}
