import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/tariff/decimal";
import {
  fromStatementRecord,
  validateStatementRecord,
  mapStatementFeeLines,
  AbiFilingValidationError,
  type StatementRecordWithLines,
} from "@/lib/abi/statement";

describe("fromStatementRecord DB integration", () => {
  const dailyRecord: StatementRecordWithLines = {
    id: "stmt-001",
    accountId: "acct-100",
    statementType: "daily",
    statementNumber: "350126001",
    districtPort: "3501",
    filerCode: "123",
    importerNumber: "12345678900",
    printDate: new Date("2026-06-01T00:00:00Z"),
    dueDate: new Date("2026-06-10T00:00:00Z"),
    entryType: "01",
    totalDuty: new Decimal(1500.5),
    totalTax: new Decimal(250.0),
    totalFee: new Decimal(31.42),
    totalAmount: new Decimal(1781.92),
    statementFeeLines: [
      { id: "sfl-1", accountingClassCode: "499", amount: new Decimal(31.42), sequence: 1 },
      { id: "sfl-2", accountingClassCode: "056", amount: new Decimal(10.0), sequence: 2 },
    ],
  };

  const periodicRecord: StatementRecordWithLines = {
    ...dailyRecord,
    id: "stmt-002",
    statementType: "periodic",
    statementNumber: "350126M01",
  };

  it("converts a daily StatementRecord to daily ABI statement input structures", () => {
    const result = fromStatementRecord(dailyRecord, { entryNumber: "12345678" });

    expect(result.isPeriodic).toBe(false);
    expect(result.q1Daily).toBeDefined();
    expect(result.q1Daily?.entryFilerCode).toBe("123");
    expect(result.q1Daily?.entryNumber).toBe("12345678");
    expect(result.q1Daily?.districtPortOfEntrySummary).toBe("3501");
    expect(result.q1Daily?.estimatedDutyAmount).toEqual(new Decimal(1500.5));

    expect(result.q3Daily).toBeDefined();
    expect(result.q3Daily?.dailyStatementNumber).toBe("350126001");

    expect(result.fees).toHaveLength(1);
    expect(result.fees[0].firstFeeClassCode).toBe("499");
    expect(result.fees[0].firstFeeAmount).toEqual(new Decimal(31.42));
    expect(result.fees[0].secondFeeClassCode).toBe("056");
  });

  it("converts a periodic StatementRecord to periodic ABI statement input structures", () => {
    const result = fromStatementRecord(periodicRecord);

    expect(result.isPeriodic).toBe(true);
    expect(result.q1Periodic).toBeDefined();
    expect(result.q1Periodic?.periodicDailyStatementFilerCode).toBe("123");
    expect(result.q3Periodic).toBeDefined();
    expect(result.q3Periodic?.periodicMonthlyStatementNumber).toBe("350126M01");
  });

  it("groups fee lines into 5 repeating pairs per StatementFeeInput", () => {
    const lines = Array.from({ length: 7 }, (_, i) => ({
      accountingClassCode: `00${i + 1}`,
      amount: new Decimal(10 + i),
      sequence: i + 1,
    }));

    const feeInputs = mapStatementFeeLines(lines);
    expect(feeInputs).toHaveLength(2);
    expect(feeInputs[0].sequenceNumber).toBe("01");
    expect(feeInputs[0].fifthFeeClassCode).toBe("005");
    expect(feeInputs[1].sequenceNumber).toBe("02");
    expect(feeInputs[1].firstFeeClassCode).toBe("006");
    expect(feeInputs[1].secondFeeClassCode).toBe("007");
  });

  it("throws AbiFilingValidationError if required fields are missing", () => {
    const invalidRecord: StatementRecordWithLines = {
      ...dailyRecord,
      statementNumber: "",
    };

    const validation = validateStatementRecord(invalidRecord, { entryNumber: "12345678" });
    expect(validation.valid).toBe(false);

    expect(() => fromStatementRecord(invalidRecord, { entryNumber: "12345678" })).toThrow(AbiFilingValidationError);
  });

  it("throws AbiFilingValidationError for a daily statement with no entryNumber, rather than substituting statementNumber", () => {
    expect(() => fromStatementRecord(dailyRecord)).toThrow(AbiFilingValidationError);
  });
});
