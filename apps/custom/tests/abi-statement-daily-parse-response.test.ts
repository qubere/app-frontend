/**
 * CATAIR Daily Statement Response Parsing Tests (`parseDailyStatement.ts`)
 * Grounded in docs/plans/catair-source-docs/05-daily-statement.pdf
 * PDF Pages 6-9 (Output Record Structure Map & Descriptions).
 */

import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/tariff/decimal";
import { AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import {
  buildQ1Daily,
  buildQ2Daily,
  buildStatementFee,
  buildQ3Daily,
  buildQ4Daily,
  buildPreliminaryStatementFeeTotal,
  buildQ5Daily,
  buildQ6Daily,
  buildFinalPaidStatementFeeTotal,
  buildQ7Deleted,
} from "@/lib/abi/statement/build";
import { parseDailyStatement, parseDailyStatementText } from "@/lib/abi/statement/parseDailyStatement";
import type {
  Q1DailyInput,
  Q2DailyInput,
  StatementFeeInput,
  Q3DailyInput,
  Q4DailyInput,
  Q5DailyInput,
  Q6DailyInput,
  Q7DeletedInput,
} from "@/lib/abi/statement/types";

describe("CATAIR Daily Statement Response Parsing", () => {
  const sampleQ1_1: Q1DailyInput = {
    districtPortOfEntrySummary: "2704",
    entryFilerCode: "N01",
    entryNumber: "03245278",
    importerOfRecordNumber: "12-3456789XX",
    preliminaryDailyStatementPrintDate: new Date(2026, 7, 22), // 082226
    estimatedDutyAmount: new Decimal("1250.50"),
    estimatedTaxAmount: new Decimal("75.00"),
    deferredTaxIndicator: "N",
    brokerReferenceNumber: "REF12345",
    consolidatedIndicator: "C",
    clientBranchDesignation: "01",
    entryType: "01",
  };

  const sampleQ2_1: Q2DailyInput = {
    districtPortOfEntrySummary: "2704",
    entryFilerCode: "N01",
    entryNumber: "03245278",
    antidumpingDutyAmount: new Decimal("100.00"),
    countervailingDutyAmount: new Decimal("50.25"),
    paymentTypeIndicator: "2",
    payIndicator: "Y",
    countervailingIndicator: "Y",
    antidumpingIndicator: "Y",
    teamNumber: "001",
    interestAmountForReconciliationSummary: new Decimal("12.34"),
  };

  const sampleQA_1: StatementFeeInput = {
    sequenceNumber: "01",
    firstFeeClassCode: "056",
    firstFeeAmount: new Decimal("31.42"),
    secondFeeClassCode: "499",
    secondFeeAmount: new Decimal("12.00"),
  };

  const sampleQ1_2: Q1DailyInput = {
    districtPortOfEntrySummary: "2704",
    entryFilerCode: "N01",
    entryNumber: "03245279",
    importerOfRecordNumber: "12-3456789XX",
    preliminaryDailyStatementPrintDate: new Date(2026, 7, 22),
    estimatedDutyAmount: new Decimal("500.00"),
    estimatedTaxAmount: new Decimal("0.00"),
    entryType: "01",
  };

  const sampleQ2_2: Q2DailyInput = {
    districtPortOfEntrySummary: "2704",
    entryFilerCode: "N01",
    entryNumber: "03245279",
    paymentTypeIndicator: "2",
    payIndicator: "Y",
  };

  const sampleQ3: Q3DailyInput = {
    dailyStatementNumber: "2726234001",
    dailyStatementPrintDate: new Date(2026, 7, 22),
    entryFilerCode: "N01",
    importerOfRecordNumber: "12-3456789XX",
    totalEstimatedDuty: new Decimal("1750.50"),
    totalEstimatedTax: new Decimal("75.00"),
    totalDeferredTax: new Decimal("0.00"),
    districtPortWhichProcessesEntries: "2704",
  };

  const sampleQ4: Q4DailyInput = {
    totalAntidumpingDuty: new Decimal("100.00"),
    totalCountervailingDuty: new Decimal("50.25"),
    totalAmountDue: new Decimal("2019.51"),
    totalInterestAmountForReconciliationSummary: new Decimal("12.34"),
    totalNumberRevenueProducingEntries: 2,
    totalNumberNonRevenueProducingEntries: 0,
  };

  const sampleQE: StatementFeeInput = {
    sequenceNumber: "01",
    firstFeeClassCode: "056",
    firstFeeAmount: new Decimal("31.42"),
    secondFeeClassCode: "499",
    secondFeeAmount: new Decimal("12.00"),
  };

  const sampleQ5: Q5DailyInput = {
    ...sampleQ3,
  };

  const sampleQ6: Q6DailyInput = {
    totalAntidumpingDuty: new Decimal("100.00"),
    totalCountervailingDuty: new Decimal("50.25"),
    totalAmountPaid: new Decimal("2019.51"),
    totalInterestAmountForReconciliationSummary: new Decimal("12.34"),
    totalNumberRevenueProducingEntries: 2,
    totalNumberNonRevenueProducingEntries: 0,
  };

  const sampleQJ: StatementFeeInput = {
    sequenceNumber: "01",
    firstFeeClassCode: "056",
    firstFeeAmount: new Decimal("31.42"),
    secondFeeClassCode: "499",
    secondFeeAmount: new Decimal("12.00"),
  };

  const sampleQ7: Q7DeletedInput = {
    statementNumber: "2726234001",
    entryFilerCode1: "N01",
    entryNumber1: "03245200",
    deleteSource1: "ABI",
    entryFilerCode2: "N01",
    entryNumber2: "03245201",
    deleteSource2: "CBP",
  };

  it("parses a preliminary daily statement (Q1/Q2/QA + Q3/Q4/QE, no Q5/Q6/QJ)", () => {
    const lines = [
      buildQ1Daily(sampleQ1_1),
      buildQ2Daily(sampleQ2_1),
      buildStatementFee(sampleQA_1),
      buildQ1Daily(sampleQ1_2),
      buildQ2Daily(sampleQ2_2),
      buildQ3Daily(sampleQ3),
      buildQ4Daily(sampleQ4),
      buildPreliminaryStatementFeeTotal(sampleQE),
    ];

    const result = parseDailyStatement(lines);

    expect(result.details).toHaveLength(2);

    // Detail group 1
    expect(result.details[0].q1.entryNumber).toBe("03245278");
    expect(result.details[0].q1.estimatedDutyAmount).toEqual(new Decimal("1250.50"));
    expect(result.details[0].q2.paymentTypeIndicator).toBe("2");
    expect(result.details[0].q2.antidumpingDutyAmount).toEqual(new Decimal("100.00"));
    expect(result.details[0].fees).toHaveLength(1);
    expect(result.details[0].fees[0].firstFeeClassCode).toBe("056");
    expect(result.details[0].fees[0].firstFeeAmount).toEqual(new Decimal("31.42"));

    // Detail group 2
    expect(result.details[1].q1.entryNumber).toBe("03245279");
    expect(result.details[1].q2.payIndicator).toBe("Y");
    expect(result.details[1].fees).toHaveLength(0);

    // Preliminary totals group
    expect(result.preliminaryOrFinalPayment).toBeDefined();
    expect(result.preliminaryOrFinalPayment?.q3.dailyStatementNumber).toBe("2726234001");
    expect(result.preliminaryOrFinalPayment?.q3.totalEstimatedDuty).toEqual(new Decimal("1750.50"));
    expect(result.preliminaryOrFinalPayment?.q4.totalAmountDue).toEqual(new Decimal("2019.51"));
    expect(result.preliminaryOrFinalPayment?.q4.totalNumberRevenueProducingEntries).toBe(2);
    expect(result.preliminaryOrFinalPayment?.feeTotals).toHaveLength(1);
    expect(result.preliminaryOrFinalPayment?.feeTotals[0].firstFeeClassCode).toBe("056");

    // No final payment group or deleted entries
    expect(result.finalStatement).toBeUndefined();
    expect(result.deletedEntrySummaries).toHaveLength(0);
    expect(result.unrecognizedLines).toHaveLength(0);
  });

  it("parses a final daily statement (adds Q5/Q6/QJ paid totals)", () => {
    const lines = [
      buildQ1Daily(sampleQ1_1),
      buildQ2Daily(sampleQ2_1),
      buildStatementFee(sampleQA_1),
      buildQ3Daily(sampleQ3),
      buildQ4Daily(sampleQ4),
      buildPreliminaryStatementFeeTotal(sampleQE),
      buildQ5Daily(sampleQ5),
      buildQ6Daily(sampleQ6),
      buildFinalPaidStatementFeeTotal(sampleQJ),
    ];

    const result = parseDailyStatement(lines);

    expect(result.details).toHaveLength(1);
    expect(result.preliminaryOrFinalPayment).toBeDefined();

    // Final statement paid totals group
    expect(result.finalStatement).toBeDefined();
    expect(result.finalStatement?.q5.dailyStatementNumber).toBe("2726234001");
    expect(result.finalStatement?.q6.totalAmountPaid).toEqual(new Decimal("2019.51"));
    expect(result.finalStatement?.q6.totalNumberRevenueProducingEntries).toBe(2);
    expect(result.finalStatement?.feeTotals).toHaveLength(1);
    expect(result.finalStatement?.feeTotals[0].firstFeeClassCode).toBe("056");
    expect(result.finalStatement?.feeTotals[0].firstFeeAmount).toEqual(new Decimal("31.42"));
  });

  it("parses a daily statement with deleted entry summary (Q7)", () => {
    const lines = [
      buildQ1Daily(sampleQ1_1),
      buildQ2Daily(sampleQ2_1),
      buildQ3Daily(sampleQ3),
      buildQ4Daily(sampleQ4),
      buildQ7Deleted(sampleQ7),
    ];

    const result = parseDailyStatement(lines);

    expect(result.details).toHaveLength(1);
    expect(result.preliminaryOrFinalPayment).toBeDefined();
    expect(result.finalStatement).toBeUndefined();

    // Deleted entry summary
    expect(result.deletedEntrySummaries).toHaveLength(1);
    expect(result.deletedEntrySummaries[0].statementNumber).toBe("2726234001");
    expect(result.deletedEntrySummaries[0].entryFilerCode1).toBe("N01");
    expect(result.deletedEntrySummaries[0].entryNumber1).toBe("03245200");
    expect(result.deletedEntrySummaries[0].deleteSource1).toBe("ABI");
    expect(result.deletedEntrySummaries[0].entryFilerCode2).toBe("N01");
    expect(result.deletedEntrySummaries[0].entryNumber2).toBe("03245201");
    expect(result.deletedEntrySummaries[0].deleteSource2).toBe("CBP");
  });

  it("handles multiline raw string text input via parseDailyStatementText", () => {
    const rawText = [
      buildQ1Daily(sampleQ1_1),
      buildQ2Daily(sampleQ2_1),
      buildQ3Daily(sampleQ3),
      buildQ4Daily(sampleQ4),
    ].join("\n");

    const result = parseDailyStatementText(rawText);
    expect(result.details).toHaveLength(1);
    expect(result.preliminaryOrFinalPayment).toBeDefined();
    expect(result.preliminaryOrFinalPayment?.q3.dailyStatementNumber).toBe("2726234001");
  });

  it("captures unrecognized lines (such as batch block control records)", () => {
    const headerLine = "B2704N01  PF082226                                                              ";
    const lines = [
      headerLine,
      buildQ1Daily(sampleQ1_1),
      buildQ2Daily(sampleQ2_1),
      buildQ3Daily(sampleQ3),
      buildQ4Daily(sampleQ4),
    ];

    const result = parseDailyStatement(lines);
    expect(result.details).toHaveLength(1);
    expect(result.unrecognizedLines).toHaveLength(1);
    expect(result.unrecognizedLines[0]).toBe(headerLine);
  });

  it("throws AbiFixedWidthError when Q2 is missing for a detail group", () => {
    const lines = [
      buildQ1Daily(sampleQ1_1),
      // Missing Q2
      buildQ3Daily(sampleQ3),
      buildQ4Daily(sampleQ4),
    ];

    expect(() => parseDailyStatement(lines)).toThrow(AbiFixedWidthError);
  });

  it("throws AbiFixedWidthError when Q2 is encountered without preceding Q1", () => {
    const lines = [buildQ2Daily(sampleQ2_1)];

    expect(() => parseDailyStatement(lines)).toThrow(AbiFixedWidthError);
  });

  it("throws AbiFixedWidthError when Q4 is encountered without preceding Q3", () => {
    const lines = [
      buildQ1Daily(sampleQ1_1),
      buildQ2Daily(sampleQ2_1),
      buildQ4Daily(sampleQ4), // missing Q3
    ];

    expect(() => parseDailyStatement(lines)).toThrow(AbiFixedWidthError);
  });

  it("throws AbiFixedWidthError when Q6 is encountered without preceding Q5", () => {
    const lines = [
      buildQ1Daily(sampleQ1_1),
      buildQ2Daily(sampleQ2_1),
      buildQ3Daily(sampleQ3),
      buildQ4Daily(sampleQ4),
      buildQ6Daily(sampleQ6), // missing Q5
    ];

    expect(() => parseDailyStatement(lines)).toThrow(AbiFixedWidthError);
  });
});
