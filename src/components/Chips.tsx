import { STANDING_LABEL, STANDING_TONE, STATUS_LABEL, STATUS_TONE, VERDICT_LABEL, VERDICT_TONE } from '../lib/format';
import type { ElementStatus, Standing, Tone, Verdict } from '../lib/types';

export function Chip({ tone, children }: { tone: Tone; children: string }) {
  return <span className={`chip chip--${tone}`}>{children}</span>;
}

export function StandingChip({ standing }: { standing: Standing }) {
  return <Chip tone={STANDING_TONE[standing]}>{STANDING_LABEL[standing]}</Chip>;
}

export function VerdictChip({ verdict }: { verdict: Verdict | '' }) {
  if (verdict === '') return <Chip tone="neutral">Awaiting evaluation</Chip>;
  return <Chip tone={VERDICT_TONE[verdict]}>{VERDICT_LABEL[verdict]}</Chip>;
}

export function StatusChip({ status }: { status: ElementStatus }) {
  return <Chip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Chip>;
}

/** Tally marks for audits that found a silent move. Every fifth mark strikes through the four before it. */
export function Strikes({ count }: { count: number }) {
  if (count <= 0) return <span className="muted">None</span>;
  const marks = Array.from({ length: Math.min(count, 25) }, (_, index) => index);
  return (
    <span className="tally" role="img" aria-label={`${count} silent ${count === 1 ? 'move' : 'moves'} found`}>
      <span className="tally__marks" aria-hidden="true">
        {marks.map((index) => (
          <span key={index} className={(index + 1) % 5 === 0 ? 'tally__mark tally__mark--strike' : 'tally__mark'} />
        ))}
      </span>
      <span className="tally__count" aria-hidden="true">
        {count}
      </span>
    </span>
  );
}
