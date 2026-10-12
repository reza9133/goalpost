import { STANDING_LABEL, STANDING_TONE, STATUS_LABEL, STATUS_TONE, VERDICT_LABEL, VERDICT_TONE } from '../lib/format';
import type { ElementStatus, Standing, Tone, Verdict } from '../lib/types';

function ToneIcon({ tone }: { tone: Tone }) {
  switch (tone) {
    case 'held':
      return (
        <svg className="chip__icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
        </svg>
      );
    case 'moved':
      return (
        <svg className="chip__icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v3.5a.75.75 0 0 1-1.5 0v-3.5a.75.75 0 0 1 1.5 0ZM9 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
        </svg>
      );
    case 'revised':
      return (
        <svg className="chip__icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7 7 0 0 1 1.05 8.84a.75.75 0 0 1 .655-.835Zm11.957-.5a.75.75 0 0 1-.655.835.75.75 0 0 1-.835-.656 5.5 5.5 0 0 0-9.591-2.97l1.204 1.204a.25.25 0 0 1-.177.427H0a.25.25 0 0 1-.25-.25V3.44a.25.25 0 0 1 .427-.177l1.38 1.38A7 7 0 0 1 14.317 7.505Z" />
        </svg>
      );
    case 'partial':
      return (
        <svg className="chip__icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm0-1.5v-11a5.5 5.5 0 0 1 0 11Z" />
        </svg>
      );
    case 'neutral':
    default:
      return (
        <svg className="chip__icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm7-5.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" />
        </svg>
      );
  }
}

export function Chip({ tone, children }: { tone: Tone; children: string }) {
  return (
    <span className={`chip chip--${tone}`}>
      <ToneIcon tone={tone} />
      <span>{children}</span>
    </span>
  );
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
