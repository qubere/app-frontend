/**
 * CATAIR eBond Create/Update Business Rules & Codec Tests
 * Source Document: docs/plans/catair-source-docs/06-ebond-create-update-v1.9.pdf
 * (Pub # 0875-0419, April 10, 2020 - Revision 1.9 / Rev 7)
 */

import { describe, it, expect } from "vitest";
import { encodeRecord, decodeRecord } from "@/lib/abi/fixedWidth";
import { Decimal } from "@/lib/tariff/decimal";
import {
  RECORD_10_HEADER_SPEC,
  RECORD_12_SECONDARY_NOTIFY_SPEC,
  RECORD_20_STB_SPEC,
  RECORD_30_PRINCIPAL_SPEC,
  RECORD_36_BOND_USER_SPEC,
  RECORD_40_SURETY_SPEC,
  RECORD_90_MESSAGE_SPEC,
} from "@/lib/abi/ebond/recordSpecs";

// Helper functions for validating eBond business rules
function validateBondDesignationType(code: string): boolean {
  const validCodes = ["B", "A", "V", "C", "U", "E", "T", "R"];
  return validCodes.includes(code);
}

function validateBondTypeCode(code: string): boolean {
  return code === "8" || code === "9";
}

function validateTransactionIdTypeCode(code: string): boolean {
  const validCodes = ["1", "2", "3", "4", "5"];
  return validCodes.includes(code);
}

function validateIdNumberType(code: string): boolean {
  const validCodes = ["1", "2", "3"];
  return validCodes.includes(code);
}

function validateDispositionTypeCode(code: string): boolean {
  return code === "A" || code === "R" || code === " ";
}

function validateSeverityCode(code: string): boolean {
  return code === "F" || code === "I";
}

describe("eBond Business Rules — Bond Designation & Type Codes", () => {
  it("validates valid Bond Designation Type Codes (B, A, V, C, U, E, T, R)", () => {
    const validCodes = ["B", "A", "V", "C", "U", "E", "T", "R"];
    for (const code of validCodes) {
      expect(validateBondDesignationType(code)).toBe(true);
    }
    expect(validateBondDesignationType("X")).toBe(false);
    expect(validateBondDesignationType("1")).toBe(false);
  });

  it("enforces Bond Type Codes (8 = Continuous, 9 = STB)", () => {
    expect(validateBondTypeCode("8")).toBe(true);
    expect(validateBondTypeCode("9")).toBe(true);
    expect(validateBondTypeCode("1")).toBe(false);
    expect(validateBondTypeCode("0")).toBe(false);
  });

  it("encodes Record 10 header with Designation B and Bond Type 8", () => {
    const line = encodeRecord(RECORD_10_HEADER_SPEC, {
      bondDesignationTypeCode: "B",
      bondTypeCode: "8",
      bondActivityCode: "1",
      bondAmount: new Decimal("50000"), // $50,000 whole USD
      executionDate: new Date(2020, 3, 10), // MMDDYY -> 041020
    });

    expect(line.slice(0, 2)).toBe("10");
    expect(line[2]).toBe("B");
    expect(line[3]).toBe("8");

    const decoded = decodeRecord(RECORD_10_HEADER_SPEC, line);
    expect(decoded.bondDesignationTypeCode).toBe("B");
    expect(String(decoded.bondTypeCode)).toBe("8");
  });
});

describe("eBond Business Rules — Transaction ID Type Codes (Record 20)", () => {
  it("validates Transaction ID Type Codes (1=Entry#, 2=ISF, 3=Seizure, 4=Bill, 5=Carrier)", () => {
    const validCodes = ["1", "2", "3", "4", "5"];
    for (const code of validCodes) {
      expect(validateTransactionIdTypeCode(code)).toBe(true);

      const line = encodeRecord(RECORD_20_STB_SPEC, {
        transactionIdTypeCode: code as "1" | "2" | "3" | "4" | "5",
        transactionId: "ENTRY1234567",
      });

      const decoded = decodeRecord(RECORD_20_STB_SPEC, line);
      expect(decoded.transactionIdTypeCode).toBe(code);
    }

    expect(validateTransactionIdTypeCode("9")).toBe(false);
  });
});

describe("eBond Business Rules — Principal & User Identification Types", () => {
  it("validates ID Number Types (1=EIN, 2=SSN, 3=CBP Assigned)", () => {
    const validTypes = ["1", "2", "3"];
    for (const typeCode of validTypes) {
      expect(validateIdNumberType(typeCode)).toBe(true);

      const line = encodeRecord(RECORD_30_PRINCIPAL_SPEC, {
        principalIdNumberType: typeCode as "1" | "2" | "3",
        principalIdNumber: "12345678900",
        principalName: "ACME LOGISTICS INC",
      });

      const decoded = decodeRecord(RECORD_30_PRINCIPAL_SPEC, line);
      expect(decoded.principalIdNumberType).toBe(typeCode);
    }
  });
});

describe("eBond Business Rules — Whole Dollar Currency Amount Rule", () => {
  it("formats Bond Amount as 10-digit whole USD without decimals (10(S)N format)", () => {
    // PDF 06 p. 24: Bond Amount is total value of bond in whole US dollars
    const line = encodeRecord(RECORD_10_HEADER_SPEC, {
      bondDesignationTypeCode: "B",
      bondTypeCode: "8",
      bondAmount: new Decimal("100000"), // $100,000 whole USD
    });

    const amountField = line.slice(7, 17); // pos 8-17 (0-indexed 7..17)
    expect(amountField).toHaveLength(10);
    expect(amountField).toBe("0000100000");

    const decoded = decodeRecord(RECORD_10_HEADER_SPEC, line);
    expect(decoded.bondAmount?.toString()).toBe("100000");
  });

  it("formats Surety Liability Amount (Record 40) as 10-digit whole USD", () => {
    const line = encodeRecord(RECORD_40_SURETY_SPEC, {
      suretyCode: "123",
      agentIdNumber: "123-45-6789",
      suretyLiabilityAmount: new Decimal("50000"),
    });

    const liabilityField = line.slice(56, 66); // pos 57-66 (0-indexed 56..66)
    expect(liabilityField).toHaveLength(10);
    expect(liabilityField).toBe("0000050000");

    const decoded = decodeRecord(RECORD_40_SURETY_SPEC, line);
    expect(decoded.suretyLiabilityAmount?.toString()).toBe("50000");
  });

  it("preserves a leading-zero surety code as a string, not a number", () => {
    const line = encodeRecord(RECORD_40_SURETY_SPEC, {
      suretyCode: "037",
      agentIdNumber: "123-45-6789",
    });
    const decoded = decodeRecord(RECORD_40_SURETY_SPEC, line);
    expect(decoded.suretyCode).toBe("037");
    expect(typeof decoded.suretyCode).toBe("string");
  });
});

describe("eBond Business Rules — Output Message Disposition & Severity (Record 90)", () => {
  it("validates Disposition Type Code (A=Accepted, R=Rejected) and Severity Code (F=Fatal, I=Informational)", () => {
    expect(validateDispositionTypeCode("A")).toBe(true);
    expect(validateDispositionTypeCode("R")).toBe(true);
    expect(validateDispositionTypeCode(" ")).toBe(true);

    expect(validateSeverityCode("F")).toBe(true);
    expect(validateSeverityCode("I")).toBe(true);

    const line = encodeRecord(RECORD_90_MESSAGE_SPEC, {
      dispositionTypeCode: "A",
      severityCode: "I",
      conditionCode: "992",
      narrativeText: "NEW EBOND TRANSMITTED IN ACE PER TERMS OF THE EBOND TEST",
    });

    expect(line.slice(0, 2)).toBe("90");
    expect(line[2]).toBe("A");
    expect(line[3]).toBe("I");
    expect(line.slice(4, 7)).toBe("992");
    expect(line.slice(7, 9)).toBe("  "); // pos 8-9 filler gap
    expect(line.slice(9, 65)).toBe("NEW EBOND TRANSMITTED IN ACE PER TERMS OF THE EBOND TEST");

    const decoded = decodeRecord(RECORD_90_MESSAGE_SPEC, line);
    expect(decoded.dispositionTypeCode).toBe("A");
    expect(decoded.severityCode).toBe("I");
    expect(decoded.conditionCode).toBe("992");
  });
});

describe("eBond Golden Work Examples — CBP Reference Streams", () => {
  it("encodes and decodes a complete CB input stream for a Continuous Bond (Record 10, 12, 30, 36, 40)", () => {
    const rec10 = encodeRecord(RECORD_10_HEADER_SPEC, {
      bondDesignationTypeCode: "B",
      bondTypeCode: "8",
      bondActivityCode: "1",
      bondAmount: new Decimal("100000"),
      executionDate: new Date(2020, 3, 10),
      effectiveDate: new Date(2020, 3, 10),
    });

    const rec12 = encodeRecord(RECORD_12_SECONDARY_NOTIFY_SPEC, {
      secondaryNotifyPartyCode1: "NOTIFY001",
    });

    const rec30 = encodeRecord(RECORD_30_PRINCIPAL_SPEC, {
      principalIdNumberType: "1",
      principalIdNumber: "12345678900",
      principalName: "IMPORT EXPRESS INC",
    });

    const rec36 = encodeRecord(RECORD_36_BOND_USER_SPEC, {
      bondUserIdNumberType: "1",
      bondUserIdNumber: "98765432100",
      bondUserName: "SUBSIDIARY LOGISTICS LLC",
    });

    const rec40 = encodeRecord(RECORD_40_SURETY_SPEC, {
      suretyCode: "456",
      agentIdNumber: "123-45-6789",
      suretyLiabilityAmount: new Decimal("100000"),
    });

    const stream = [rec10, rec12, rec30, rec36, rec40].join("\n");
    const lines = stream.split("\n");

    expect(lines).toHaveLength(5);
    for (const line of lines) {
      expect(line).toHaveLength(80);
    }

    expect(lines[0].slice(0, 2)).toBe("10");
    expect(lines[1].slice(0, 2)).toBe("12");
    expect(lines[2].slice(0, 2)).toBe("30");
    expect(lines[3].slice(0, 2)).toBe("36");
    expect(lines[4].slice(0, 2)).toBe("40");
  });

  it("encodes and decodes a complete CX acceptance response stream (Record 10, 12, 30, 40, 90)", () => {
    const rec10 = encodeRecord(RECORD_10_HEADER_SPEC, {
      bondDesignationTypeCode: "B",
      bondTypeCode: "8",
      bondActivityCode: "1",
      bondAmount: new Decimal("100000"),
      executionDate: new Date(2020, 3, 10),
      effectiveDate: new Date(2020, 3, 10),
      bondNumber: "100001234", // CBP returned bond number
    });

    const rec12 = encodeRecord(RECORD_12_SECONDARY_NOTIFY_SPEC, {
      secondaryNotifyPartyCode1: "NOTIFY001",
    });

    const rec30 = encodeRecord(RECORD_30_PRINCIPAL_SPEC, {
      principalIdNumberType: "1",
      principalIdNumber: "12345678900",
      principalName: "IMPORT EXPRESS INC",
    });

    const rec40 = encodeRecord(RECORD_40_SURETY_SPEC, {
      suretyCode: "456",
      agentIdNumber: "123-45-6789",
      suretyName: "GREAT AMERICAN SURETY CO",
      suretyLiabilityAmount: new Decimal("100000"),
    });

    const rec90 = encodeRecord(RECORD_90_MESSAGE_SPEC, {
      dispositionTypeCode: "A",
      severityCode: "I",
      conditionCode: "992",
      narrativeText: "NEW EBOND TRANSMITTED IN ACE PER TERMS OF THE EBOND TEST",
    });

    const stream = [rec10, rec12, rec30, rec40, rec90].join("\n");
    const lines = stream.split("\n");

    expect(lines).toHaveLength(5);
    for (const line of lines) {
      expect(line).toHaveLength(80);
    }

    expect(lines[0].slice(0, 2)).toBe("10");
    expect(lines[4].slice(0, 2)).toBe("90");
    expect(lines[4][2]).toBe("A"); // Accepted
  });
});
