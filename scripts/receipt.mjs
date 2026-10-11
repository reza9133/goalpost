// Pure transaction-receipt helpers for the command-line scripts. This is a plain JavaScript
// twin of src/lib/receipt.ts so the scripts run on Node 20 without TypeScript support.
// tests/node/scripts_parity.mjs proves the two implementations agree.

const STATUS_BY_CODE = {
  0: 'UNINITIALIZED',
  1: 'PENDING',
  2: 'PROPOSING',
  3: 'COMMITTING',
  4: 'REVEALING',
  5: 'ACCEPTED',
  6: 'UNDETERMINED',
  7: 'FINALIZED',
  8: 'CANCELED',
  9: 'APPEAL_REVEALING',
  10: 'APPEAL_COMMITTING',
};

export const DECIDED = new Set(['ACCEPTED', 'FINALIZED']);
export const FAILED = new Set(['UNDETERMINED', 'CANCELED', 'LEADER_TIMEOUT', 'VALIDATORS_TIMEOUT']);

export function jsonText(value) {
  try {
    return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item)) ?? '';
  } catch {
    return '';
  }
}

export function statusNameOf(transaction) {
  const tx = transaction ?? null;
  if (!tx) return 'UNKNOWN';
  const named = tx.statusName ?? tx.status_name;
  if (typeof named === 'string' && named.length > 0) return named.toUpperCase().replace(/[\s-]+/g, '_');
  const raw = tx.status;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return STATUS_BY_CODE[Number(raw)] ?? `STATUS_${raw}`;
  if (typeof raw === 'string' && raw.length > 0) return raw.toUpperCase().replace(/[\s-]+/g, '_');
  if (typeof raw === 'number' || typeof raw === 'bigint') return STATUS_BY_CODE[Number(raw)] ?? `STATUS_${String(raw)}`;
  return 'UNKNOWN';
}

export function phaseOf(statusName) {
  if (DECIDED.has(statusName)) return 'decided';
  if (FAILED.has(statusName)) return 'failed';
  if (statusName === 'PENDING' || statusName === 'UNINITIALIZED' || statusName === 'UNKNOWN') return 'queued';
  return 'consensus';
}

function firstLeaderReceipt(transaction) {
  const consensus = transaction?.consensus_data ?? transaction?.consensusData;
  const receipts = consensus?.leader_receipt ?? consensus?.leaderReceipt;
  const first = Array.isArray(receipts) ? receipts[0] : undefined;
  return first && typeof first === 'object' ? first : null;
}

function cleanErrorText(text) {
  const user = text.match(/UserError[^\n:]*:\s*(.+)/);
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  const picked = (user ? user[1] : lines[lines.length - 1] ?? text).trim().replace(/^['"]+|['"]+$/g, '');
  return picked.length > 300 ? `${picked.slice(0, 297)}...` : picked;
}

/** Null when execution succeeded; otherwise the best available reason the contract gave. */
export function executionFailure(transaction) {
  const leader = firstLeaderReceipt(transaction);
  const result = String(leader?.execution_result ?? leader?.executionResult ?? transaction?.txExecutionResultName ?? '').toUpperCase();
  const failed = result !== '' && result !== 'SUCCESS' && result !== 'FINISHED_WITH_RETURN';
  if (!failed) return null;

  const payload = leader?.result?.payload;
  const candidates = [leader?.genvm_result?.stderr, payload?.readable, typeof payload === 'string' ? payload : undefined];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return cleanErrorText(candidate);
  }
  return 'The contract rejected this transaction. Open it in the explorer for the execution log.';
}

export function findIdInReceipt(receipt, prefix) {
  const match = jsonText(receipt).match(new RegExp(`${prefix}-\\d{4,}`));
  return match ? match[0] : null;
}
