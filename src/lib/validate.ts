// Client-side mirror of the contract's input rules. The contract is the authority; this only
// lets a visitor see a mistake before spending a multi-minute transaction on it.

import type { ContractLimits, Dimension, Kind } from './types';

export const DEFAULT_LIMITS: ContractLimits = {
  max_elements: 6,
  min_quote_chars: 12,
  max_quote_chars: 400,
  max_anchors: 4,
  max_anchor_chars: 60,
  max_title_chars: 120,
  max_url_chars: 500,
  max_period_chars: 40,
  max_audits_per_pledge: 40,
  max_report_chars: 9000,
};

export const KEY_PATTERN = /^[a-z][a-z0-9_]{1,31}$/;

export const KINDS: Kind[] = ['research', 'climate', 'product', 'governance', 'funding', 'policy', 'other'];
export const DIMENSIONS: Dimension[] = ['metric', 'target', 'baseline', 'scope', 'deadline', 'method', 'other'];

/** Same folding the contract applies before comparing text: typography, whitespace, case. */
export function normalize(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2010\u2011\u2013\u2014\u2212]/g, '-')
    .replace(/[\u00a0\u2009\u202f]/g, ' ')
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .join(' ')
    .toLowerCase();
}

export function squash(text: string): string {
  return text.split(/\s+/).filter((part) => part.length > 0).join(' ');
}

export function splitAnchors(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((part) => squash(part))
    .filter((part) => part.length > 0);
}

const BLOCKED_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home.arpa', '.corp', '.intranet'];
const NUMERIC_LABEL = /^(0x[0-9a-f]*|[0-9]+)$/;
const HOST_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** Returns an error message, or null when the URL satisfies the contract's rules. */
export function urlProblem(value: string, label: string, limits: ContractLimits = DEFAULT_LIMITS): string | null {
  if (value.length === 0) return `${label} is required.`;
  if (value.length > limits.max_url_chars) return `${label} is too long.`;
  if (!value.startsWith('https://')) return `${label} must be an absolute https URL.`;
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return `${label} must not contain spaces or control characters.`;
  if (value.includes('#') || value.includes('\\')) return `${label} must not contain a fragment or a backslash.`;
  const rest = value.slice('https://'.length);
  const authority = rest.split('/')[0].split('?')[0].toLowerCase();
  if (authority.includes('@')) return `${label} must not contain credentials.`;
  if (authority.includes(':') || authority.includes('[')) return `${label} must not name a port or an IP literal.`;
  // A numeric last label (0x7f.0.0.1, 127.0.0.0x1, 127.1) is an IPv4 address to URL parsers, not a DNS name.
  if (!HOST_PATTERN.test(authority) || NUMERIC_LABEL.test(authority.slice(authority.lastIndexOf('.') + 1))) {
    return `${label} must name a public DNS host.`;
  }
  if (authority === 'localhost' || BLOCKED_SUFFIXES.some((suffix) => authority.endsWith(suffix))) {
    return `${label} must name a public DNS host.`;
  }
  // Mirror of the contract: the prefix gate is a plain string test, so dot segments and
  // encodings a server may decode into them must be refused up front.
  const rawAuthority = rest.split('/')[0].split('?')[0];
  const pathOnly = rest.slice(rawAuthority.length).split('?')[0];
  if (pathOnly.split('/').some((segment) => segment.split(';')[0] === '.' || segment.split(';')[0] === '..')) {
    return `${label} must not contain dot segments.`;
  }
  if (/%2e|%2f|%5c/i.test(pathOnly)) return `${label} must not contain encoded dots or slashes.`;
  return null;
}

export function hostOfUrl(value: string): string {
  return value.slice('https://'.length).split('/')[0].split('?')[0].toLowerCase();
}

export interface ElementDraft {
  id: number;
  key: string;
  dimension: Dimension;
  quote: string;
  anchors: string;
}

export interface Draft {
  title: string;
  kind: Kind;
  pledgeUrl: string;
  reportPrefix: string;
  elements: ElementDraft[];
}

export interface DraftErrors {
  title?: string;
  pledgeUrl?: string;
  reportPrefix?: string;
  elements?: string;
  perElement: Array<{ key?: string; quote?: string; anchors?: string }>;
}

export function validateDraft(draft: Draft, limits: ContractLimits = DEFAULT_LIMITS): { ok: boolean; errors: DraftErrors } {
  const errors: DraftErrors = { perElement: draft.elements.map(() => ({})) };
  let ok = true;
  const fail = (): void => {
    ok = false;
  };

  const title = squash(draft.title);
  if (title.length < 3) {
    errors.title = 'Give the pledge a short, recognisable title.';
    fail();
  } else if (title.length > limits.max_title_chars) {
    errors.title = `Keep the title under ${limits.max_title_chars} characters.`;
    fail();
  }

  const pledgeProblem = urlProblem(draft.pledgeUrl.trim(), 'The pledge page URL', limits);
  if (pledgeProblem) {
    errors.pledgeUrl = pledgeProblem;
    fail();
  }

  const prefix = draft.reportPrefix.trim();
  const prefixProblem = urlProblem(prefix, 'The reporting prefix', limits);
  if (prefixProblem) {
    errors.reportPrefix = prefixProblem;
    fail();
  } else if (!prefix.endsWith('/')) {
    errors.reportPrefix = 'The reporting prefix must end with a slash.';
    fail();
  } else if (prefix.includes('?')) {
    errors.reportPrefix = 'The reporting prefix must not contain a query string.';
    fail();
  } else if (!pledgeProblem && hostOfUrl(prefix) !== hostOfUrl(draft.pledgeUrl.trim())) {
    errors.reportPrefix = 'Reports must be published on the same host as the pledge.';
    fail();
  }

  if (draft.elements.length < 1) {
    errors.elements = 'Freeze at least one element.';
    fail();
  } else if (draft.elements.length > limits.max_elements) {
    errors.elements = `At most ${limits.max_elements} elements can be frozen.`;
    fail();
  }

  const keys = new Set<string>();
  const quotes = new Set<string>();
  draft.elements.forEach((element, index) => {
    const slot = errors.perElement[index];
    const key = element.key.trim();
    if (!KEY_PATTERN.test(key)) {
      slot.key = 'Use 2 to 32 characters: lowercase letters, digits and underscores, starting with a letter.';
      fail();
    } else if (keys.has(key)) {
      slot.key = 'Keys must be unique.';
      fail();
    }
    keys.add(key);

    const quote = squash(element.quote);
    const quoteNorm = normalize(quote);
    if (quote.length < limits.min_quote_chars) {
      slot.quote = `Quote at least ${limits.min_quote_chars} characters, copied exactly from the pledge page.`;
      fail();
    } else if (quote.length > limits.max_quote_chars) {
      slot.quote = `Keep the quote under ${limits.max_quote_chars} characters.`;
      fail();
    } else if (quotes.has(quoteNorm)) {
      slot.quote = 'This quote is already frozen in another element.';
      fail();
    }
    quotes.add(quoteNorm);

    const anchors = splitAnchors(element.anchors);
    if (anchors.length === 0) {
      slot.anchors = 'Add at least one anchor: a word or number from the quote that defines it.';
      fail();
    }
    const seen = new Set<string>();
    for (const anchor of anchors) {
      const anchorNorm = normalize(anchor);
      if (anchors.length > limits.max_anchors) {
        slot.anchors = `At most ${limits.max_anchors} anchors per element.`;
      } else if (anchor.length > limits.max_anchor_chars) {
        slot.anchors = `Each anchor must be under ${limits.max_anchor_chars} characters.`;
      } else if (seen.has(anchorNorm)) {
        slot.anchors = `Anchor "${anchor}" is listed twice.`;
      } else if (!quoteNorm.includes(anchorNorm)) {
        slot.anchors = `Anchor "${anchor}" does not appear in the quote.`;
      }
      seen.add(anchorNorm);
      if (slot.anchors) {
        fail();
        break;
      }
    }
  });

  return { ok, errors };
}

export function periodProblem(value: string, limits: ContractLimits = DEFAULT_LIMITS): string | null {
  const period = squash(value);
  if (period.length === 0) return 'Name the reporting period, for example FY2026.';
  if (period.length > limits.max_period_chars) return `Keep the period under ${limits.max_period_chars} characters.`;
  return null;
}

export function reportUrlProblem(value: string, prefix: string, limits: ContractLimits = DEFAULT_LIMITS): string | null {
  const url = value.trim();
  const basic = urlProblem(url, 'The report URL', limits);
  if (basic) return basic;
  if (url.includes('?')) return 'The report URL must not contain a query string.';
  const lowered = `https://${hostOfUrl(url)}${url.slice('https://'.length + hostOfUrl(url).length)}`;
  if (hostOfUrl(url) !== hostOfUrl(prefix) || !lowered.startsWith(prefix)) {
    return 'The report must live under the reporting prefix frozen with this pledge.';
  }
  return null;
}
