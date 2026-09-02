import type { ProofFlag } from './types';
const COPY: Record<string, [string, string]> = {
  'Valuation Variance': ['Customs value needs review', 'Your broker is checking the declared value against supporting documents.'],
  'HTS Override': ['Classification needs review', 'Your broker is reviewing the tariff classification used for this item.'],
  'Missing Assists': ['Additional value may be required', 'Tooling, materials, or other assists may need to be included in the customs value.'],
  'SECTION_301_EXCLUSION': ['Potential duty savings', 'Your broker can check whether a Section 301 exclusion applies. Savings are not guaranteed.'],
};
/** Never copy internal description/recommendation into customer text, including unknown rules. */
export function flagCopy(input: { id?: string; rule: string; severity: string; dutyImpactUsd?: number | null }): ProofFlag {
  const [title, whatItMeans] = COPY[input.rule] ?? ['Entry item needs review', 'Your broker is reviewing this item and will share the next steps with you.'];
  const severity = input.severity.toUpperCase();
  return { code: COPY[input.rule] ? input.rule : 'BROKER_REVIEW', severity: ['INFO','WARNING','HIGH','CRITICAL'].includes(severity) ? severity as ProofFlag['severity'] : 'WARNING', title, whatItMeans, dutyImpactUsd: input.dutyImpactUsd ?? null, findingId: input.id ?? null };
}
