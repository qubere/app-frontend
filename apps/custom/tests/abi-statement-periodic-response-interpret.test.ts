import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/tariff/decimal";
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
import { parsePeriodicStatement } from "@/lib/abi/statement/parsePeriodicStatement";
import { interpretPeriodicStatement } from "@/lib/abi/statement/interpretPeriodicStatement";
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

describe("Periodic Statement Response DB Integration (interpretPeriodicStatement)", () => {
  const sampleQ1_1: Q1PeriodicInput = {
    periodicDailyStatementNumber: "2726234001",
    periodicDailyStatementDistrictPort: "2704",
    periodicDailyStatementFilerCode: "N01",
    periodicDailyStatementImporterNumber: "12-3456789XX",
    preliminaryPeriodicDailyStatementPrintDate: new Date(2026, 7, 15),
    entrySummaryPresentationDate: new Date(2026, 7, 20),
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

  it("interprets preliminary periodic monthly statement with daily statement detail groups mapped via filingIdMap", () => {
    const rawLines = [
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

    const parsed = parsePeriodicStatement(rawLines);

    const filingIdMap = {
      "N01-2726234001": "filing-pms-1",
      "N01-2726234002": "filing-pms-2",
    };

    const interpreted = interpretPeriodicStatement(parsed, {
      accountId: "acc-456",
      filingIdMap,
    });

    // 1. CustomsResponseRecordData[]
    const records = interpreted.customsResponseRecords;
    expect(records).toHaveLength(2);

    expect(records[0]).toEqual({
      accountId: "acc-456",
      filingId: "filing-pms-1",
      code: "Q1",
      title: "Periodic Daily Statement Group N01-2726234001",
      description: expect.stringContaining("Duty: $4500, Tax: $250.75, ADD: $300, CVD: $150.5, Amount Due: $5201.25, Fees: $43.42"),
      status: "PRELIMINARY",
    });

    expect(records[1]).toEqual({
      accountId: "acc-456",
      filingId: "filing-pms-2",
      code: "Q1",
      title: "Periodic Daily Statement Group N01-2726234002",
      description: expect.stringContaining("Duty: $1200, Tax: $0, ADD: $0.00, CVD: $0.00, Amount Due: $1200, Fees: $31.42"),
      status: "PRELIMINARY",
    });

    // 2. Structured statement summary
    const summary = interpreted.summary;
    expect(summary.statementNumber).toBe("2726P08001");
    expect(summary.filerCode).toBe("N01");
    expect(summary.totalDetailsCount).toBe(2);
    expect(summary.deletedEntriesCount).toBe(0);

    expect(summary.preliminaryPayment).toBeDefined();
    expect(summary.preliminaryPayment?.totalDuty).toBe("5700");
    expect(summary.preliminaryPayment?.totalTax).toBe("250.75");
    expect(summary.preliminaryPayment?.totalAmount).toBe("6401.25");
    expect(summary.preliminaryPayment?.feeTotals).toHaveLength(2);
    expect(summary.finalPayment).toBeUndefined();
  });

  it("interprets final periodic monthly statement with paid totals (Q5/Q6/QJ)", () => {
    const rawLines = [
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

    const parsed = parsePeriodicStatement(rawLines);

    const interpreted = interpretPeriodicStatement(parsed, {
      accountId: "acc-456",
      filingIdMap: { "N01-2726234001": "filing-pms-1" },
    });

    expect(interpreted.summary.preliminaryPayment).toBeDefined();
    expect(interpreted.summary.finalPayment).toBeDefined();
    expect(interpreted.summary.finalPayment?.periodicMonthlyStatementNumber).toBe("2726P08001");
    expect(interpreted.summary.finalPayment?.totalAmount).toBe("6401.25");
    expect(interpreted.summary.finalPayment?.feeTotals).toHaveLength(2);

    expect(interpreted.customsResponseRecords[0].status).toBe("FINAL");
  });

  it("correctly attributes Q7 deleted entries to individual filingIds in periodic monthly statement", () => {
    const rawLines = [
      buildQ1Periodic(sampleQ1_1),
      buildQ2Periodic(sampleQ2_1),
      buildStatementFee(sampleQA_1),
      buildQ3Periodic(sampleQ3),
      buildQ4Periodic(sampleQ4),
      buildPreliminaryStatementFeeTotal(sampleQE),
      buildQ7Deleted(sampleQ7),
    ];

    const parsed = parsePeriodicStatement(rawLines);

    const filingIdMap = {
      "N01-2726234001": "filing-active",
      "N01-03245200": "filing-del-1",
      "N01-03245201": "filing-del-2",
    };

    const interpreted = interpretPeriodicStatement(parsed, {
      accountId: "acc-456",
      filingIdMap,
    });

    expect(interpreted.summary.deletedEntriesCount).toBe(2);

    const records = interpreted.customsResponseRecords;
    expect(records).toHaveLength(3);

    expect(records[0].filingId).toBe("filing-active");

    expect(records[1]).toEqual({
      accountId: "acc-456",
      filingId: "filing-del-1",
      code: "Q7",
      title: "Statement Deleted Entry Summary N01-03245200",
      description: "Entry summary N01-03245200 deleted from statement 2726P08001 via ABI action.",
      status: "DELETED",
    });

    expect(records[2]).toEqual({
      accountId: "acc-456",
      filingId: "filing-del-2",
      code: "Q7",
      title: "Statement Deleted Entry Summary N01-03245201",
      description: "Entry summary N01-03245201 deleted from statement 2726P08001 via CBP action.",
      status: "DELETED",
    });
  });

  it("falls back to defaultFilingId when missing from filingIdMap", () => {
    const rawLines = [
      buildQ1Periodic(sampleQ1_1),
      buildQ2Periodic(sampleQ2_1),
      buildStatementFee(sampleQA_1),
      buildQ3Periodic(sampleQ3),
      buildQ4Periodic(sampleQ4),
      buildPreliminaryStatementFeeTotal(sampleQE),
    ];

    const parsed = parsePeriodicStatement(rawLines);

    const interpreted = interpretPeriodicStatement(parsed, {
      defaultFilingId: "pms-fallback-filing-id",
    });

    expect(interpreted.customsResponseRecords[0].filingId).toBe("pms-fallback-filing-id");
  });
});
