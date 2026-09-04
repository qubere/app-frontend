import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/tariff/decimal";
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
import { parseDailyStatement } from "@/lib/abi/statement/parseDailyStatement";
import {
  interpretDailyStatement,
  extractStatementFees,
  sumStatementFeeAmounts,
} from "@/lib/abi/statement/interpretDailyStatement";
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

describe("Daily Statement Response DB Integration (interpretDailyStatement)", () => {
  const sampleQ1_1: Q1DailyInput = {
    districtPortOfEntrySummary: "2704",
    entryFilerCode: "N01",
    entryNumber: "03245278",
    importerOfRecordNumber: "12-3456789XX",
    preliminaryDailyStatementPrintDate: new Date(2026, 7, 22),
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
    totalAmountDue: new Decimal("2019.17"),
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
    totalAmountPaid: new Decimal("2019.17"),
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

  it("interprets preliminary daily statement with multiple detail entries mapping to different filingIds", () => {
    const rawLines = [
      buildQ1Daily(sampleQ1_1),
      buildQ2Daily(sampleQ2_1),
      buildStatementFee(sampleQA_1),
      buildQ1Daily(sampleQ1_2),
      buildQ2Daily(sampleQ2_2),
      buildQ3Daily(sampleQ3),
      buildQ4Daily(sampleQ4),
      buildPreliminaryStatementFeeTotal(sampleQE),
    ];

    const parsed = parseDailyStatement(rawLines);

    const filingIdMap = {
      "N01-03245278": "filing-id-7501-1",
      "N01-03245279": "filing-id-7501-2",
    };

    const interpreted = interpretDailyStatement(parsed, {
      accountId: "acc-123",
      filingIdMap,
    });

    // 1. Check CustomsResponseRecordData[] output
    const records = interpreted.customsResponseRecords;
    expect(records).toHaveLength(2);

    expect(records[0]).toEqual({
      accountId: "acc-123",
      filingId: "filing-id-7501-1",
      code: "01",
      title: "Daily Statement Entry N01-03245278",
      description: expect.stringContaining("Duty: $1250.5, Tax: $75, ADD: $100, CVD: $50.25, Fees: $43.42"),
      status: "PRELIMINARY",
    });

    expect(records[1]).toEqual({
      accountId: "acc-123",
      filingId: "filing-id-7501-2",
      code: "01",
      title: "Daily Statement Entry N01-03245279",
      description: expect.stringContaining("Duty: $500, Tax: $0, ADD: $0.00, CVD: $0.00, Fees: $0"),
      status: "PRELIMINARY",
    });

    // 2. Check structured summary output
    const summary = interpreted.summary;
    expect(summary.statementNumber).toBe("2726234001");
    expect(summary.entryFilerCode).toBe("N01");
    expect(summary.totalEntriesCount).toBe(2);
    expect(summary.deletedEntriesCount).toBe(0);

    expect(summary.preliminaryPayment).toBeDefined();
    expect(summary.preliminaryPayment?.totalEstimatedDuty).toBe("1750.5");
    expect(summary.preliminaryPayment?.totalAmount).toBe("2019.17");
    expect(summary.preliminaryPayment?.feeTotals).toEqual([
      { classCode: "056", amount: "31.42" },
      { classCode: "499", amount: "12" },
    ]);
    expect(summary.finalPayment).toBeUndefined();
  });

  it("interprets final daily statement with paid totals (Q5/Q6/QJ)", () => {
    const rawLines = [
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

    const parsed = parseDailyStatement(rawLines);

    const interpreted = interpretDailyStatement(parsed, {
      accountId: "acc-123",
      filingIdMap: { "N01-03245278": "filing-1" },
    });

    expect(interpreted.summary.preliminaryPayment).toBeDefined();
    expect(interpreted.summary.finalPayment).toBeDefined();
    expect(interpreted.summary.finalPayment?.statementNumber).toBe("2726234001");
    expect(interpreted.summary.finalPayment?.totalAmount).toBe("2019.17");
    expect(interpreted.summary.finalPayment?.feeTotals).toHaveLength(2);

    expect(interpreted.customsResponseRecords[0].status).toBe("FINAL");
  });

  it("correctly attributes Q7 deleted entry summaries to individual filingIds", () => {
    const rawLines = [
      buildQ1Daily(sampleQ1_1),
      buildQ2Daily(sampleQ2_1),
      buildStatementFee(sampleQA_1),
      buildQ3Daily(sampleQ3),
      buildQ4Daily(sampleQ4),
      buildPreliminaryStatementFeeTotal(sampleQE),
      buildQ7Deleted(sampleQ7),
    ];

    const parsed = parseDailyStatement(rawLines);

    const filingIdMap = {
      "N01-03245278": "filing-active",
      "N01-03245200": "filing-del-1",
      "N01-03245201": "filing-del-2",
    };

    const interpreted = interpretDailyStatement(parsed, {
      accountId: "acc-123",
      filingIdMap,
    });

    expect(interpreted.summary.deletedEntriesCount).toBe(2);

    const records = interpreted.customsResponseRecords;
    expect(records).toHaveLength(3); // 1 detail entry + 2 deleted entries

    // Active detail entry
    expect(records[0].filingId).toBe("filing-active");

    // Deletion 1
    expect(records[1]).toEqual({
      accountId: "acc-123",
      filingId: "filing-del-1",
      code: "Q7",
      title: "Statement Deleted Entry Summary N01-03245200",
      description: "Entry summary N01-03245200 deleted from statement 2726234001 via ABI action.",
      status: "DELETED",
    });

    // Deletion 2
    expect(records[2]).toEqual({
      accountId: "acc-123",
      filingId: "filing-del-2",
      code: "Q7",
      title: "Statement Deleted Entry Summary N01-03245201",
      description: "Entry summary N01-03245201 deleted from statement 2726234001 via CBP action.",
      status: "DELETED",
    });
  });

  it("falls back to defaultFilingId when entry is missing from filingIdMap", () => {
    const rawLines = [
      buildQ1Daily(sampleQ1_1),
      buildQ2Daily(sampleQ2_1),
      buildStatementFee(sampleQA_1),
      buildQ3Daily(sampleQ3),
      buildQ4Daily(sampleQ4),
      buildPreliminaryStatementFeeTotal(sampleQE),
    ];

    const parsed = parseDailyStatement(rawLines);

    const interpreted = interpretDailyStatement(parsed, {
      defaultFilingId: "fallback-filing-id",
    });

    expect(interpreted.customsResponseRecords[0].filingId).toBe("fallback-filing-id");
  });

  it("correctly extracts and sums fees using extractStatementFees & sumStatementFeeAmounts", () => {
    const fees: StatementFeeInput[] = [
      {
        sequenceNumber: "01",
        firstFeeClassCode: "056",
        firstFeeAmount: new Decimal("31.42"),
        secondFeeClassCode: "499",
        secondFeeAmount: new Decimal("12.00"),
      },
      {
        sequenceNumber: "02",
        firstFeeClassCode: "017",
        firstFeeAmount: new Decimal("5.50"),
      },
    ];

    const extracted = extractStatementFees(fees);
    expect(extracted).toEqual([
      { classCode: "056", amount: "31.42" },
      { classCode: "499", amount: "12" },
      { classCode: "017", amount: "5.5" },
    ]);

    const total = sumStatementFeeAmounts(fees);
    expect(total).toEqual(new Decimal("48.92"));
  });
});
