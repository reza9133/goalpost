// Typed, contract-shaped wrappers over the network layer.

import { readJson, readString, type Call } from './chain';
import type { AuditBundle, ContractInfo, FrozenElement, Kind, PledgeBundle, PledgePage, Stats } from './types';

export const reads = {
  info: () => readJson<ContractInfo>('contract_info', [], 10 * 60 * 1000),
  stats: () => readJson<Stats>('stats'),
  pledges: (offset: number, limit: number) => readJson<PledgePage>('list_pledges', [offset, limit]),
  pledge: (pledgeId: string) => readJson<PledgeBundle | null>('get_pledge_bundle', [pledgeId]),
  audit: (auditId: string) => readJson<AuditBundle | null>('get_audit_bundle', [auditId]),
  recomputedAttestation: (auditId: string) => readString('recompute_attestation', [auditId], 0),
};

export interface RegisterInput {
  title: string;
  kind: Kind;
  pledgeUrl: string;
  reportPrefix: string;
  elements: FrozenElement[];
}

export const writes = {
  registerPledge: (input: RegisterInput): Call => ({
    functionName: 'register_pledge',
    args: [
      input.title,
      input.kind,
      input.pledgeUrl,
      input.reportPrefix,
      JSON.stringify(
        input.elements.map((element) => ({
          key: element.key,
          dimension: element.dimension,
          quote: element.quote,
          anchors: element.anchors,
        })),
      ),
    ],
  }),
  submitReport: (pledgeId: string, reportUrl: string, period: string): Call => ({
    functionName: 'submit_report',
    args: [pledgeId, reportUrl, period],
  }),
  evaluateReport: (auditId: string): Call => ({ functionName: 'evaluate_report', args: [auditId] }),
  checkIntegrity: (pledgeId: string): Call => ({ functionName: 'check_pledge_integrity', args: [pledgeId] }),
  retirePledge: (pledgeId: string): Call => ({ functionName: 'retire_pledge', args: [pledgeId] }),
};
