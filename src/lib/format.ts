import type { Dimension, ElementStatus, Kind, Standing, Tone, Verdict } from './types';

export function shortHex(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function pathOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export function formatDateTime(unixSeconds: number): string {
  if (!unixSeconds) return 'not yet';
  return dateTime.format(new Date(unixSeconds * 1000));
}

export function formatDate(unixSeconds: number): string {
  if (!unixSeconds) return 'not yet';
  return dateOnly.format(new Date(unixSeconds * 1000));
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function isPublicHost(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== 'https:') return false;
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;
    if (/^[0-9.]+$/.test(hostname) || hostname.includes(':')) return false;
    return hostname.includes('.');
  } catch {
    return false;
  }
}

export const KIND_LABEL: Record<Kind, string> = {
  research: 'Research',
  climate: 'Climate',
  product: 'Product',
  governance: 'Governance',
  funding: 'Funding',
  policy: 'Policy',
  other: 'Other',
};

export const DIMENSION_LABEL: Record<Dimension, string> = {
  metric: 'Metric',
  target: 'Target',
  baseline: 'Baseline',
  scope: 'Scope',
  deadline: 'Deadline',
  method: 'Method',
  other: 'Other',
};

export const STANDING_LABEL: Record<Standing, string> = {
  UNAUDITED: 'Unaudited',
  HELD: 'Held',
  REVISED: 'Revised openly',
  PARTIAL: 'Partly reported',
  BREACHED: 'Goalposts moved',
};

export const STANDING_TONE: Record<Standing, Tone> = {
  UNAUDITED: 'neutral',
  HELD: 'held',
  REVISED: 'revised',
  PARTIAL: 'partial',
  BREACHED: 'moved',
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  KEPT: 'Definition kept',
  MOVED_DISCLOSED: 'Changed, disclosed',
  MOVED_SILENTLY: 'Moved silently',
  INCOMPLETE: 'Incomplete',
  INCONCLUSIVE: 'Inconclusive',
};

export const VERDICT_TONE: Record<Verdict, Tone> = {
  KEPT: 'held',
  MOVED_DISCLOSED: 'revised',
  MOVED_SILENTLY: 'moved',
  INCOMPLETE: 'partial',
  INCONCLUSIVE: 'neutral',
};

export const VERDICT_HEADLINE: Record<Verdict, string> = {
  KEPT: 'The definition held.',
  MOVED_DISCLOSED: 'The definition changed, and the report says so.',
  MOVED_SILENTLY: 'The goalposts moved, and the report does not say so.',
  INCOMPLETE: 'Part of the pledge went unreported.',
  INCONCLUSIVE: 'The evidence could not support a verdict.',
};

export const VERDICT_EXPLANATION: Record<Verdict, string> = {
  KEPT: 'Every frozen element is restated with the same definition the pledge used.',
  MOVED_DISCLOSED: 'At least one element now means something different, and the report openly acknowledges the change.',
  MOVED_SILENTLY: 'At least one element now means something different, and the report gives no sign of it.',
  INCOMPLETE: 'Nothing was redefined, but one or more pledged elements are not addressed at all.',
  INCONCLUSIVE:
    'Something could not be verified against the source, so the contract refuses to accuse or to reassure. This audit does not change the pledge standing.',
};

export const STATUS_LABEL: Record<ElementStatus, string> = {
  KEPT: 'Same definition',
  MOVED_DISCLOSED: 'Changed, disclosed',
  MOVED_SILENT: 'Changed silently',
  NOT_ADDRESSED: 'Not addressed',
  UNSUPPORTED: 'Not verifiable',
};

export const STATUS_TONE: Record<ElementStatus, Tone> = {
  KEPT: 'held',
  MOVED_DISCLOSED: 'revised',
  MOVED_SILENT: 'moved',
  NOT_ADDRESSED: 'partial',
  UNSUPPORTED: 'neutral',
};

export const FLAG_EXPLANATION: Record<string, string> = {
  unusable_status: 'The model gave no usable status for this element.',
  report_excerpt_not_in_source: 'The excerpt the model cited does not appear in the report, so it was discarded.',
  anchor_missing_from_kept_excerpt:
    'The model said the definition was kept, but a definition anchor from the pledge is missing from its excerpt.',
  disclosure_not_in_source: 'The disclosure the model cited does not appear in the report, so it was discarded.',
  anchors_intact_silent_claim_rejected:
    'The model claimed a silent change, but every definition anchor from the pledge survives in its own excerpt.',
  excerpt_unrelated_to_pledge:
    'The model claimed a change, but the excerpt it cited shares nothing with the pledged sentence, so it is not evidence about this commitment.',
  disclosure_not_about_a_change:
    'The model said the change was disclosed, but the sentence it cited does not read as an admission that anything changed.',
  report_truncated_absence_unproven:
    'The report is longer than the part validators read, so the contract cannot conclude that this commitment is missing from it.',
};

export const FAILURE_EXPLANATION: Record<string, string> = {
  UNREACHABLE: 'The validators could not reach the report.',
  HTTP_4XX: 'The report address answered with a client error such as 404.',
  HTTP_5XX: 'The report server answered with a server error.',
  EMPTY: 'The report was empty or too short to audit.',
};

export function explainFlag(flag: string): string {
  return FLAG_EXPLANATION[flag] ?? 'This element could not be verified against the source.';
}

/** Wei as a GEN amount with up to `digits` decimals, trailing zeros trimmed. */
export function formatGen(wei: bigint, digits = 3): string {
  const unit = 10n ** 18n;
  const whole = wei / unit;
  const scale = 10n ** BigInt(18 - digits);
  const fraction = ((wei % unit) / scale).toString().padStart(digits, '0').replace(/0+$/, '');
  return fraction === '' ? whole.toString() : `${whole}.${fraction}`;
}
