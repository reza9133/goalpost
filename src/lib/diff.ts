// Word-level redline between a frozen pledge quote and the text a report actually uses.
// This is a display aid only. The verdict always comes from the contract.

export interface DiffToken {
  text: string;
  changed: boolean;
}

export interface Redline {
  left: DiffToken[];
  right: DiffToken[];
  /** Dice coefficient over matched words, 0 to 1. */
  overlap: number;
}

const MAX_TOKENS = 220;

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter((token) => token.length > 0);
}

function comparable(token: string): string {
  const trimmed = token
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/^[^\p{L}\p{N}%$]+|[^\p{L}\p{N}%$]+$/gu, '');
  return trimmed.length > 0 ? trimmed : token;
}

export function redline(pledged: string, reported: string): Redline {
  const a = tokenize(pledged).slice(0, MAX_TOKENS);
  const b = tokenize(reported).slice(0, MAX_TOKENS);
  const ka = a.map(comparable);
  const kb = b.map(comparable);
  const rows = a.length + 1;
  const cols = b.length + 1;

  // Longest common subsequence table.
  const table = new Uint16Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * cols + j] =
        ka[i] === kb[j]
          ? table[(i + 1) * cols + (j + 1)] + 1
          : Math.max(table[(i + 1) * cols + j], table[i * cols + (j + 1)]);
    }
  }

  const left: DiffToken[] = [];
  const right: DiffToken[] = [];
  let i = 0;
  let j = 0;
  let matched = 0;
  while (i < a.length && j < b.length) {
    if (ka[i] === kb[j]) {
      left.push({ text: a[i], changed: false });
      right.push({ text: b[j], changed: false });
      matched += 1;
      i += 1;
      j += 1;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + (j + 1)]) {
      left.push({ text: a[i], changed: true });
      i += 1;
    } else {
      right.push({ text: b[j], changed: true });
      j += 1;
    }
  }
  while (i < a.length) {
    left.push({ text: a[i], changed: true });
    i += 1;
  }
  while (j < b.length) {
    right.push({ text: b[j], changed: true });
    j += 1;
  }

  const total = a.length + b.length;
  return { left, right, overlap: total === 0 ? 1 : (2 * matched) / total };
}
