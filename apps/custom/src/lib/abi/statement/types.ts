import type { Decimal } from "@/lib/tariff/decimal";

// Types for the CATAIR Statement Processing chapter — Daily Statement
// (Application Identifier PF) and Periodic Monthly Statement (Application
// Identifier MS). Both variants share the QA/QE/QJ fee-total record shape and
// the Q7 deleted-entries record shape; Q1-Q6 differ structurally between the
// two flows. Source:
// docs/plans/catair-source-docs/05-daily-statement.pdf (2025-04, Rev 15)
// docs/plans/catair-source-docs/05b-periodic-monthly-statement.pdf (2020-03, Rev 7 — stale, see scope note)
//
// Deferred (not modeled this slice): ABI Statement Update/Delete (SU),
// ACH Payment Authorization (RM/PN), the Outstanding Action ES Query Response
// grouping, and printed-report layout rendering.

export interface Q1DailyInput {
  districtPortOfEntrySummary: string;
  entryFilerCode: string;
  /** 8-char (7-digit transaction number + check digit, Appendix E). */
  entryNumber: string;
  importerOfRecordNumber?: string;
  /** MMDDYY. */
  preliminaryDailyStatementPrintDate: Date;
  /** Implied 2 decimal places on the wire. */
  estimatedDutyAmount?: Decimal;
  estimatedTaxAmount?: Decimal;
  deferredTaxIndicator?: string;
  brokerReferenceNumber?: string;
  consolidatedIndicator?: string;
  clientBranchDesignation?: string;
  /** 2-char entry type code (e.g. "01", "21") — leading zero significant. */
  entryType: string;
}

export interface Q2DailyInput {
  districtPortOfEntrySummary: string;
  entryFilerCode: string;
  entryNumber: string;
  /** Implied 2 decimal places on the wire. */
  antidumpingDutyAmount?: Decimal;
  countervailingDutyAmount?: Decimal;
  /** "2"/"3"/"5" (Daily) or "6"/"7"/"8" (PMS). */
  paymentTypeIndicator: string;
  payIndicator?: string;
  countervailingIndicator?: string;
  antidumpingIndicator?: string;
  teamNumber?: string;
  interestAmountForReconciliationSummary?: Decimal;
}

/** Shared by QA (preliminary), QE (preliminary fee totals), and QJ (final paid
 * fee totals) — same 5-repeating-pair layout across all three. */
export interface StatementFeeInput {
  /** 2-digit sequence counter — leading zero significant. */
  sequenceNumber: string;
  firstFeeClassCode?: string;
  firstFeeAmount?: Decimal;
  secondFeeClassCode?: string;
  secondFeeAmount?: Decimal;
  thirdFeeClassCode?: string;
  thirdFeeAmount?: Decimal;
  fourthFeeClassCode?: string;
  fourthFeeAmount?: Decimal;
  fifthFeeClassCode?: string;
  fifthFeeAmount?: Decimal;
}

export interface Q3DailyInput {
  /** Format DDFYJJJXXX. */
  dailyStatementNumber: string;
  dailyStatementPrintDate: Date;
  entryFilerCode: string;
  importerOfRecordNumber?: string;
  totalEstimatedDuty?: Decimal;
  totalEstimatedTax?: Decimal;
  totalDeferredTax?: Decimal;
  districtPortWhichProcessesEntries: string;
}

/** Q5 shares Q3's exact layout (final-paid totals vs preliminary totals). */
export type Q5DailyInput = Q3DailyInput;

export interface Q4DailyInput {
  totalAntidumpingDuty?: Decimal;
  totalCountervailingDuty?: Decimal;
  totalAmountDue?: Decimal;
  totalInterestAmountForReconciliationSummary?: Decimal;
  /** A true count, not an identifier — decodes as a number. */
  totalNumberRevenueProducingEntries: number;
  totalNumberNonRevenueProducingEntries: number;
}

/** Q6 shares Q4's layout, but its "total amount" field key is `totalAmountPaid`, not `totalAmountDue`. */
export interface Q6DailyInput {
  totalAntidumpingDuty?: Decimal;
  totalCountervailingDuty?: Decimal;
  totalAmountPaid?: Decimal;
  totalInterestAmountForReconciliationSummary?: Decimal;
  totalNumberRevenueProducingEntries: number;
  totalNumberNonRevenueProducingEntries: number;
}

export interface Q7DeletedInput {
  statementNumber: string;
  entryFilerCode1: string;
  entryNumber1: string;
  deleteSource1: "ABI" | "CBP";
  entryFilerCode2?: string;
  entryNumber2?: string;
  deleteSource2?: "ABI" | "CBP";
  entryFilerCode3?: string;
  entryNumber3?: string;
  deleteSource3?: "ABI" | "CBP";
  entryFilerCode4?: string;
  entryNumber4?: string;
  deleteSource4?: "ABI" | "CBP";
}

export interface Q1PeriodicInput {
  /** Format DDCYPMMXXX. */
  periodicDailyStatementNumber: string;
  periodicDailyStatementDistrictPort: string;
  periodicDailyStatementFilerCode: string;
  periodicDailyStatementImporterNumber?: string;
  preliminaryPeriodicDailyStatementPrintDate: Date;
  entrySummaryPresentationDate: Date;
  totalDuty?: Decimal;
  totalTax?: Decimal;
}

export interface Q2PeriodicInput {
  totalAntidumpingDuty?: Decimal;
  totalCountervailingDuty?: Decimal;
  totalAmountDue?: Decimal;
}

export type Q4PeriodicInput = Q2PeriodicInput;

export interface Q3PeriodicInput {
  periodicMonthlyStatementNumber: string;
  periodicMonthlyStatementPrintDate: Date;
  periodicMonthlyStatementDueDate: Date;
  periodicMonthlyStatementFilerCode: string;
  periodicMonthlyStatementImporterNumber?: string;
  totalDuty?: Decimal;
  totalTax?: Decimal;
}

export type Q5PeriodicInput = Q3PeriodicInput;

export interface Q6PeriodicInput {
  totalAntidumpingDuty?: Decimal;
  totalCountervailingDuty?: Decimal;
  totalAmountPaid?: Decimal;
}

// ── Daily Statement Output Parsing Types (CATAIR 05-daily-statement.pdf Page 9) ──

export interface DailyStatementDetailGroup {
  q1: Q1DailyInput;
  q2: Q2DailyInput;
  fees: StatementFeeInput[];
}

export interface PreliminaryOrFinalDailyPaymentGroup {
  q3: Q3DailyInput;
  q4: Q4DailyInput;
  feeTotals: StatementFeeInput[];
}

export interface FinalDailyStatementPaymentGroup {
  q5: Q5DailyInput;
  q6: Q6DailyInput;
  feeTotals: StatementFeeInput[];
}

export interface ParsedDailyStatementResponse {
  details: DailyStatementDetailGroup[];
  preliminaryOrFinalPayment?: PreliminaryOrFinalDailyPaymentGroup;
  finalStatement?: FinalDailyStatementPaymentGroup;
  deletedEntrySummaries: Q7DeletedInput[];
  unrecognizedLines: string[];
}

// ── Periodic Monthly Statement Output Parsing Types (CATAIR 05b-periodic-monthly-statement.pdf Page 6) ──

export interface PeriodicStatementParseOptions {
  /**
   * If true, fee records (QA/QE/QJ) are not strictly required to be present.
   * By default (false), because CATAIR Periodic Monthly Statement Output Record
   * Structure Map (PDF page 6) designates QA/QE/QJ as Mandatory ("M"), the parser
   * throws an AbiFixedWidthError if a group is missing its fee record(s).
   */
  allowMissingFees?: boolean;
}

export interface PeriodicDailyStatementDetailGroup {
  q1: Q1PeriodicInput;
  q2: Q2PeriodicInput;
  fees: StatementFeeInput[];
}

export interface PreliminaryOrFinalPeriodicPaymentGroup {
  q3: Q3PeriodicInput;
  q4: Q4PeriodicInput;
  feeTotals: StatementFeeInput[];
}

export interface FinalPeriodicStatementPaymentGroup {
  q5: Q5PeriodicInput;
  q6: Q6PeriodicInput;
  feeTotals: StatementFeeInput[];
}

export interface ParsedPeriodicStatementResponse {
  details: PeriodicDailyStatementDetailGroup[];
  preliminaryOrFinalPayment?: PreliminaryOrFinalPeriodicPaymentGroup;
  finalStatement?: FinalPeriodicStatementPaymentGroup;
  deletedEntrySummaries: Q7DeletedInput[];
  unrecognizedLines: string[];
}

