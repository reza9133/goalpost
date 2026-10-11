// Shapes returned by the Goalpost contract. The contract serialises every record as JSON text,
// so these types describe that JSON exactly.

export type Kind = 'research' | 'climate' | 'product' | 'governance' | 'funding' | 'policy' | 'other';
export type Dimension = 'metric' | 'target' | 'baseline' | 'scope' | 'deadline' | 'method' | 'other';

export type Standing = 'UNAUDITED' | 'HELD' | 'REVISED' | 'PARTIAL' | 'BREACHED';
export type Verdict = 'KEPT' | 'MOVED_DISCLOSED' | 'MOVED_SILENTLY' | 'INCOMPLETE' | 'INCONCLUSIVE';
export type ElementStatus = 'KEPT' | 'MOVED_DISCLOSED' | 'MOVED_SILENT' | 'NOT_ADDRESSED' | 'UNSUPPORTED';

export type PledgeStatus = 'ACTIVE' | 'RETIRED';
export type AuditState = 'PENDING' | 'SETTLED';
export type IntegrityState = 'VERIFIED' | 'EDITED';
export type IntegrityResult = 'INTACT' | 'EDITED' | 'UNREACHABLE';

export interface FrozenElement {
  key: string;
  dimension: Dimension;
  quote: string;
  anchors: string[];
}

export interface IntegrityEntry {
  at: number;
  by: string;
  result: IntegrityResult;
  missing: string[];
}

/** One episode in which the pledge page lost quotes. Kept apart from the rolling log so repeated checks cannot push it out. */
export interface IntegrityEdit {
  at: number;
  by: string;
  missing: string[];
}

export interface Integrity {
  state: IntegrityState;
  checked_at: number;
  edits_detected: number;
  /** Absent on pledges recorded by an older contract version. */
  edits?: IntegrityEdit[];
  log: IntegrityEntry[];
}

export interface PledgeRecord {
  pledge_id: string;
  title: string;
  kind: Kind;
  owner: string;
  pledge_url: string;
  report_prefix: string;
  elements: FrozenElement[];
  commitment: string;
  status: PledgeStatus;
  registered_at: number;
  retired_at: number;
  standing: Standing;
  last_verdict: Verdict | '';
  last_audit_id: string;
  /** Sequence number of the submitted audit that set the current standing. Absent on older records. */
  standing_audit_seq?: number;
  strikes: number;
  audit_ids: string[];
  integrity: Integrity;
}

export interface PledgeSummary {
  pledge_id: string;
  title: string;
  kind: Kind;
  owner: string;
  pledge_url: string;
  status: PledgeStatus;
  standing: Standing;
  strikes: number;
  last_verdict: Verdict | '';
  elements: number;
  audits: number;
  integrity_state: IntegrityState;
  registered_at: number;
}

export interface PledgePage {
  total: number;
  offset: number;
  items: PledgeSummary[];
}

export interface AuditElementResult {
  key: string;
  status: ElementStatus;
  report_excerpt: string;
  disclosure_excerpt: string;
  reason: string;
  flag: string;
}

export interface AuditRecord {
  audit_id: string;
  pledge_id: string;
  report_url: string;
  period: string;
  state: AuditState;
  verdict: Verdict | '';
  silent_keys: string[];
  elements: AuditElementResult[];
  failure_reason: string;
  submitted_by: string;
  submitted_at: number;
  evaluated_by: string;
  evaluated_at: number;
  attestation: string;
}

export interface AuditSummary {
  audit_id: string;
  pledge_id: string;
  period: string;
  report_url: string;
  state: AuditState;
  verdict: Verdict | '';
  silent_keys: string[];
  submitted_by: string;
  submitted_at: number;
  evaluated_at: number;
}

export interface PledgeBundle {
  pledge: PledgeRecord;
  audits: AuditSummary[];
}

export interface AuditBundle {
  audit: AuditRecord;
  pledge: PledgeRecord;
}

export interface Stats {
  pledges: number;
  audits: number;
  settled: number;
  silent_moves: number;
  edits_detected: number;
}

export interface ContractLimits {
  max_elements: number;
  min_quote_chars: number;
  max_quote_chars: number;
  max_anchors: number;
  max_anchor_chars: number;
  max_title_chars: number;
  max_url_chars: number;
  max_period_chars: number;
  max_audits_per_pledge: number;
  max_report_chars: number;
}

export interface ContractInfo {
  name: string;
  version: string;
  runner: string;
  kinds: Kind[];
  dimensions: Dimension[];
  limits: ContractLimits;
}

export type Tone = 'held' | 'revised' | 'moved' | 'partial' | 'neutral';
