/**
 * CATAIR Periodic Monthly Statement Response Parsing Tests (`parsePeriodicStatement.ts`)
 * Grounded in docs/plans/catair-source-docs/05b-periodic-monthly-statement.pdf
 * PDF Pages 5-6 (Output Record Structure Map & Descriptions).
 */

import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/tariff/decimal";
import { AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import {
  buildQ1Periodic,
  buildQ2Periodic,
  buildStatementFee,
  buildQ3Periodic,
  buildQ4Periodic,
  buildPreliminaryStatementFeeTotal,
  buildQ5Periodic,
  buildQ6Periodic,
  buildFinalPaidStatementFeeTotal,
  buildQ7Deleted,
} from "@/lib/abi/statement/build";
import {
  parsePeriodicStatement,
  parsePeriodicStatementText,
} from "@/lib/abi/statement/parsePeriodicStatement";
import type {
  Q1PeriodicInput,
  Q2PeriodicInput,
  StatementFeeInput,
  Q3PeriodicInput,
  Q4PeriodicInput,
  Q5PeriodicInput,
  Q6PeriodicInput,
  Q7DeletedInput,
} from "@/lib/abi/statement/types";

describe("CATAIR Periodic Monthly Statement Response Parsing", () => {
  const sampleQ1_1: Q1PeriodicInput = {
    periodicDailyStatementNumber: "2726234001",
    periodicDailyStatementDistrictPort: "2704",
    periodicDailyStatementFilerCode: "N01",
    periodicDailyStatementImporterNumber: "12-3456789XX",
    preliminaryPeriodicDailyStatementPrintDate: new Date(2026, 7, 15), // 081526
    entrySummaryPresentationDate: new Date(2026, 7, 20), // 082026
    totalDuty: new Decimal("4500.00"),
    totalTax: new Decimal("250.75"),
  };

  const sampleQ2_1: Q2PeriodicInput = {
    totalAntidumpingDuty: new Decimal("300.00"),
    totalCountervailingDuty: new Decimal("150.50"),
    totalAmountDue: new Decimal("5201.25"),
  };

  const sampleQA_1: StatementFeeInput = {
    sequenceNumber: "01",
    firstFeeClassCode: "056",
    firstFeeAmount: new Decimal("31.42"),
    secondFeeClassCode: "499",
    secondFeeAmount: new Decimal("12.00"),
  };

  const sampleQ1_2: Q1PeriodicInput = {
    periodicDailyStatementNumber: "2726234002",
    periodicDailyStatementDistrictPort: "2704",
    periodicDailyStatementFilerCode: "N01",
    periodicDailyStatementImporterNumber: "12-3456789XX",
    preliminaryPeriodicDailyStatementPrintDate: new Date(2026, 7, 16),
    entrySummaryPresentationDate: new Date(2026, 7, 21),
    totalDuty: new Decimal("1200.00"),
    totalTax: new Decimal("0.00"),
  };

  const sampleQ2_2: Q2PeriodicInput = {
    totalAmountDue: new Decimal("1200.00"),
  };

  const sampleQA_2: StatementFeeInput = {
    sequenceNumber: "01",
    firstFeeClassCode: "056",
    firstFeeAmount: new Decimal("31.42"),
  };

  const sampleQ3: Q3PeriodicInput = {
    periodicMonthlyStatementNumber: "2726P08001",
    periodicMonthlyStatementPrintDate: new Date(2026, 7, 21),
    periodicMonthlyStatementDueDate: new Date(2026, 8, 15),
    periodicMonthlyStatementFilerCode: "N01",
    periodicMonthlyStatementImporterNumber: "12-3456789XX",
    totalDuty: new Decimal("5700.00"),
    totalTax: new Decimal("250.75"),
  };

  const sampleQ4: Q4PeriodicInput = {
    totalAntidumpingDuty: new Decimal("300.00"),
    totalCountervailingDuty: new Decimal("150.50"),
    totalAmountDue: new Decimal("6401.25"),
  };

  const sampleQE: StatementFeeInput = {
    sequenceNumber: "01",
    firstFeeClassCode: "056",
    firstFeeAmount: new Decimal("62.84"),
    secondFeeClassCode: "499",
    secondFeeAmount: new Decimal("12.00"),
  };

  const sampleQ5: Q5PeriodicInput = {
    ...sampleQ3,
  };

  const sampleQ6: Q6PeriodicInput = {
    totalAntidumpingDuty: new Decimal("300.00"),
    totalCountervailingDuty: new Decimal("150.50"),
    totalAmountPaid: new Decimal("6401.25"),
  };

  const sampleQJ: StatementFeeInput = {
    sequenceNumber: "01",
    firstFeeClassCode: "056",
    firstFeeAmount: new Decimal("62.84"),
    secondFeeClassCode: "499",
    secondFeeAmount: new Decimal("12.00"),
  };

  const sampleQ7: Q7DeletedInput = {
    statementNumber: "2726P08001",
    entryFilerCode1: "N01",
    entryNumber1: "03245200",
    deleteSource1: "ABI",
    entryFilerCode2: "N01",
    entryNumber2: "03245201",
    deleteSource2: "CBP",
  };

  it("parses a preliminary periodic monthly statement (Q1/Q2/QA + Q3/Q4/QE, no Q5/Q6/QJ)", () => {
    const lines = [
      buildQ1Periodic(sampleQ1_1),
      buildQ2Periodic(sampleQ2_1),
      buildStatementFee(sampleQA_1),
      buildQ1Periodic(sampleQ1_2),
      buildQ2Periodic(sampleQ2_2),
      buildStatementFee(sampleQA_2),
      buildQ3Periodic(sampleQ3),
      buildQ4Periodic(sampleQ4),
      buildPreliminaryStatementFeeTotal(sampleQE),
    ];

    const result = parsePeriodicStatement(lines);

    expect(result.details).toHaveLength(2);

    // Detail group 1
    expect(result.details[0].q1.periodicDailyStatementNumber).toBe("2726234001");
    expect(result.details[0].q1.totalDuty).toEqual(new Decimal("4500.00"));
    expect(result.details[0].q1.totalTax).toEqual(new Decimal("250.75"));
    expect(result.details[0].q2.totalAntidumpingDuty).toEqual(new Decimal("300.00"));
    expect(result.details[0].q2.totalAmountDue).toEqual(new Decimal("5201.25"));
    expect(result.details[0].fees).toHaveLength(1);
    expect(result.details[0].fees[0].firstFeeClassCode).toBe("056");
    expect(result.details[0].fees[0].firstFeeAmount).toEqual(new Decimal("31.42"));

    // Detail group 2
    expect(result.details[1].q1.periodicDailyStatementNumber).toBe("2726234002");
    expect(result.details[1].q2.totalAmountDue).toEqual(new Decimal("1200.00"));
    expect(result.details[1].fees).toHaveLength(1);

    // Preliminary totals group
    expect(result.preliminaryOrFinalPayment).toBeDefined();
    expect(result.preliminaryOrFinalPayment?.q3.periodicMonthlyStatementNumber).toBe("2726P08001");
    expect(result.preliminaryOrFinalPayment?.q3.totalDuty).toEqual(new Decimal("5700.00"));
    expect(result.preliminaryOrFinalPayment?.q4.totalAmountDue).toEqual(new Decimal("6401.25"));
    expect(result.preliminaryOrFinalPayment?.feeTotals).toHaveLength(1);
    expect(result.preliminaryOrFinalPayment?.feeTotals[0].firstFeeClassCode).toBe("056");

    // No final payment group or deleted entries
    expect(result.finalStatement).toBeUndefined();
    expect(result.deletedEntrySummaries).toHaveLength(0);
    expect(result.unrecognizedLines).toHaveLength(0);
  });

  it("parses a final periodic monthly statement (adds Q5/Q6/QJ paid totals)", () => {
    const lines = [
      buildQ1Periodic(sampleQ1_1),
      buildQ2Periodic(sampleQ2_1),
      buildStatementFee(sampleQA_1),
      buildQ3Periodic(sampleQ3),
      buildQ4Periodic(sampleQ4),
      buildPreliminaryStatementFeeTotal(sampleQE),
      buildQ5Periodic(sampleQ5),
      buildQ6Periodic(sampleQ6),
      buildFinalPaidStatementFeeTotal(sampleQJ),
    ];

    const result = parsePeriodicStatement(lines);

    expect(result.details).toHaveLength(1);
    expect(result.preliminaryOrFinalPayment).toBeDefined();

    // Final statement paid totals group
    expect(result.finalStatement).toBeDefined();
    expect(result.finalStatement?.q5.periodicMonthlyStatementNumber).toBe("2726P08001");
    expect(result.finalStatement?.q6.totalAmountPaid).toEqual(new Decimal("6401.25"));
    expect(result.finalStatement?.feeTotals).toHaveLength(1);
    expect(result.finalStatement?.feeTotals[0].firstFeeClassCode).toBe("056");
    expect(result.finalStatement?.feeTotals[0].firstFeeAmount).toEqual(new Decimal("62.84"));
  });

  it("parses a periodic monthly statement with deleted entry summary (Q7)", () => {
    const lines = [
      buildQ1Periodic(sampleQ1_1),
      buildQ2Periodic(sampleQ2_1),
      buildStatementFee(sampleQA_1),
      buildQ3Periodic(sampleQ3),
      buildQ4Periodic(sampleQ4),
      buildPreliminaryStatementFeeTotal(sampleQE),
      buildQ7Deleted(sampleQ7),
    ];

    const result = parsePeriodicStatement(lines);

    expect(result.details).toHaveLength(1);
    expect(result.preliminaryOrFinalPayment).toBeDefined();
    expect(result.finalStatement).toBeUndefined();

    // Deleted entry summary
    expect(result.deletedEntrySummaries).toHaveLength(1);
    expect(result.deletedEntrySummaries[0].statementNumber).toBe("2726P08001");
    expect(result.deletedEntrySummaries[0].entryFilerCode1).toBe("N01");
    expect(result.deletedEntrySummaries[0].entryNumber1).toBe("03245200");
    expect(result.deletedEntrySummaries[0].deleteSource1).toBe("ABI");
    expect(result.deletedEntrySummaries[0].entryFilerCode2).toBe("N01");
    expect(result.deletedEntrySummaries[0].entryNumber2).toBe("03245201");
    expect(result.deletedEntrySummaries[0].deleteSource2).toBe("CBP");
  });

  describe("QA/QE/QJ Mandatory-vs-Conditional behavior (PDF Page 6 Designation M)", () => {
    it("throws AbiFixedWidthError in default mode when QA fee record is missing from detail group", () => {
      const lines = [
        buildQ1Periodic(sampleQ1_1),
        buildQ2Periodic(sampleQ2_1),
        // Missing QA
        buildQ3Periodic(sampleQ3),
        buildQ4Periodic(sampleQ4),
        buildPreliminaryStatementFeeTotal(sampleQE),
      ];

      expect(() => parsePeriodicStatement(lines)).toThrow(AbiFixedWidthError);
      expect(() => parsePeriodicStatement(lines)).toThrow(/missing mandatory QA fee record/i);
    });

    it("throws AbiFixedWidthError in default mode when QE fee total record is missing from Q3/Q4 group", () => {
      const lines = [
        buildQ1Periodic(sampleQ1_1),
        buildQ2Periodic(sampleQ2_1),
        buildStatementFee(sampleQA_1),
        buildQ3Periodic(sampleQ3),
        buildQ4Periodic(sampleQ4),
        // Missing QE
      ];

      expect(() => parsePeriodicStatement(lines)).toThrow(AbiFixedWidthError);
      expect(() => parsePeriodicStatement(lines)).toThrow(/missing mandatory QE fee totals record/i);
    });

    it("throws AbiFixedWidthError in default mode when QJ fee total record is missing from Q5/Q6 group", () => {
      const lines = [
        buildQ1Periodic(sampleQ1_1),
        buildQ2Periodic(sampleQ2_1),
        buildStatementFee(sampleQA_1),
        buildQ3Periodic(sampleQ3),
        buildQ4Periodic(sampleQ4),
        buildPreliminaryStatementFeeTotal(sampleQE),
        buildQ5Periodic(sampleQ5),
        buildQ6Periodic(sampleQ6),
        // Missing QJ
      ];

      expect(() => parsePeriodicStatement(lines)).toThrow(AbiFixedWidthError);
      expect(() => parsePeriodicStatement(lines)).toThrow(/missing mandatory QJ fee totals record/i);
    });

    it("permits missing fee records when allowMissingFees option is explicitly set to true", () => {
      const lines = [
        buildQ1Periodic(sampleQ1_1),
        buildQ2Periodic(sampleQ2_1),
        // Omitted QA
        buildQ3Periodic(sampleQ3),
        buildQ4Periodic(sampleQ4),
        // Omitted QE
      ];

      const result = parsePeriodicStatement(lines, { allowMissingFees: true });
      expect(result.details).toHaveLength(1);
      expect(result.details[0].fees).toHaveLength(0);
      expect(result.preliminaryOrFinalPayment).toBeDefined();
      expect(result.preliminaryOrFinalPayment?.feeTotals).toHaveLength(0);
    });
  });

  it("handles multiline raw string text input via parsePeriodicStatementText", () => {
    const rawText = [
      buildQ1Periodic(sampleQ1_1),
      buildQ2Periodic(sampleQ2_1),
      buildStatementFee(sampleQA_1),
      buildQ3Periodic(sampleQ3),
      buildQ4Periodic(sampleQ4),
      buildPreliminaryStatementFeeTotal(sampleQE),
    ].join("\n");

    const result = parsePeriodicStatementText(rawText);
    expect(result.details).toHaveLength(1);
    expect(result.preliminaryOrFinalPayment).toBeDefined();
    expect(result.preliminaryOrFinalPayment?.q3.periodicMonthlyStatementNumber).toBe("2726P08001");
  });

  it("captures unrecognized lines (such as batch block control records with Application Identifier MS)", () => {
    const headerLine = "B2704N01  MS082126                                                              ";
    const lines = [
      headerLine,
      buildQ1Periodic(sampleQ1_1),
      buildQ2Periodic(sampleQ2_1),
      buildStatementFee(sampleQA_1),
      buildQ3Periodic(sampleQ3),
      buildQ4Periodic(sampleQ4),
      buildPreliminaryStatementFeeTotal(sampleQE),
    ];

    const result = parsePeriodicStatement(lines);
    expect(result.details).toHaveLength(1);
    expect(result.unrecognizedLines).toHaveLength(1);
    expect(result.unrecognizedLines[0]).toBe(headerLine);
  });

  it("throws AbiFixedWidthError when Q2 is missing for a detail group", () => {
    const lines = [
      buildQ1Periodic(sampleQ1_1),
      // Missing Q2
      buildQ3Periodic(sampleQ3),
      buildQ4Periodic(sampleQ4),
    ];

    expect(() => parsePeriodicStatement(lines)).toThrow(AbiFixedWidthError);
  });

  it("throws AbiFixedWidthError when Q2 is encountered without preceding Q1", () => {
    const lines = [buildQ2Periodic(sampleQ2_1)];

    expect(() => parsePeriodicStatement(lines)).toThrow(AbiFixedWidthError);
  });

  it("throws AbiFixedWidthError when Q4 is encountered without preceding Q3", () => {
    const lines = [
      buildQ1Periodic(sampleQ1_1),
      buildQ2Periodic(sampleQ2_1),
      buildStatementFee(sampleQA_1),
      buildQ4Periodic(sampleQ4), // missing Q3
    ];

    expect(() => parsePeriodicStatement(lines)).toThrow(AbiFixedWidthError);
  });

  it("throws AbiFixedWidthError when Q6 is encountered without preceding Q5", () => {
    const lines = [
      buildQ1Periodic(sampleQ1_1),
      buildQ2Periodic(sampleQ2_1),
      buildStatementFee(sampleQA_1),
      buildQ3Periodic(sampleQ3),
      buildQ4Periodic(sampleQ4),
      buildPreliminaryStatementFeeTotal(sampleQE),
      buildQ6Periodic(sampleQ6), // missing Q5
    ];

    expect(() => parsePeriodicStatement(lines)).toThrow(AbiFixedWidthError);
  });
});
