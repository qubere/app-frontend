import type { CustomsResponseRecordData } from "@/lib/abi/entrySummary/interpretResponse";
import type {
  ParsedPeriodicStatementResponse,
  StatementFeeInput,
  Q3PeriodicInput,
  Q4PeriodicInput,
  Q5PeriodicInput,
  Q6PeriodicInput,
} from "./types";
import {
  extractStatementFees,
  sumStatementFeeAmounts,
  type StatementFeeSummary,
} from "./interpretDailyStatement";

export type { CustomsResponseRecordData, StatementFeeSummary };

export interface InterpretedPeriodicStatementPaymentGroup {
  periodicMonthlyStatementNumber: string;
  printDate: Date;
  dueDate: Date;
  filerCode: string;
  importerOfRecordNumber?: string;
  totalDuty?: string;
  totalTax?: string;
  totalAntidumpingDuty?: string;
  totalCountervailingDuty?: string;
  totalAmount?: string;
  feeTotals: StatementFeeSummary[];
}

export interface InterpretedPeriodicStatementSummary {
  statementNumber?: string;
  printDate?: Date;
  dueDate?: Date;
  filerCode?: string;
  importerOfRecordNumber?: string;
  preliminaryPayment?: InterpretedPeriodicStatementPaymentGroup;
  finalPayment?: InterpretedPeriodicStatementPaymentGroup;
  totalDetailsCount: number;
  deletedEntriesCount: number;
}

export interface InterpretedPeriodicStatementResponse {
  summary: InterpretedPeriodicStatementSummary;
  customsResponseRecords: CustomsResponseRecordData[];
  unrecognizedLines: string[];
}

export interface InterpretPeriodicStatementOptions {
  accountId?: string;
  /** Map of `${filerCode}-${statementNumber}` or `${statementNumber}` or `${entryFilerCode}-${entryNumber}` to Prisma `filingId`. */
  filingIdMap?: Record<string, string>;
  defaultFilingId?: string;
}

function buildPeriodicPaymentGroupSummary(
  q3q5: Q3PeriodicInput | Q5PeriodicInput,
  q4q6: Q4PeriodicInput | Q6PeriodicInput,
  feeTotals: StatementFeeInput[]
): InterpretedPeriodicStatementPaymentGroup {
  const isQ6 = "totalAmountPaid" in q4q6;
  const totalAmount = isQ6
    ? (q4q6 as Q6PeriodicInput).totalAmountPaid?.toString()
    : (q4q6 as Q4PeriodicInput).totalAmountDue?.toString();

  return {
    periodicMonthlyStatementNumber: q3q5.periodicMonthlyStatementNumber,
    printDate: q3q5.periodicMonthlyStatementPrintDate,
    dueDate: q3q5.periodicMonthlyStatementDueDate,
    filerCode: q3q5.periodicMonthlyStatementFilerCode,
    importerOfRecordNumber: q3q5.periodicMonthlyStatementImporterNumber,
    totalDuty: q3q5.totalDuty?.toString(),
    totalTax: q3q5.totalTax?.toString(),
    totalAntidumpingDuty: q4q6.totalAntidumpingDuty?.toString(),
    totalCountervailingDuty: q4q6.totalCountervailingDuty?.toString(),
    totalAmount,
    feeTotals: extractStatementFees(feeTotals),
  };
}

/**
 * Interprets a ParsedPeriodicStatementResponse, attributing daily statement detail groups (Q1/Q2/QA)
 * and deleted entry summaries (Q7) to Prisma filing IDs via filingIdMap into CustomsResponseRecordData[],
 * while returning structured statement-level totals for Q3/Q4/QE and Q5/Q6/QJ.
 */
export function interpretPeriodicStatement(
  parsed: ParsedPeriodicStatementResponse,
  options: InterpretPeriodicStatementOptions = {}
): InterpretedPeriodicStatementResponse {
  const accountId = options.accountId ?? "default-account";
  const defaultFilingId = options.defaultFilingId ?? "periodic-statement-filing";
  const filingIdMap = options.filingIdMap ?? {};

  const customsResponseRecords: CustomsResponseRecordData[] = [];

  // 1. Map daily statement detail groups (Q1/Q2/QA)
  for (const detail of parsed.details) {
    const filerCode = detail.q1.periodicDailyStatementFilerCode;
    const stmtNumber = detail.q1.periodicDailyStatementNumber;
    const entryKey = `${filerCode}-${stmtNumber}`;
    const filingId = filingIdMap[entryKey] || filingIdMap[stmtNumber] || defaultFilingId;

    const totalFees = sumStatementFeeAmounts(detail.fees);
    const duty = detail.q1.totalDuty?.toString() ?? "0.00";
    const tax = detail.q1.totalTax?.toString() ?? "0.00";
    const adDuty = detail.q2.totalAntidumpingDuty?.toString() ?? "0.00";
    const cvdDuty = detail.q2.totalCountervailingDuty?.toString() ?? "0.00";
    const amtDue = detail.q2.totalAmountDue?.toString() ?? "0.00";

    const descParts = [
      `Periodic Statement Daily Detail ${entryKey} (Port ${detail.q1.periodicDailyStatementDistrictPort}).`,
      `Duty: $${duty}, Tax: $${tax}, ADD: $${adDuty}, CVD: $${cvdDuty}, Amount Due: $${amtDue}, Fees: $${totalFees.toString()}.`,
    ];

    const isFinal = Boolean(parsed.finalStatement);
    const status = isFinal ? "FINAL" : "PRELIMINARY";

    customsResponseRecords.push({
      accountId,
      filingId,
      code: "Q1",
      title: `Periodic Daily Statement Group ${entryKey}`,
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
  let preliminaryPayment: InterpretedPeriodicStatementPaymentGroup | undefined;
  if (parsed.preliminaryOrFinalPayment) {
    preliminaryPayment = buildPeriodicPaymentGroupSummary(
      parsed.preliminaryOrFinalPayment.q3,
      parsed.preliminaryOrFinalPayment.q4,
      parsed.preliminaryOrFinalPayment.feeTotals
    );
  }

  let finalPayment: InterpretedPeriodicStatementPaymentGroup | undefined;
  if (parsed.finalStatement) {
    finalPayment = buildPeriodicPaymentGroupSummary(
      parsed.finalStatement.q5,
      parsed.finalStatement.q6,
      parsed.finalStatement.feeTotals
    );
  }

  const primaryGroup = preliminaryPayment || finalPayment;
  const statementSummary: InterpretedPeriodicStatementSummary = {
    statementNumber: primaryGroup?.periodicMonthlyStatementNumber,
    printDate: primaryGroup?.printDate,
    dueDate: primaryGroup?.dueDate,
    filerCode: primaryGroup?.filerCode,
    importerOfRecordNumber: primaryGroup?.importerOfRecordNumber,
    preliminaryPayment,
    finalPayment,
    totalDetailsCount: parsed.details.length,
    deletedEntriesCount,
  };

  return {
    summary: statementSummary,
    customsResponseRecords,
    unrecognizedLines: parsed.unrecognizedLines,
  };
}
