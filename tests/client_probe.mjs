// Prints what the TypeScript client logic decides, so the Python suite can compare it with the contract.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V = await import(path.join(root, 'src/lib/validate.ts'));
const F = await import(path.join(root, 'src/lib/format.ts'));

const input = JSON.parse(readFileSync(0, 'utf8'));
process.stdout.write(
  JSON.stringify({
    urls: input.urls.map((url) => V.urlProblem(url, 'u') === null),
    kinds: V.KINDS,
    dimensions: V.DIMENSIONS,
    kindLabels: Object.keys(F.KIND_LABEL),
    dimensionLabels: Object.keys(F.DIMENSION_LABEL),
    standingLabels: Object.keys(F.STANDING_LABEL),
    verdictLabels: Object.keys(F.VERDICT_LABEL),
    statusLabels: Object.keys(F.STATUS_LABEL),
    flagLabels: Object.keys(F.FLAG_EXPLANATION),
    failureLabels: Object.keys(F.FAILURE_EXPLANATION),
    limits: V.DEFAULT_LIMITS,
    normalized: input.texts.map((text) => V.normalize(text)),
  }),
);
