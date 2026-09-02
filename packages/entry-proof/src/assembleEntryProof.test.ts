import { describe, it, expect } from 'vitest';
import { assembleEntryProof, type AssembleEntryProofInput } from './assembleEntryProof';
import { flagCopy } from './flagCopy';
import type { ProofLineInput } from './types';
export function line(overrides: Partial<ProofLineInput> = {}): ProofLineInput {
    return { lineNumber: 1, shipmentLineItemId: 'l1', description: 'Valve', htsCode: '8481.80.5090', htsDescription: null, htsConfidence: 95, classificationStatus: 'sourced_approved', classificationApprovedBy: 'u1', classificationApprovedAt: null, griRulesApplied: [], whyThisCode: null, countryOfOrigin: 'US', quantity: 1, enteredValueUsd: 100, dutyStack: [{ key: 'BASE', label: 'Base', status: 'EVALUATED_APPLICABLE', ratePct: 0, amountUsd: 0, detail: null }], lineDutyTotalUsd: 0, pgaAgencies: [], valuation: { transactionValueUsd: 100, assistsDeclared: true, assistsUndeclaredEstimateUsd: 0, relatedParty: false }, evidence: [], flags: [], ...overrides };
}
function input(lines: ProofLineInput[]): AssembleEntryProofInput {
    return { filingId: 'f1', entryNumber: 'E1', entryType: '01', importerName: 'Target', portOfEntry: null, countryOfExport: null, generatedAt: '2026-09-02', htsReleaseId: null, htsReleaseLabel: null, referenceDataAsOf: null, totals: { enteredValueUsd: 100, dutyUsd: 0, feesUsd: 0, dutyAndFeesUsd: 0 }, lines, findings: [], coverageStatus: { complete: true, missingFields: 0, unapprovedFields: 0, warnings: [] }, refundOpportunities: [] };
}
describe('proof score and safety contract', () => {
    it('weights by value and marks a small unapproved line REVIEW', () => {
        const p = assembleEntryProof(input([line({ enteredValueUsd: 96 }), line({ enteredValueUsd: 4, classificationStatus: 'sourced_unapproved' })]));
        expect(p.scorecard).toMatchObject({ scoreOverall: 98, scoreBand: 'STRONG', linesReview: 1 });
    });
    it('uses the inclusive 5% threshold', () => {
        expect(assembleEntryProof(input([line({ enteredValueUsd: 95 }), line({ enteredValueUsd: 5, classificationStatus: 'sourced_unapproved' })])).scorecard).toMatchObject({ scoreOverall: 95, scoreBand: 'AT_RISK', linesAtRisk: 1 });
    });
    it.each(['missing', 'sourced_unapproved'] as const)('flags material %s classification', classificationStatus => expect(assembleEntryProof(input([line({ classificationStatus })])).lines[0].verifyState).toBe('AT_RISK'));
    it.each(['NOT_EVALUATED', 'DATA_UNAVAILABLE', 'REVIEW_REQUIRED'] as const)('does not equate %s to zero duty', status => {
        const l = line();
        l.dutyStack.push({ key: 'ANTIDUMPING', label: 'AD', status, ratePct: null, amountUsd: 0, detail: null });
        expect(assembleEntryProof(input([l])).lines[0].verifyState).toBe(status === 'REVIEW_REQUIRED' ? 'AT_RISK' : 'REVIEW');
    });
    it('flags missing base rate and high findings', () => {
        expect(assembleEntryProof(input([line({ dutyStack: [] })])).lines[0].verifyState).toBe('AT_RISK');
        expect(assembleEntryProof(input([line({ flags: [flagCopy({ rule: 'x', severity: 'Critical' })] })])).lines[0].verifyState).toBe('AT_RISK');
    });
    it('uses equal weighting for zero total and honest empty score', () => {
        expect(assembleEntryProof(input([line({ enteredValueUsd: 0 }), line({ enteredValueUsd: 0, htsConfidence: 70 })])).scorecard.scoreOverall).toBe(80);
        expect(assembleEntryProof(input([])).scorecard).toMatchObject({ scoreOverall: 0, scoreBand: 'AT_RISK' });
    });
    it('honors band boundaries', () => {
        for (const [value, score, band] of [[25, 90, 'STRONG'], [75, 70, 'REVIEW'], [80, 68, 'AT_RISK']] as const) {
            expect(assembleEntryProof(input([line({ enteredValueUsd: 100 - value }), line({ enteredValueUsd: value, htsConfidence: 70 })])).scorecard).toMatchObject({ scoreOverall: score, scoreBand: band });
        }
    });
    it('sums identified savings with decimal arithmetic and deduplicates findings', () => {
        const f = flagCopy({ id: 'find', rule: 'x', severity: 'Info', dutyImpactUsd: -0.2 });
        const i = input([line({ flags: [f] })]);
        i.findings = [f];
        i.refundOpportunities = [{ status: 'Identified', estimatedRefundAmount: 0.1 }, { status: 'Claimed', estimatedRefundAmount: 999 }];
        expect(assembleEntryProof(i).scorecard).toMatchObject({ dutySavingsIdentifiedUsd: 0.3, openFindingsCount: 1 });
    });
    it('drops internal properties at all object boundaries and unknown finding copy', () => {
        const f = flagCopy({ rule: 'SECRET recommendation', severity: 'High' });
        const i = input([line()]);
        Object.assign(i, { grossProfit: 123 });
        Object.assign(i.lines[0], { humanNotes: 'SECRET' });
        Object.assign(i.lines[0].valuation, { actualBuyCost: 456 });
        Object.assign(f, { recommendation: 'SECRET' });
        i.findings = [f];
        const json = JSON.stringify(assembleEntryProof(i));
        expect(json).not.toMatch(/SECRET|grossProfit|humanNotes|actualBuyCost|recommendation/);
    });
});
