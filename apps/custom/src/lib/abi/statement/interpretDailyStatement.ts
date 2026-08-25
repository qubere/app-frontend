import { Decimal } from "@/lib/tariff/decimal";
import type { CustomsResponseRecordData } from "@/lib/abi/entrySummary/interpretResponse";
import type {
  ParsedDailyStatementResponse,
  StatementFeeInput,
  Q3DailyInput,
  Q4DailyInput,
  Q5DailyInput,
  Q6DailyInput,
} from "./types";

export type { CustomsResponseRecordData };

export interface StatementFeeSummary {
  classCode: string;
  amount: string;
}

export interface InterpretedDailyStatementPaymentGroup {
  statementNumber: string;
  statementPrintDate: Date;
  entryFilerCode: string;
  importerOfRecordNumber?: string;
  districtPort: string;
  totalEstimatedDuty?: string;
  totalEstimatedTax?: string;
  totalDeferredTax?: string;
  totalAntidumpingDuty?: string;
  totalCountervailingDuty?: string;
  totalAmount?: string;
  totalInterestAmountForReconciliation?: string;
  totalRevenueProducingEntries: number;
  totalNonRevenueProducingEntries: number;
  feeTotals: StatementFeeSummary[];
}

export interface InterpretedDailyStatementSummary {
  statementNumber?: string;
  printDate?: Date;
  entryFilerCode?: string;
  importerOfRecordNumber?: string;
  preliminaryPayment?: InterpretedDailyStatementPaymentGroup;
  finalPayment?: InterpretedDailyStatementPaymentGroup;
  totalEntriesCount: number;
  deletedEntriesCount: number;
}

export interface InterpretedDailyStatementResponse {
  summary: InterpretedDailyStatementSummary;
  customsResponseRecords: CustomsResponseRecordData[];
  unrecognizedLines: string[];
}

export interface InterpretDailyStatementOptions {
  accountId?: string;
  /** Map of `${entryFilerCode}-${entryNumber}` or `${entryNumber}` to Prisma `filingId`. */
  filingIdMap?: Record<string, string>;
  defaultFilingId?: string;
}

/**
 * Extracts fee class code and amount pairs from StatementFeeInput records (QA/QE/QJ).
 */
export function extractStatementFees(fees: StatementFeeInput[]): StatementFeeSummary[] {
  const result: StatementFeeSummary[] = [];
  for (const fee of fees) {
    if (fee.firstFeeClassCode) {
      result.push({ classCode: fee.firstFeeClassCode, amount: fee.firstFeeAmount?.toString() ?? "0.00" });
    }
    if (fee.secondFeeClassCode) {
      result.push({ classCode: fee.secondFeeClassCode, amount: fee.secondFeeAmount?.toString() ?? "0.00" });
    }
    if (fee.thirdFeeClassCode) {
      result.push({ classCode: fee.thirdFeeClassCode, amount: fee.thirdFeeAmount?.toString() ?? "0.00" });
    }
    if (fee.fourthFeeClassCode) {
      result.push({ classCode: fee.fourthFeeClassCode, amount: fee.fourthFeeAmount?.toString() ?? "0.00" });
    }
    if (fee.fifthFeeClassCode) {
      result.push({ classCode: fee.fifthFeeClassCode, amount: fee.fifthFeeAmount?.toString() ?? "0.00" });
    }
  }
  return result;
}

/**
 * Sums all fee amounts present across StatementFeeInput records.
 */
export function sumStatementFeeAmounts(fees: StatementFeeInput[]): Decimal {
  let total = new Decimal(0);
  for (const fee of fees) {
    if (fee.firstFeeAmount) total = total.plus(fee.firstFeeAmount);
    if (fee.secondFeeAmount) total = total.plus(fee.secondFeeAmount);
    if (fee.thirdFeeAmount) total = total.plus(fee.thirdFeeAmount);
    if (fee.fourthFeeAmount) total = total.plus(fee.fourthFeeAmount);
    if (fee.fifthFeeAmount) total = total.plus(fee.fifthFeeAmount);
  }
  return total;
}

function buildPaymentGroupSummary(
  q3q5: Q3DailyInput | Q5DailyInput,
  q4q6: Q4DailyInput | Q6DailyInput,
  feeTotals: StatementFeeInput[]
): InterpretedDailyStatementPaymentGroup {
  const isQ6 = "totalAmountPaid" in q4q6;
  const totalAmount = isQ6
    ? (q4q6 as Q6DailyInput).totalAmountPaid?.toString()
    : (q4q6 as Q4DailyInput).totalAmountDue?.toString();

  return {
    statementNumber: q3q5.dailyStatementNumber,
    statementPrintDate: q3q5.dailyStatementPrintDate,
    entryFilerCode: q3q5.entryFilerCode,
    importerOfRecordNumber: q3q5.importerOfRecordNumber,
    districtPort: q3q5.districtPortWhichProcessesEntries,
    totalEstimatedDuty: q3q5.totalEstimatedDuty?.toString(),
    totalEstimatedTax: q3q5.totalEstimatedTax?.toString(),
    totalDeferredTax: q3q5.totalDeferredTax?.toString(),
    totalAntidumpingDuty: q4q6.totalAntidumpingDuty?.toString(),
    totalCountervailingDuty: q4q6.totalCountervailingDuty?.toString(),
    totalAmount,
    totalInterestAmountForReconciliation: q4q6.totalInterestAmountForReconciliationSummary?.toString(),
    totalRevenueProducingEntries: q4q6.totalNumberRevenueProducingEntries,
    totalNonRevenueProducingEntries: q4q6.totalNumberNonRevenueProducingEntries,
    feeTotals: extractStatementFees(feeTotals),
  };
}

/**
 * Interprets a ParsedDailyStatementResponse, attributing per-entry detail records (Q1/Q2/QA)
 * and deleted entries (Q7) to Prisma filing IDs via filingIdMap into CustomsResponseRecordData[],
 * while returning structured statement-level totals for Q3/Q4/QE and Q5/Q6/QJ.
 */
export function interpretDailyStatement(
  parsed: ParsedDailyStatementResponse,
  options: InterpretDailyStatementOptions = {}
): InterpretedDailyStatementResponse {
  const accountId = options.accountId ?? "default-account";
  const defaultFilingId = options.defaultFilingId ?? "daily-statement-filing";
  const filingIdMap = options.filingIdMap ?? {};

  const customsResponseRecords: CustomsResponseRecordData[] = [];

  // 1. Map per-entry detail groups (Q1/Q2/QA)
  for (const detail of parsed.details) {
    const entryFilerCode = detail.q1.entryFilerCode;
    const entryNumber = detail.q1.entryNumber;
    const entryKey = `${entryFilerCode}-${entryNumber}`;
    const filingId = filingIdMap[entryKey] || filingIdMap[entryNumber] || defaultFilingId;

    const totalFees = sumStatementFeeAmounts(detail.fees);
    const estDuty = detail.q1.estimatedDutyAmount?.toString() ?? "0.00";
    const estTax = detail.q1.estimatedTaxAmount?.toString() ?? "0.00";
    const adDuty = detail.q2.antidumpingDutyAmount?.toString() ?? "0.00";
    const cvdDuty = detail.q2.countervailingDutyAmount?.toString() ?? "0.00";

    const descParts = [
      `Daily Statement Detail for Entry ${entryKey} (Type ${detail.q1.entryType}).`,
      `Duty: $${estDuty}, Tax: $${estTax}, ADD: $${adDuty}, CVD: $${cvdDuty}, Fees: $${totalFees.toString()}.`,
      `Payment Type: ${detail.q2.paymentTypeIndicator}.`,
    ];

    if (detail.q1.brokerReferenceNumber) {
      descParts.push(`Broker Ref: ${detail.q1.brokerReferenceNumber}.`);
    }

    const isFinal = Boolean(parsed.finalStatement);
    const status = isFinal ? "FINAL" : "PRELIMINARY";

    customsResponseRecords.push({
      accountId,
      filingId,
      code: detail.q1.entryType || "Q1",
      title: `Daily Statement Entry ${entryKey}`,
      description: descParts.join(" "),
      status,
    });
  }

  // 2. Map deleted entry summaries (Q7)
  let deletedEntriesCount = 0;
  for (const q7 of parsed.deletedEntrySummaries) {
    const deletionPairs = [
      { filer: q7.entryFilerCode1, entry: q7.entryNumber1, source: q7.deleteSource1 },
      { filer: q7.entryFilerCode2, entry: q7.entryNumber2, source: q7.deleteSource2 },
      { filer: q7.entryFilerCode3, entry: q7.entryNumber3, source: q7.deleteSource3 },
      { filer: q7.entryFilerCode4, entry: q7.entryNumber4, source: q7.deleteSource4 },
    ];

    for (const pair of deletionPairs) {
      if (!pair.filer || !pair.entry) continue;
      deletedEntriesCount++;

      const entryKey = `${pair.filer}-${pair.entry}`;
      const filingId = filingIdMap[entryKey] || filingIdMap[pair.entry] || defaultFilingId;

      customsResponseRecords.push({
        accountId,
        filingId,
        code: "Q7",
        title: `Statement Deleted Entry Summary ${entryKey}`,
        description: `Entry summary ${entryKey} deleted from statement ${q7.statementNumber} via ${pair.source} action.`,
        status: "DELETED",
      });
    }
  }

  // 3. Extract statement-level summary
  let preliminaryPayment: InterpretedDailyStatementPaymentGroup | undefined;
  if (parsed.preliminaryOrFinalPayment) {
    preliminaryPayment = buildPaymentGroupSummary(
      parsed.preliminaryOrFinalPayment.q3,
      parsed.preliminaryOrFinalPayment.q4,
      parsed.preliminaryOrFinalPayment.feeTotals
    );
  }

  let finalPayment: InterpretedDailyStatementPaymentGroup | undefined;
  if (parsed.finalStatement) {
    finalPayment = buildPaymentGroupSummary(
      parsed.finalStatement.q5,
      parsed.finalStatement.q6,
      parsed.finalStatement.feeTotals
    );
  }

  const primaryGroup = preliminaryPayment || finalPayment;
  const statementSummary: InterpretedDailyStatementSummary = {
    statementNumber: primaryGroup?.statementNumber,
    printDate: primaryGroup?.statementPrintDate,
    entryFilerCode: primaryGroup?.entryFilerCode,
    importerOfRecordNumber: primaryGroup?.importerOfRecordNumber,
    preliminaryPayment,
    finalPayment,
    totalEntriesCount: parsed.details.length,
    deletedEntriesCount,
  };

  return {
    summary: statementSummary,
    customsResponseRecords,
    unrecognizedLines: parsed.unrecognizedLines,
  };
}
