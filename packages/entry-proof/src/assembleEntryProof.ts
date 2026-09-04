import Decimal from 'decimal.js';
import type { EntryProofPayload, ProofLineInput, ProofFlag, EntryProofLine, EvidenceRef } from './types';
export const money = (n: Decimal.Value) => new Decimal(n).toDecimalPlaces(2).toNumber();
const sum = (values: number[]) => values.reduce((a, b) => a.plus(b), new Decimal(0));
// Explicit construction at every nested boundary prevents accidental ORM field leakage.
const flag = (f: ProofFlag): ProofFlag => ({ code: f.code, severity: f.severity, title: f.title, whatItMeans: f.whatItMeans, dutyImpactUsd: f.dutyImpactUsd, findingId: f.findingId });
const evidence = (e: EvidenceRef): EvidenceRef => ({ kind: e.kind, label: e.label, sourceModel: e.sourceModel, sourceId: e.sourceId, portalHref: e.portalHref?.startsWith('/') && !e.portalHref.startsWith('//') ? e.portalHref : null, citation: e.citation });
export interface AssembleEntryProofInput extends Omit<EntryProofPayload, 'schemaVersion' | 'scorecard' | 'lines'> {
    lines: ProofLineInput[];
    refundOpportunities: {
        status: string;
        estimatedRefundAmount: number;
    }[];
}
export function assembleEntryProof(input: AssembleEntryProofInput): EntryProofPayload {
    const total = sum(input.lines.map(l => l.enteredValueUsd));
    const lines: EntryProofLine[] = input.lines.map(l => {
        const high = l.flags.some(f => ['HIGH', 'CRITICAL'].includes(f.severity));
        const majorUnapproved = l.classificationStatus === 'sourced_unapproved' && new Decimal(l.enteredValueUsd).gte(total.times('0.05'));
        const missingBase = !l.dutyStack.some(d => d.key === 'BASE' && d.ratePct !== null);
        const reasons: string[] = [];
        if (l.classificationStatus === 'missing')
            reasons.push('Classification is missing.');
        if (majorUnapproved)
            reasons.push('Classification approval is needed for a material entry line.');
        if (missingBase)
            reasons.push('A published base duty rate is unavailable.');
        if (high)
            reasons.push('An open high-priority finding needs review.');
        if (l.dutyStack.some(d => d.status === 'REVIEW_REQUIRED'))
            reasons.push('A duty measure requires review.');
        const atRisk = reasons.length > 0;
        if (!atRisk) {
            if (l.classificationStatus === 'sourced_unapproved')
                reasons.push('Classification awaits approval.');
            if (l.dutyStack.some(d => ['NOT_EVALUATED', 'DATA_UNAVAILABLE'].includes(d.status)))
                reasons.push('Some duty measures have not been fully evaluated.');
            if (l.flags.some(f => f.severity === 'WARNING'))
                reasons.push('An open finding needs review.');
            if (l.htsConfidence !== null && l.htsConfidence < 75)
                reasons.push('Classification confidence is below 75%.');
        }
        return {
            lineNumber: l.lineNumber, shipmentLineItemId: l.shipmentLineItemId, description: l.description, htsCode: l.htsCode,
            htsDescription: l.htsDescription, htsConfidence: l.htsConfidence, classificationStatus: l.classificationStatus,
            classificationApprovedBy: l.classificationApprovedBy, classificationApprovedAt: l.classificationApprovedAt,
            griRulesApplied: l.griRulesApplied.map(String), whyThisCode: l.whyThisCode, countryOfOrigin: l.countryOfOrigin,
            quantity: l.quantity, enteredValueUsd: money(l.enteredValueUsd), lineDutyTotalUsd: money(l.lineDutyTotalUsd),
            dutyStack: l.dutyStack.map(d => ({ key: d.key, label: d.label, status: d.status, ratePct: d.ratePct, amountUsd: money(d.amountUsd), detail: d.detail })),
            pgaAgencies: l.pgaAgencies.map(String), valuation: { transactionValueUsd: money(l.valuation.transactionValueUsd), assistsDeclared: l.valuation.assistsDeclared, assistsUndeclaredEstimateUsd: money(l.valuation.assistsUndeclaredEstimateUsd), relatedParty: l.valuation.relatedParty },
            verifyState: atRisk ? 'AT_RISK' : reasons.length ? 'REVIEW' : 'VERIFIED', verifyReason: reasons.join(' ') || 'Classification approved and available duty measures evaluated.',
            evidence: l.evidence.map(evidence), flags: l.flags.map(flag),
        };
    });
    const counts = { linesTotal: lines.length, linesVerified: lines.filter(l => l.verifyState === 'VERIFIED').length, linesReview: lines.filter(l => l.verifyState === 'REVIEW').length, linesAtRisk: lines.filter(l => l.verifyState === 'AT_RISK').length };
    const scoreOverall = lines.length ? lines.reduce((a, l) => a.plus((total.eq(0) ? new Decimal(1).div(lines.length) : new Decimal(l.enteredValueUsd).div(total)).times(l.verifyState === 'VERIFIED' ? 100 : l.verifyState === 'REVIEW' ? 60 : 0)), new Decimal(0)).round().toNumber() : 0;
    const flags = [...input.findings, ...lines.flatMap(l => l.flags)];
    const uniqueFlags = [...new Map(flags.map((f, i) => [f.findingId ?? `flag-${i}`, f])).values()];
    const savings = sum(input.refundOpportunities.filter(r => r.status.toUpperCase() === 'IDENTIFIED').map(r => r.estimatedRefundAmount)).plus(sum(uniqueFlags.filter(f => (f.dutyImpactUsd ?? 0) < 0).map(f => Math.abs(f.dutyImpactUsd!))));
    return {
        schemaVersion: 1, filingId: input.filingId, entryNumber: input.entryNumber, entryType: input.entryType,
        importerName: input.importerName, portOfEntry: input.portOfEntry, countryOfExport: input.countryOfExport,
        generatedAt: input.generatedAt, htsReleaseId: input.htsReleaseId, htsReleaseLabel: input.htsReleaseLabel, referenceDataAsOf: input.referenceDataAsOf,
        totals: { enteredValueUsd: money(input.totals.enteredValueUsd), dutyUsd: money(input.totals.dutyUsd), feesUsd: money(input.totals.feesUsd), dutyAndFeesUsd: money(input.totals.dutyAndFeesUsd) },
        scorecard: { ...counts, scoreOverall, scoreBand: scoreOverall >= 90 && !counts.linesAtRisk ? 'STRONG' : scoreOverall < 70 || counts.linesAtRisk ? 'AT_RISK' : 'REVIEW', dutySavingsIdentifiedUsd: money(savings), openFindingsCount: uniqueFlags.length },
        lines, findings: input.findings.map(flag), coverageStatus: { complete: input.coverageStatus.complete, missingFields: input.coverageStatus.missingFields, unapprovedFields: input.coverageStatus.unapprovedFields, warnings: input.coverageStatus.warnings.map(String) },
    };
}
