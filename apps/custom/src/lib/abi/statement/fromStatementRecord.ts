import { Decimal } from "@/lib/tariff/decimal";
import { AbiFilingValidationError, assertValid, type EnvelopeHeaderOptions } from "@/lib/abi/entrySummary/fromCustomsFiling";
import { chunkBySequence } from "@/lib/abi/shared";
export { AbiFilingValidationError };
import type {
  Q1DailyInput,
  Q3DailyInput,
  Q1PeriodicInput,
  Q3PeriodicInput,
  StatementFeeInput,
} from "./types";

export type StatementRecordWithLines = {
  id: string;
  accountId: string;
  statementType: string; // 'daily' | 'periodic' | 'Q1-Q6'
  statementNumber: string;
  districtPort?: string | null;
  filerCode?: string | null;
  importerNumber?: string | null;
  printDate?: Date | null;
  dueDate?: Date | null;
  entryType?: string | null;
  totalDuty?: Decimal | number | null;
  totalTax?: Decimal | number | null;
  totalFee?: Decimal | number | null;
  totalAmount?: Decimal | number | null;
  statementFeeLines?: {
    id: string;
    accountingClassCode: string;
    amount: Decimal | number;
    sequence: number;
  }[];
};

export interface StatementFilingOptions extends EnvelopeHeaderOptions {
  /** Required for a daily statement's Q1 record — a statement number is not
   * an entry number, so it is never substituted for one. */
  entryNumber?: string;
  entrySummaryPresentationDate?: Date;
}

/**
 * Validates a StatementRecord for ABI statement output building. Every field
 * the wire-format types require is checked here so the builder never has to
 * invent a district/port, filer code, print/due date, or entry number.
 */
export function validateStatementRecord(
  record: StatementRecordWithLines,
  options?: Partial<StatementFilingOptions>
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  if (!record.statementNumber) {
    missingFields.push("statementRecord.statementNumber");
  }

  const filerCode = record.filerCode || options?.processingFilerCode;
  if (!filerCode || filerCode.trim() === "") {
    missingFields.push("statementRecord.filerCode (requires record.filerCode or options.processingFilerCode)");
  }

  const districtPort = record.districtPort || options?.processingDistrictPortCode;
  if (!districtPort || districtPort.trim() === "") {
    missingFields.push("statementRecord.districtPort (requires record.districtPort or options.processingDistrictPortCode)");
  }

  if (!record.printDate) {
    missingFields.push("statementRecord.printDate");
  }

  const isPeriodic = record.statementType.toLowerCase().includes("periodic");
  if (isPeriodic && !record.dueDate) {
    missingFields.push("statementRecord.dueDate (required for a periodic statement's Q3 record)");
  }
  if (!isPeriodic) {
    if (!options?.entryNumber) {
      missingFields.push("options.entryNumber (required for a daily statement's Q1 record; statementNumber is not an entry number)");
    }
    if (!record.entryType) {
      missingFields.push("statementRecord.entryType (required for a daily statement's Q1 record)");
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Groups StatementFeeLine rows into CATAIR StatementFeeInput records (5 pairs per fee record).
 */
export function mapStatementFeeLines(
  feeLines: { accountingClassCode: string; amount: Decimal | number; sequence: number }[]
): StatementFeeInput[] {
  return chunkBySequence(feeLines, 5).map((chunk, i) => ({
    sequenceNumber: String(i + 1).padStart(2, "0"),
    firstFeeClassCode: chunk[0]?.accountingClassCode,
    firstFeeAmount: chunk[0] ? new Decimal(chunk[0].amount) : undefined,
    secondFeeClassCode: chunk[1]?.accountingClassCode,
    secondFeeAmount: chunk[1] ? new Decimal(chunk[1].amount) : undefined,
    thirdFeeClassCode: chunk[2]?.accountingClassCode,
    thirdFeeAmount: chunk[2] ? new Decimal(chunk[2].amount) : undefined,
    fourthFeeClassCode: chunk[3]?.accountingClassCode,
    fourthFeeAmount: chunk[3] ? new Decimal(chunk[3].amount) : undefined,
    fifthFeeClassCode: chunk[4]?.accountingClassCode,
    fifthFeeAmount: chunk[4] ? new Decimal(chunk[4].amount) : undefined,
  }));
}

/**
 * Converts a database StatementRecord and its StatementFeeLines to ABI statement input objects.
 */
export function fromStatementRecord(
  record: StatementRecordWithLines,
  options?: Partial<StatementFilingOptions>
): {
  isPeriodic: boolean;
  q1Daily?: Q1DailyInput;
  q3Daily?: Q3DailyInput;
  q1Periodic?: Q1PeriodicInput;
  q3Periodic?: Q3PeriodicInput;
  fees: StatementFeeInput[];
} {
  const validation = validateStatementRecord(record, options);
  assertValid(record.id, validation);

  const filerCode = (record.filerCode || options!.processingFilerCode)!.slice(0, 3).toUpperCase();
  const districtPort = (record.districtPort || options!.processingDistrictPortCode)!.slice(0, 4);
  const printDate = record.printDate!;
  const feeInputs = mapStatementFeeLines(record.statementFeeLines || []);

  const isPeriodic = record.statementType.toLowerCase().includes("periodic");

  if (isPeriodic) {
    const dueDate = record.dueDate!;
    const q1Periodic: Q1PeriodicInput = {
      periodicDailyStatementNumber: record.statementNumber.slice(0, 10),
      periodicDailyStatementDistrictPort: districtPort,
      periodicDailyStatementFilerCode: filerCode,
      periodicDailyStatementImporterNumber: record.importerNumber ?? undefined,
      preliminaryPeriodicDailyStatementPrintDate: printDate,
      entrySummaryPresentationDate: options?.entrySummaryPresentationDate || printDate,
      totalDuty: record.totalDuty != null ? new Decimal(record.totalDuty) : undefined,
      totalTax: record.totalTax != null ? new Decimal(record.totalTax) : undefined,
    };

    const q3Periodic: Q3PeriodicInput = {
      periodicMonthlyStatementNumber: record.statementNumber,
      periodicMonthlyStatementPrintDate: printDate,
      periodicMonthlyStatementDueDate: dueDate,
      periodicMonthlyStatementFilerCode: filerCode,
      periodicMonthlyStatementImporterNumber: record.importerNumber ?? undefined,
      totalDuty: record.totalDuty != null ? new Decimal(record.totalDuty) : undefined,
      totalTax: record.totalTax != null ? new Decimal(record.totalTax) : undefined,
    };

    return {
      isPeriodic: true,
      q1Periodic,
      q3Periodic,
      fees: feeInputs,
    };
  }

  const q1Daily: Q1DailyInput = {
    districtPortOfEntrySummary: districtPort,
    entryFilerCode: filerCode,
    entryNumber: options!.entryNumber!.slice(0, 8),
    importerOfRecordNumber: record.importerNumber ?? undefined,
    preliminaryDailyStatementPrintDate: printDate,
    estimatedDutyAmount: record.totalDuty != null ? new Decimal(record.totalDuty) : undefined,
    estimatedTaxAmount: record.totalTax != null ? new Decimal(record.totalTax) : undefined,
    entryType: record.entryType!,
  };

  const q3Daily: Q3DailyInput = {
    dailyStatementNumber: record.statementNumber,
    dailyStatementPrintDate: printDate,
    entryFilerCode: filerCode,
    importerOfRecordNumber: record.importerNumber ?? undefined,
    totalEstimatedDuty: record.totalDuty != null ? new Decimal(record.totalDuty) : undefined,
    totalEstimatedTax: record.totalTax != null ? new Decimal(record.totalTax) : undefined,
    districtPortWhichProcessesEntries: districtPort,
  };

  return {
    isPeriodic: false,
    q1Daily,
    q3Daily,
    fees: feeInputs,
  };
}
