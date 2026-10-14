// Pure parsing of GenLayer transaction objects. No network access and no SDK import, so it
// can be tested in isolation. Studio's transaction shape varies a little between versions,
// so every field is read defensively and unknown shapes degrade to a generic message.

// A transaction that the validators agreed on is ACCEPTED first. ACCEPTED means the consensus round
// succeeded, but the result can still be appealed. Only FINALIZED means it can no longer change.
// The two are different phases on purpose, and neither of them says the contract call worked:
// that is a separate fact, read from the execution result (see executionOf).
export type Phase = 'signing' | 'submitted' | 'queued' | 'consensus' | 'accepted' | 'finalized' | 'failed';

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

export const ACCEPTED = 'ACCEPTED';
export const FINALIZED = 'FINALIZED';
export const DECIDED = new Set([ACCEPTED, FINALIZED]);
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
  if (statusName === FINALIZED) return 'finalized';
  if (statusName === ACCEPTED) return 'accepted';
  if (FAILED.has(statusName)) return 'failed';
  if (statusName === 'PENDING' || statusName === 'UNINITIALIZED' || statusName === 'UNKNOWN') return 'queued';
  return 'consensus';
}

/** True once polling for the validators' decision can stop: accepted, finalized or failed. */
export function isDecision(phase: Phase): boolean {
  return phase === 'accepted' || phase === 'finalized' || phase === 'failed';
}

function leaderReceipts(transaction: unknown): Record<string, unknown>[] {
  const tx = transaction as Record<string, unknown> | null;
  const consensus = (tx?.consensus_data ?? tx?.consensusData) as Record<string, unknown> | undefined;
  const receipts = (consensus?.leader_receipt ?? consensus?.leaderReceipt) as unknown[] | undefined;
  return Array.isArray(receipts) ? receipts.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object') : [];
}

function cleanErrorText(text: string): string {
  const user = text.match(/UserError[^\n:]*:\s*(.+)/);
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  const picked = (user ? user[1] : lines[lines.length - 1] ?? text).trim().replace(/^['"]+|['"]+$/g, '');
  return picked.length > 300 ? `${picked.slice(0, 297)}...` : picked;
}

function failureText(leader: Record<string, unknown> | undefined): string {
  const genvm = leader?.genvm_result as Record<string, unknown> | undefined;
  const payload = (leader?.result as Record<string, unknown> | undefined)?.payload;
  const readable = (payload as Record<string, unknown> | undefined)?.readable;
  const candidates = [genvm?.stderr, readable, typeof payload === 'string' ? payload : undefined];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return cleanErrorText(candidate);
  }
  return 'The contract rejected this transaction. Open it in the explorer for the execution log.';
}

const EXECUTION_SUCCESS = new Set(['SUCCESS', 'FINISHED_WITH_RETURN']);

/**
 * What running the contract call produced. `success` needs an explicit success result from the
 * transaction. A missing or unreadable result is `unknown`, never success: a transaction can be
 * ACCEPTED by consensus while the contract call itself raised an error and wrote nothing.
 */
export type Execution = { state: 'success' } | { state: 'failed'; message: string } | { state: 'unknown' };

export function executionOf(transaction: unknown): Execution {
  const tx = transaction as Record<string, unknown> | null;
  const receipts = leaderReceipts(transaction);
  const results: Array<{ result: string; receipt?: Record<string, unknown> }> = [];
  for (const receipt of receipts) {
    const result = String(receipt.execution_result ?? receipt.executionResult ?? '').toUpperCase();
    if (result !== '') results.push({ result, receipt });
  }
  const named = String(tx?.txExecutionResultName ?? tx?.tx_execution_result_name ?? '').toUpperCase();
  if (named !== '' && named !== 'NOT_VOTED') results.push({ result: named });

  if (results.length === 0) return { state: 'unknown' };
  const bad = results.find((entry) => !EXECUTION_SUCCESS.has(entry.result));
  if (bad === undefined) return { state: 'success' };
  return { state: 'failed', message: failureText(bad.receipt ?? receipts[0]) };
}

/** Null unless the contract call itself failed. An unreadable result is not reported as a failure here. */
export function executionFailure(transaction: unknown): string | null {
  const execution = executionOf(transaction);
  return execution.state === 'failed' ? execution.message : null;
}

/**
 * How far a transaction has really got. 'finalized' and 'accepted' both require an explicit
 * successful execution; anything else is null, which callers must not present as completed.
 */
export function settledAs(statusName: string, execution: Execution): 'finalized' | 'accepted' | null {
  if (execution.state !== 'success') return null;
  if (statusName === FINALIZED) return 'finalized';
  if (statusName === ACCEPTED) return 'accepted';
  return null;
}

/** Find an id such as PLG-0003 or AUD-0012 that the transaction's return value carries. */
export function findIdInReceipt(receipt: unknown, prefix: 'PLG' | 'AUD'): string | null {
  const match = jsonText(receipt).match(new RegExp(`${prefix}-\\d{4,}`));
  return match ? match[0] : null;
}

