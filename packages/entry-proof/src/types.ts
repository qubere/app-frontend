export type MeasureStatus = 'EVALUATED_APPLICABLE' | 'EVALUATED_NOT_APPLICABLE' | 'NOT_EVALUATED' | 'DATA_UNAVAILABLE' | 'REVIEW_REQUIRED';
export type VerifyState = 'VERIFIED' | 'REVIEW' | 'AT_RISK';
export type ScoreBand = 'STRONG' | 'REVIEW' | 'AT_RISK';
export type ClassificationStatus = 'sourced_approved' | 'sourced_unapproved' | 'missing';
export interface DutyStackRow {
    key: 'BASE' | 'SECTION_301' | 'SECTION_232' | 'ANTIDUMPING' | 'COUNTERVAILING' | 'MPF' | 'HMF';
    label: string;
    status: MeasureStatus;
    ratePct: number | null;
    amountUsd: number;
    detail: string | null;
}
export interface EvidenceRef {
    kind: 'DOCUMENT' | 'REFERENCE_DATA' | 'BROKER_DECISION' | 'RULING';
    label: string;
    sourceModel: string;
    sourceId: string;
    portalHref: string | null;
    citation: string | null;
}
export interface ProofFlag {
    code: string;
    severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
    title: string;
    whatItMeans: string;
    dutyImpactUsd: number | null;
    findingId: string | null;
}
export interface EntryProofLine {
    lineNumber: number;
    shipmentLineItemId: string;
    description: string;
    htsCode: string | null;
    htsDescription: string | null;
    htsConfidence: number | null;
    classificationStatus: ClassificationStatus;
    classificationApprovedBy: string | null;
    classificationApprovedAt: string | null;
    griRulesApplied: string[];
    whyThisCode: string | null;
    countryOfOrigin: string | null;
    quantity: number;
    enteredValueUsd: number;
    dutyStack: DutyStackRow[];
    lineDutyTotalUsd: number;
    pgaAgencies: string[];
    valuation: {
        transactionValueUsd: number;
        assistsDeclared: boolean;
        assistsUndeclaredEstimateUsd: number;
        relatedParty: boolean;
    };
    verifyState: VerifyState;
    verifyReason: string;
    evidence: EvidenceRef[];
    flags: ProofFlag[];
}
export interface EntryProofPayload {
    schemaVersion: 1;
    filingId: string;
    entryNumber: string;
    entryType: string | null;
    importerName: string;
    portOfEntry: string | null;
    countryOfExport: string | null;
    generatedAt: string;
    htsReleaseId: string | null;
    htsReleaseLabel: string | null;
    referenceDataAsOf: string | null;
    totals: {
        enteredValueUsd: number;
        dutyUsd: number;
        feesUsd: number;
        dutyAndFeesUsd: number;
    };
    scorecard: {
        scoreOverall: number;
        scoreBand: ScoreBand;
        linesTotal: number;
        linesVerified: number;
        linesReview: number;
        linesAtRisk: number;
        dutySavingsIdentifiedUsd: number;
        openFindingsCount: number;
    };
    lines: EntryProofLine[];
    findings: ProofFlag[];
    coverageStatus: {
        complete: boolean;
        missingFields: number;
        unapprovedFields: number;
        warnings: string[];
    };
}
export type ProofLineInput = Omit<EntryProofLine, 'verifyState' | 'verifyReason'>;
