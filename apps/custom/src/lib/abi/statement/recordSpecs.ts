import {
  dateField,
  filler,
  constantField,
  numericCodeField,
  type FieldSpec,
  type RecordSpec,
} from "@/lib/abi/fixedWidth";
import { Decimal, roundToCents } from "@/lib/tariff/decimal";
import type {
  Q1DailyInput,
  Q2DailyInput,
  StatementFeeInput,
  Q3DailyInput,
  Q5DailyInput,
  Q4DailyInput,
  Q6DailyInput,
  Q7DeletedInput,
  Q1PeriodicInput,
  Q2PeriodicInput,
  Q4PeriodicInput,
  Q3PeriodicInput,
  Q5PeriodicInput,
  Q6PeriodicInput,
} from "./types";

// RecordSpecs for the CATAIR Statement Processing chapter (Daily + Periodic
// Monthly Statement). Position math (including internal filler gaps) verified
// against the extracted PDF tables — every duty/tax/fee amount field's source
// text explicitly states "Two decimal places are implied."
// Source: docs/plans/catair-source-docs/05-daily-statement.pdf,
//         docs/plans/catair-source-docs/05b-periodic-monthly-statement.pdf

/** A right-justified, zero-padded numeric field with 2 implied decimal places,
 * bound to `Decimal` — matches every duty/tax/fee amount field's own "Two
 * decimal places are implied" note in the source PDF. */
function impliedDecimalField<K extends string>(
  key: K,
  start: number,
  length: number,
  designation: "M" | "C" | "O"
): FieldSpec<K> {
  const scale = new Decimal(100);
  return {
    key,
    start,
    length,
    class: "SN",
    designation,
    encodeValue: (raw) => roundToCents(raw as Decimal).times(scale).toDecimalPlaces(0).toString().padStart(length, "0"),
    decodeValue: (field) => {
      const trimmed = field.trim();
      return trimmed.length === 0 ? undefined : new Decimal(trimmed).dividedBy(scale);
    },
  };
}

// ── Daily Statement ──────────────────────────────────────────────────────────

export const Q1_DAILY_SPEC: RecordSpec<Q1DailyInput> = {
  recordType: "Q1-Record (Daily Statement Entry Summary Detail)",
  length: 80,
  fields: [
    constantField(1, "Q1"),
    numericCodeField("districtPortOfEntrySummary", 3, 4, "M"),
    { key: "entryFilerCode", start: 7, length: 3, class: "AN", designation: "M" },
    filler(10, 2),
    { key: "entryNumber", start: 12, length: 8, class: "AN", designation: "M" },
    filler(20, 2),
    { key: "importerOfRecordNumber", start: 22, length: 12, class: "X", designation: "C" },
    dateField("preliminaryDailyStatementPrintDate", 34, "M"),
    impliedDecimalField("estimatedDutyAmount", 40, 11, "C"),
    impliedDecimalField("estimatedTaxAmount", 51, 11, "C"),
    { key: "deferredTaxIndicator", start: 62, length: 1, class: "A", designation: "C" },
    { key: "brokerReferenceNumber", start: 63, length: 9, class: "X", designation: "C" },
    { key: "consolidatedIndicator", start: 72, length: 1, class: "A", designation: "C" },
    { key: "clientBranchDesignation", start: 73, length: 2, class: "AN", designation: "C" },
    filler(75, 3),
    numericCodeField("entryType", 78, 2, "M"),
    filler(80, 1),
  ],
};

export const Q2_DAILY_SPEC: RecordSpec<Q2DailyInput> = {
  recordType: "Q2-Record (Daily Statement Entry Summary Detail Continued)",
  length: 80,
  fields: [
    constantField(1, "Q2"),
    numericCodeField("districtPortOfEntrySummary", 3, 4, "M"),
    { key: "entryFilerCode", start: 7, length: 3, class: "AN", designation: "M" },
    filler(10, 2),
    { key: "entryNumber", start: 12, length: 8, class: "AN", designation: "M" },
    filler(20, 1),
    impliedDecimalField("antidumpingDutyAmount", 21, 11, "C"),
    impliedDecimalField("countervailingDutyAmount", 32, 11, "C"),
    filler(43, 11),
    numericCodeField("paymentTypeIndicator", 54, 1, "M"),
    { key: "payIndicator", start: 55, length: 1, class: "A", designation: "C" },
    { key: "countervailingIndicator", start: 56, length: 1, class: "A", designation: "C" },
    { key: "antidumpingIndicator", start: 57, length: 1, class: "A", designation: "C" },
    filler(58, 4),
    { key: "teamNumber", start: 62, length: 3, class: "AN", designation: "C" },
    impliedDecimalField("interestAmountForReconciliationSummary", 65, 8, "C"),
    filler(73, 8),
  ],
};

/** Shared by QA (preliminary fees), QE (preliminary fee totals), and QJ (final paid fee totals). */
function statementFeeFields(constant: string): RecordSpec<StatementFeeInput>["fields"] {
  return [
    constantField(1, constant),
    numericCodeField("sequenceNumber", 3, 2, "M"),
    numericCodeField("firstFeeClassCode", 5, 3, "C"),
    impliedDecimalField("firstFeeAmount", 8, 11, "C"),
    numericCodeField("secondFeeClassCode", 19, 3, "C"),
    impliedDecimalField("secondFeeAmount", 22, 11, "C"),
    numericCodeField("thirdFeeClassCode", 33, 3, "C"),
    impliedDecimalField("thirdFeeAmount", 36, 11, "C"),
    numericCodeField("fourthFeeClassCode", 47, 3, "C"),
    impliedDecimalField("fourthFeeAmount", 50, 11, "C"),
    numericCodeField("fifthFeeClassCode", 61, 3, "C"),
    impliedDecimalField("fifthFeeAmount", 64, 11, "C"),
    filler(75, 6),
  ];
}

export const QA_STATEMENT_FEE_SPEC: RecordSpec<StatementFeeInput> = {
  recordType: "QA-Record (Statement Detail Fees)",
  length: 80,
  fields: statementFeeFields("QA"),
};

export const QE_STATEMENT_FEE_SPEC: RecordSpec<StatementFeeInput> = {
  recordType: "QE-Record (Preliminary Statement Fee Totals)",
  length: 80,
  fields: statementFeeFields("QE"),
};

export const QJ_STATEMENT_FEE_SPEC: RecordSpec<StatementFeeInput> = {
  recordType: "QJ-Record (Final Paid Statement Total Fees)",
  length: 80,
  fields: statementFeeFields("QJ"),
};

function q3q5DailyFields(constant: string): RecordSpec<Q3DailyInput>["fields"] {
  return [
    constantField(1, constant),
    { key: "dailyStatementNumber", start: 3, length: 10, class: "AN", designation: "M" },
    filler(13, 2),
    dateField("dailyStatementPrintDate", 15, "M"),
    { key: "entryFilerCode", start: 21, length: 3, class: "AN", designation: "M" },
    filler(24, 2),
    { key: "importerOfRecordNumber", start: 26, length: 12, class: "X", designation: "C" },
    impliedDecimalField("totalEstimatedDuty", 38, 11, "C"),
    impliedDecimalField("totalEstimatedTax", 49, 11, "C"),
    impliedDecimalField("totalDeferredTax", 60, 11, "C"),
    numericCodeField("districtPortWhichProcessesEntries", 71, 4, "M"),
    filler(75, 6),
  ];
}

export const Q3_DAILY_SPEC: RecordSpec<Q3DailyInput> = {
  recordType: "Q3-Record (Daily Statement Preliminary Totals - Duty & Tax)",
  length: 80,
  fields: q3q5DailyFields("Q3"),
};

export const Q5_DAILY_SPEC: RecordSpec<Q5DailyInput> = {
  recordType: "Q5-Record (Daily Statement Final Paid Totals - Duty & Tax)",
  length: 80,
  fields: q3q5DailyFields("Q5"),
};

export const Q4_DAILY_SPEC: RecordSpec<Q4DailyInput> = {
  recordType: "Q4-Record (Daily Statement Preliminary Totals - ADD/CVD/Recon/Counts)",
  length: 80,
  fields: [
    constantField(1, "Q4"),
    impliedDecimalField("totalAntidumpingDuty", 3, 11, "C"),
    impliedDecimalField("totalCountervailingDuty", 14, 11, "C"),
    impliedDecimalField("totalAmountDue", 25, 11, "C"),
    impliedDecimalField("totalInterestAmountForReconciliationSummary", 36, 11, "C"),
    { key: "totalNumberRevenueProducingEntries", start: 47, length: 5, class: "N", designation: "M" },
    { key: "totalNumberNonRevenueProducingEntries", start: 52, length: 5, class: "N", designation: "M" },
    filler(57, 24),
  ],
};

export const Q6_DAILY_SPEC: RecordSpec<Q6DailyInput> = {
  recordType: "Q6-Record (Daily Statement Final Paid Totals - ADD/CVD/Recon/Counts)",
  length: 80,
  fields: [
    constantField(1, "Q6"),
    impliedDecimalField("totalAntidumpingDuty", 3, 11, "C"),
    impliedDecimalField("totalCountervailingDuty", 14, 11, "C"),
    impliedDecimalField("totalAmountPaid", 25, 11, "C"),
    impliedDecimalField("totalInterestAmountForReconciliationSummary", 36, 11, "C"),
    { key: "totalNumberRevenueProducingEntries", start: 47, length: 5, class: "N", designation: "M" },
    { key: "totalNumberNonRevenueProducingEntries", start: 52, length: 5, class: "N", designation: "M" },
    filler(57, 24),
  ],
};

export const Q7_STATEMENT_DELETED_SPEC: RecordSpec<Q7DeletedInput> = {
  recordType: "Q7-Record (Entry Summaries Deleted)",
  length: 80,
  fields: [
    constantField(1, "Q7"),
    { key: "statementNumber", start: 3, length: 10, class: "AN", designation: "M" },
    { key: "entryFilerCode1", start: 13, length: 3, class: "AN", designation: "M" },
    filler(16, 2),
    { key: "entryNumber1", start: 18, length: 8, class: "AN", designation: "M" },
    { key: "deleteSource1", start: 26, length: 3, class: "AN", designation: "M" },
    { key: "entryFilerCode2", start: 29, length: 3, class: "AN", designation: "C" },
    filler(32, 2),
    { key: "entryNumber2", start: 34, length: 8, class: "AN", designation: "C" },
    { key: "deleteSource2", start: 42, length: 3, class: "AN", designation: "C" },
    { key: "entryFilerCode3", start: 45, length: 3, class: "AN", designation: "C" },
    filler(48, 2),
    { key: "entryNumber3", start: 50, length: 8, class: "AN", designation: "C" },
    { key: "deleteSource3", start: 58, length: 3, class: "AN", designation: "C" },
    { key: "entryFilerCode4", start: 61, length: 3, class: "AN", designation: "C" },
    filler(64, 2),
    { key: "entryNumber4", start: 66, length: 8, class: "AN", designation: "C" },
    { key: "deleteSource4", start: 74, length: 3, class: "AN", designation: "C" },
    filler(77, 4),
  ],
};

// ── Periodic Monthly Statement ───────────────────────────────────────────────

export const Q1_PERIODIC_SPEC: RecordSpec<Q1PeriodicInput> = {
  recordType: "Q1-Record (Periodic Monthly Statement Daily Statements Listed)",
  length: 80,
  fields: [
    constantField(1, "Q1"),
    { key: "periodicDailyStatementNumber", start: 3, length: 10, class: "AN", designation: "M" },
    numericCodeField("periodicDailyStatementDistrictPort", 13, 4, "M"),
    { key: "periodicDailyStatementFilerCode", start: 17, length: 3, class: "AN", designation: "M" },
    { key: "periodicDailyStatementImporterNumber", start: 20, length: 12, class: "X", designation: "C" },
    dateField("preliminaryPeriodicDailyStatementPrintDate", 32, "M"),
    dateField("entrySummaryPresentationDate", 38, "M"),
    impliedDecimalField("totalDuty", 44, 11, "C"),
    impliedDecimalField("totalTax", 55, 11, "C"),
    filler(66, 15),
  ],
};

function q2q4PeriodicFields(constant: string): RecordSpec<Q2PeriodicInput>["fields"] {
  return [
    constantField(1, constant),
    impliedDecimalField("totalAntidumpingDuty", 3, 11, "C"),
    impliedDecimalField("totalCountervailingDuty", 14, 11, "C"),
    impliedDecimalField("totalAmountDue", 25, 11, "C"),
    filler(36, 45),
  ];
}

export const Q2_PERIODIC_SPEC: RecordSpec<Q2PeriodicInput> = {
  recordType: "Q2-Record (Periodic Monthly Statement Daily Statement Totals)",
  length: 80,
  fields: q2q4PeriodicFields("Q2"),
};

export const Q4_PERIODIC_SPEC: RecordSpec<Q4PeriodicInput> = {
  recordType: "Q4-Record (Periodic Monthly Statement Preliminary Totals)",
  length: 80,
  fields: q2q4PeriodicFields("Q4"),
};

export const Q6_PERIODIC_SPEC: RecordSpec<Q6PeriodicInput> = {
  recordType: "Q6-Record (Periodic Monthly Statement Final Paid Totals)",
  length: 80,
  fields: [
    constantField(1, "Q6"),
    impliedDecimalField("totalAntidumpingDuty", 3, 11, "C"),
    impliedDecimalField("totalCountervailingDuty", 14, 11, "C"),
    impliedDecimalField("totalAmountPaid", 25, 11, "C"),
    filler(36, 45),
  ],
};

function q3q5PeriodicFields(constant: string): RecordSpec<Q3PeriodicInput>["fields"] {
  return [
    constantField(1, constant),
    { key: "periodicMonthlyStatementNumber", start: 3, length: 10, class: "AN", designation: "M" },
    dateField("periodicMonthlyStatementPrintDate", 13, "M"),
    dateField("periodicMonthlyStatementDueDate", 19, "M"),
    { key: "periodicMonthlyStatementFilerCode", start: 25, length: 3, class: "AN", designation: "M" },
    { key: "periodicMonthlyStatementImporterNumber", start: 28, length: 12, class: "X", designation: "C" },
    impliedDecimalField("totalDuty", 40, 11, "C"),
    impliedDecimalField("totalTax", 51, 11, "C"),
    filler(62, 19),
  ];
}

export const Q3_PERIODIC_SPEC: RecordSpec<Q3PeriodicInput> = {
  recordType: "Q3-Record (Periodic Monthly Statement Preliminary Payment Due)",
  length: 80,
  fields: q3q5PeriodicFields("Q3"),
};

export const Q5_PERIODIC_SPEC: RecordSpec<Q5PeriodicInput> = {
  recordType: "Q5-Record (Periodic Monthly Statement Final Paid Totals)",
  length: 80,
  fields: q3q5PeriodicFields("Q5"),
};
