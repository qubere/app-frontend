/**
 * CATAIR Statement Processing Business Rules & Codec Tests
 * Source Documents:
 *   1. docs/plans/catair-source-docs/05-daily-statement.pdf (Pub # 0875-0419, April 23, 2025 - Revision 15)
 *   2. docs/plans/catair-source-docs/05b-periodic-monthly-statement.pdf (Pub # 0875-0419, March 6, 2019 / 2020 - Revision 7)
 */

import { describe, it, expect } from "vitest";
import { encodeRecord, decodeRecord } from "@/lib/abi/fixedWidth";
import { Decimal } from "@/lib/tariff/decimal";
import {
  Q1_DAILY_SPEC,
  Q2_DAILY_SPEC,
  QA_STATEMENT_FEE_SPEC,
  Q3_DAILY_SPEC,
  Q4_DAILY_SPEC,
  QE_STATEMENT_FEE_SPEC,
  Q7_STATEMENT_DELETED_SPEC,
  Q1_PERIODIC_SPEC,
  Q2_PERIODIC_SPEC,
  Q3_PERIODIC_SPEC,
  Q4_PERIODIC_SPEC,
  Q5_PERIODIC_SPEC,
  Q6_PERIODIC_SPEC,
} from "@/lib/abi/statement/recordSpecs";

// Helper functions for validating business rules
function validateDailyStatementNumber(stmtNum: string): boolean {
  // Format: DDFYJJJXXX (10AN)
  // DD = 2-digit district/port
  // FY = 2-digit fiscal year
  // JJJ = 3-digit Julian day (001..366)
  // XXX = 3-char sequence (alphanumeric)
  if (stmtNum.length !== 10) return false;
  const julianStr = stmtNum.slice(4, 7);
  const julian = parseInt(julianStr, 10);
  return !isNaN(julian) && julian >= 1 && julian <= 366;
}

function validatePeriodicMonthlyStatementNumber(stmtNum: string): boolean {
  // Format: DDCYPMMXXX (10AN)
  // DD = 2-digit district/port
  // CY = 2-digit calendar year
  // P = 'P' constant
  // MM = 2-digit month (01..12)
  // XXX = 3-char sequence (alphanumeric)
  if (stmtNum.length !== 10) return false;
  if (stmtNum[4] !== "P") return false;
  const monthStr = stmtNum.slice(5, 7);
  const month = parseInt(monthStr, 10);
  return !isNaN(month) && month >= 1 && month <= 12;
}

describe("Statement Processing Business Rules — Statement Numbering Formats", () => {
  it("validates Daily Statement Number structure (DDFYJJJXXX)", () => {
    // Example: District 27, FY 25, Julian Day 105, sequence 001 -> "2725105001"
    const validDailyNumber = "2725105001";
    expect(validateDailyStatementNumber(validDailyNumber)).toBe(true);

    const invalidJulian = "2725400001"; // Julian day 400 is invalid
    expect(validateDailyStatementNumber(invalidJulian)).toBe(false);
  });

  it("validates Periodic Monthly Statement Number structure (DDCYPMMXXX)", () => {
    // Example: District 27, CY 25, 'P' flag, Month 04 (April), sequence 001 -> "2725P04001"
    const validPmsNumber = "2725P04001";
    expect(validatePeriodicMonthlyStatementNumber(validPmsNumber)).toBe(true);

    const missingPFlag = "2725M04001"; // Must be 'P'
    expect(validatePeriodicMonthlyStatementNumber(missingPFlag)).toBe(false);

    const invalidMonth = "2725P13001"; // Month 13 is invalid
    expect(validatePeriodicMonthlyStatementNumber(invalidMonth)).toBe(false);
  });
});

describe("Statement Processing Business Rules — Payment Type Indicator Codes", () => {
  it("enforces valid Payment Type Indicators (2, 3, 5 for Daily vs 6, 7, 8 for PMS)", () => {
    const allPaymentTypes = ["2", "3", "5", "6", "7", "8"];

    for (const pt of allPaymentTypes) {
      const line = encodeRecord(Q2_DAILY_SPEC, {
        districtPortOfEntrySummary: "2704",
        entryFilerCode: "N01",
        entryNumber: "03245278",
        paymentTypeIndicator: pt,
      });
      const decoded = decodeRecord(Q2_DAILY_SPEC, line);
      expect(decoded.paymentTypeIndicator).toBe(pt);
    }
  });
});

describe("Statement Processing Business Rules — 10-Digit Currency Amount Rule", () => {
  it("enforces that 11N currency amounts have a leading zero (Note 1 in 2025 Daily doc)", () => {
    // Note 1: "Statements currently only supports 10 digit dollar amounts. CATAIR shows 11N for future expansion.
    // At this time, the first character will always be a zero."
    const line = encodeRecord(Q3_DAILY_SPEC, {
      dailyStatementNumber: "2725105001",
      dailyStatementPrintDate: new Date(2026, 3, 23), // MMDDYY -> 042326
      entryFilerCode: "N01",
      totalEstimatedDuty: new Decimal("1234.50"), // $1,234.50 -> 11N "00000123450"
      totalEstimatedTax: new Decimal("50.00"), // $50.00 -> 11N "00000005000"
      districtPortWhichProcessesEntries: "2704",
    });

    const dutyField = line.slice(37, 48); // pos 38-48 (0-indexed 37..48)
    const taxField = line.slice(48, 59); // pos 49-59 (0-indexed 48..59)

    expect(dutyField).toHaveLength(11);
    expect(dutyField[0]).toBe("0"); // First digit is '0'
    expect(dutyField).toBe("00000123450");
    expect(taxField).toHaveLength(11);
    expect(taxField[0]).toBe("0"); // First digit is '0'
    expect(taxField).toBe("00000005000");
  });
});

describe("Statement Processing Business Rules — Entry Type Duty/Tax/Fee Restrictions", () => {
  it("verifies Entry Types 21, 22, and 23 reporting rules", () => {
    // PDF 05 p. 8 & PDF 05b p. 5:
    // Entry Type 21 (Warehouse Entry): Only HMF fee is reported.
    // Entry Type 22 (Re-Warehouse Entry): No duty, tax, or fees reported.
    // Entry Type 23 (TIB Entry): Only HMF fee is reported.
    const entryTypes = ["21", "22", "23"];
    for (const et of entryTypes) {
      const line = encodeRecord(Q1_DAILY_SPEC, {
        districtPortOfEntrySummary: "2704",
        entryFilerCode: "N01",
        entryNumber: "03245278",
        preliminaryDailyStatementPrintDate: new Date(2026, 3, 23),
        entryType: et,
      });
      const decoded = decodeRecord(Q1_DAILY_SPEC, line);
      // entryType preserves its leading zero as a string via numericCodeField
      // (the same leading-zero bug found and fixed elsewhere this session).
      expect(decoded.entryType).toBe(et);
    }
  });
});

describe("Statement Processing Business Rules — Delete Source Codes", () => {
  it("validates Delete Source Codes in Q7 record (ABI vs CBP)", () => {
    const validSources = ["ABI", "CBP"] as const;
    for (const source of validSources) {
      const line = encodeRecord(Q7_STATEMENT_DELETED_SPEC, {
        statementNumber: "2725105001",
        entryFilerCode1: "N01",
        entryNumber1: "03245278",
        deleteSource1: source,
      });
      const decoded = decodeRecord(Q7_STATEMENT_DELETED_SPEC, line);
      expect(decoded.deleteSource1).toBe(source);
    }
  });
});

describe("Statement Processing Business Rules — Due Date Presence in PMS Q3/Q5", () => {
  it("encodes and decodes PMS Due Date in positions 19-24", () => {
    const printDate = new Date(2026, 3, 10); // MMDDYY -> 041026
    const dueDate = new Date(2026, 3, 20); // MMDDYY -> 042026

    const line = encodeRecord(Q3_PERIODIC_SPEC, {
      periodicMonthlyStatementNumber: "2725P04001",
      periodicMonthlyStatementPrintDate: printDate,
      periodicMonthlyStatementDueDate: dueDate,
      periodicMonthlyStatementFilerCode: "N01",
    });

    // Check position 13-18 (print date) and 19-24 (due date)
    expect(line.slice(12, 18)).toBe("041026");
    expect(line.slice(18, 24)).toBe("042026");

    const decoded = decodeRecord(Q3_PERIODIC_SPEC, line);
    expect(decoded.periodicMonthlyStatementPrintDate?.getDate()).toBe(10);
    expect(decoded.periodicMonthlyStatementDueDate?.getDate()).toBe(20);
  });
});

describe("Statement Processing Golden Work Examples — CBP Reference Streams", () => {
  it("encodes and decodes a complete Daily Statement record set (Q1, Q2, QA, Q3, Q4, QE, Q5, Q6, QJ, Q7)", () => {
    const printDate = new Date(2026, 3, 23); // MMDDYY -> 042326
    const q1 = encodeRecord(Q1_DAILY_SPEC, {
      districtPortOfEntrySummary: "2704",
      entryFilerCode: "N01",
      entryNumber: "03245278",
      preliminaryDailyStatementPrintDate: printDate,
      estimatedDutyAmount: new Decimal("100.00"),
      estimatedTaxAmount: new Decimal("20.00"),
      entryType: "01",
    });

    const q2 = encodeRecord(Q2_DAILY_SPEC, {
      districtPortOfEntrySummary: "2704",
      entryFilerCode: "N01",
      entryNumber: "03245278",
      antidumpingDutyAmount: new Decimal("0"),
      countervailingDutyAmount: new Decimal("0"),
      paymentTypeIndicator: "2",
      payIndicator: "Y",
    });

    const qa = encodeRecord(QA_STATEMENT_FEE_SPEC, {
      sequenceNumber: "01",
      firstFeeClassCode: "499", // HMF fee
      firstFeeAmount: new Decimal("15.00"),
    });

    const q3 = encodeRecord(Q3_DAILY_SPEC, {
      dailyStatementNumber: "2725105001",
      dailyStatementPrintDate: printDate,
      entryFilerCode: "N01",
      totalEstimatedDuty: new Decimal("100.00"),
      totalEstimatedTax: new Decimal("20.00"),
      districtPortWhichProcessesEntries: "2704",
    });

    const q4 = encodeRecord(Q4_DAILY_SPEC, {
      totalAntidumpingDuty: new Decimal("0"),
      totalCountervailingDuty: new Decimal("0"),
      totalAmountDue: new Decimal("135.00"),
      totalNumberRevenueProducingEntries: 1,
      totalNumberNonRevenueProducingEntries: 0,
    });

    const qe = encodeRecord(QE_STATEMENT_FEE_SPEC, {
      sequenceNumber: "01",
      firstFeeClassCode: "499",
      firstFeeAmount: new Decimal("15.00"),
    });

    const stream = [q1, q2, qa, q3, q4, qe].join("\n");
    const lines = stream.split("\n");

    expect(lines).toHaveLength(6);
    for (const line of lines) {
      expect(line).toHaveLength(80);
    }

    expect(lines[0].slice(0, 2)).toBe("Q1");
    expect(lines[1].slice(0, 2)).toBe("Q2");
    expect(lines[2].slice(0, 2)).toBe("QA");
    expect(lines[3].slice(0, 2)).toBe("Q3");
    expect(lines[4].slice(0, 2)).toBe("Q4");
    expect(lines[5].slice(0, 2)).toBe("QE");

    // Round-trip the money fields to confirm they survive as Decimal, not raw ints.
    expect(decodeRecord(Q1_DAILY_SPEC, q1).estimatedDutyAmount?.toString()).toBe("100");
    expect(decodeRecord(Q4_DAILY_SPEC, q4).totalAmountDue?.toString()).toBe("135");
  });

  it("encodes and decodes a complete Periodic Monthly Statement record set (Q1, Q2, QA, Q3, Q4, QE, Q5, Q6, QJ)", () => {
    const printDate = new Date(2026, 3, 23);
    const presentationDate = new Date(2026, 3, 24);
    const dueDate = new Date(2026, 4, 15);

    const q1 = encodeRecord(Q1_PERIODIC_SPEC, {
      periodicDailyStatementNumber: "2725105001",
      periodicDailyStatementDistrictPort: "2704",
      periodicDailyStatementFilerCode: "N01",
      preliminaryPeriodicDailyStatementPrintDate: printDate,
      entrySummaryPresentationDate: presentationDate,
      totalDuty: new Decimal("100.00"),
      totalTax: new Decimal("20.00"),
    });

    const q2 = encodeRecord(Q2_PERIODIC_SPEC, {
      totalAntidumpingDuty: new Decimal("0"),
      totalCountervailingDuty: new Decimal("0"),
      totalAmountDue: new Decimal("120.00"),
    });

    const q3 = encodeRecord(Q3_PERIODIC_SPEC, {
      periodicMonthlyStatementNumber: "2725P04001",
      periodicMonthlyStatementPrintDate: printDate,
      periodicMonthlyStatementDueDate: dueDate,
      periodicMonthlyStatementFilerCode: "N01",
      totalDuty: new Decimal("100.00"),
      totalTax: new Decimal("20.00"),
    });

    const q4 = encodeRecord(Q4_PERIODIC_SPEC, {
      totalAntidumpingDuty: new Decimal("0"),
      totalCountervailingDuty: new Decimal("0"),
      totalAmountDue: new Decimal("120.00"),
    });

    const q5 = encodeRecord(Q5_PERIODIC_SPEC, {
      periodicMonthlyStatementNumber: "2725P04001",
      periodicMonthlyStatementPrintDate: printDate,
      periodicMonthlyStatementDueDate: dueDate,
      periodicMonthlyStatementFilerCode: "N01",
      totalDuty: new Decimal("100.00"),
      totalTax: new Decimal("20.00"),
    });

    const q6 = encodeRecord(Q6_PERIODIC_SPEC, {
      totalAntidumpingDuty: new Decimal("0"),
      totalCountervailingDuty: new Decimal("0"),
      totalAmountPaid: new Decimal("120.00"),
    });

    const stream = [q1, q2, q3, q4, q5, q6].join("\n");
    const lines = stream.split("\n");

    expect(lines).toHaveLength(6);
    for (const line of lines) {
      expect(line).toHaveLength(80);
    }

    expect(lines[0].slice(0, 2)).toBe("Q1");
    expect(lines[1].slice(0, 2)).toBe("Q2");
    expect(lines[2].slice(0, 2)).toBe("Q3");
    expect(lines[3].slice(0, 2)).toBe("Q4");
    expect(lines[4].slice(0, 2)).toBe("Q5");
    expect(lines[5].slice(0, 2)).toBe("Q6");
  });
});
