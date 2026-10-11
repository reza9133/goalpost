// Pure parsing of GenLayer transaction objects. No network access and no SDK import, so it
// can be tested in isolation. Studio's transaction shape varies a little between versions,
// so every field is read defensively and unknown shapes degrade to a generic message.

export type Phase = 'signing' | 'submitted' | 'queued' | 'consensus' | 'decided' | 'failed';

export function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item)) ?? '';
  } catch {
    return '';
  }
}


// ---------------------------------------------------------------------- receipt parsing

// Studio reports numeric status codes. These are the codes used by the stable consensus
// contracts; only ACCEPTED (5) and FINALIZED (7) drive behaviour and they are stable.
const STATUS_BY_CODE: Record<number, string> = {
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

export function statusNameOf(transaction: unknown): string {
  const tx = transaction as Record<string, unknown> | null;
  if (!tx) return 'UNKNOWN';
  const named = tx.statusName ?? tx.status_name;
  if (typeof named === 'string' && named.length > 0) return named.toUpperCase().replace(/[\s-]+/g, '_');
  const raw = tx.status;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return STATUS_BY_CODE[Number(raw)] ?? `STATUS_${raw}`;
  if (typeof raw === 'string' && raw.length > 0) return raw.toUpperCase().replace(/[\s-]+/g, '_');
  if (typeof raw === 'number' || typeof raw === 'bigint') return STATUS_BY_CODE[Number(raw)] ?? `STATUS_${String(raw)}`;
  return 'UNKNOWN';
}

export function phaseOf(statusName: string): Phase {
  if (DECIDED.has(statusName)) return 'decided';
  if (FAILED.has(statusName)) return 'failed';
  if (statusName === 'PENDING' || statusName === 'UNINITIALIZED' || statusName === 'UNKNOWN') return 'queued';
  return 'consensus';
}

function firstLeaderReceipt(transaction: unknown): Record<string, unknown> | null {
  const tx = transaction as Record<string, unknown> | null;
  const consensus = (tx?.consensus_data ?? tx?.consensusData) as Record<string, unknown> | undefined;
  const receipts = (consensus?.leader_receipt ?? consensus?.leaderReceipt) as unknown[] | undefined;
  const first = Array.isArray(receipts) ? receipts[0] : undefined;
  return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
}

function cleanErrorText(text: string): string {
  const user = text.match(/UserError[^\n:]*:\s*(.+)/);
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  const picked = (user ? user[1] : lines[lines.length - 1] ?? text).trim().replace(/^['"]+|['"]+$/g, '');
  return picked.length > 300 ? `${picked.slice(0, 297)}...` : picked;
}

/** Null when execution succeeded; otherwise the best available reason the contract gave. */
export function executionFailure(transaction: unknown): string | null {
  const tx = transaction as Record<string, unknown> | null;
  const leader = firstLeaderReceipt(transaction);
  const result = String(leader?.execution_result ?? leader?.executionResult ?? tx?.txExecutionResultName ?? '').toUpperCase();
  const failed = result !== '' && result !== 'SUCCESS' && result !== 'FINISHED_WITH_RETURN';
  if (!failed) return null;

  const genvm = leader?.genvm_result as Record<string, unknown> | undefined;
  const payload = (leader?.result as Record<string, unknown> | undefined)?.payload;
  const readable = (payload as Record<string, unknown> | undefined)?.readable;
  const candidates = [genvm?.stderr, readable, typeof payload === 'string' ? payload : undefined];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return cleanErrorText(candidate);
  }
  return 'The contract rejected this transaction. Open it in the explorer for the execution log.';
}

/** Find an id such as PLG-0003 or AUD-0012 that the transaction's return value carries. */
export function findIdInReceipt(receipt: unknown, prefix: 'PLG' | 'AUD'): string | null {
  const match = jsonText(receipt).match(new RegExp(`${prefix}-\\d{4,}`));
  return match ? match[0] : null;
}

