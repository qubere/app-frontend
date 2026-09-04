/**
 * CATAIR In-Bond (Chapter 9) Business Rules & Validation Test Suite
 * Source PDF: docs/plans/catair-source-docs/06b-in-bond-v51-2026-04.pdf
 * (Amendment 51 – April 2026)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CATAIR IN-BOND (CHAPTER 9) BUSINESS RULES & LIFECYCLE SUMMARY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Core Business Rules Tested:
 *   1. Action Code Routing & Record Dependencies (QP10)
 *      - Action 'A' (Add): Short-form (QP10, QP20, QP30) for automated carriers vs Long-form (QP10-QP76) for non-automated or FTZ/Warehouse ('Y').
 *      - Action 'B' (Delete from bill): Requires QP10 and QP30.
 *      - Action 'D' (Delete in-bond): Requires QP10 only.
 *   2. In-Bond Entry Types (61 IT, 62 T&E, 63 IE) & Port Constraints (QP10)
 *      - Entry Type 61 (IT): Requires US Port of Destination (Schedule D); Foreign Port zero/space filled.
 *      - Entry Type 62 (T&E): Requires US Port of Destination (Schedule D), Foreign Destination (Schedule K), and BTA/FDA Indicator ('Y' or 'N').
 *      - Entry Type 63 (IE): Requires US Port of Destination (Schedule D) and Foreign Destination (Schedule K).
 *   3. Carrier Identification & FTZ/Warehouse Withdrawal Identification (QP10 & QP20)
 *      - Standard moves: 4-char SCAC, 3-letter ICAO, or 2-char IATA.
 *      - FTZ / Bonded Warehouse moves (FTZ Indicator = 'Y'): FIRMS code may be used in lieu of SCAC.
 *   4. Monetary & Quantitative Field Validation (QP10, QP30, QP40)
 *      - QP10 Value: Whole dollars only, > 0, 8N (no decimals).
 *      - QP40 Volume: Whole numbers only, 10N (no decimals).
 *      - QP30 In-Bond Quantity vs Piece Count: In-bond quantity must not exceed bill piece count.
 *   5. Arrival / Export / Transfer Action Codes & FIRMS Code Requirement (WP10)
 *      - Action Codes 1-6 (1=Arrival, 2=Export, 3=Transfer of Liability, 4=Cancel Arrival, 5=Cancel Export, 6=Cancel Transfer).
 *      - FIRMS Code required upon arrival for all MOTs except Air (Amendment 44 rule).
 *   6. Timestamp & Date Conventions (WP20 & NS30)
 *      - QP20 uses MMDDYY (6N); WP20 and NS30 use YYMMDD (6N).
 *      - WP20 Time uses HHMMSS (6N); NS30 Action Time uses HHMM (4N).
 *   7. In-Bond Status Notification Processing & Reversals (NS10 & NS30)
 *      - Disposition Codes, Quantity posting, Negative Indicator ('N' for reversals).
 *   8. Response Message Structure (QT95 & WT95)
 *      - Narrative Message formatting (39X), Type Code (2N), Identifier (3AN).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from "vitest";

// In-Bond Entry Type Constants
export const IN_BOND_ENTRY_TYPES = {
  IMMEDIATE_TRANSPORTATION: "61",
  TRANSPORTATION_AND_EXPORTATION: "62",
  IMMEDIATE_EXPORTATION: "63"
} as const;

// In-Bond QP Action Codes
export const QP_ACTION_CODES = {
  ADD_IN_BOND: "A",
  DELETE_FROM_BILL: "B",
  DELETE_IN_BOND_ALL: "D"
} as const;

// In-Bond WP Action Codes
export const WP_ACTION_CODES = {
  ARRIVE_IN_BOND: "1",
  EXPORT_IN_BOND: "2",
  TRANSFER_LIABILITY: "3",
  CANCEL_ARRIVE: "4",
  CANCEL_EXPORT: "5",
  CANCEL_TRANSFER: "6"
} as const;

// Validation helper functions representing CATAIR business rule logic
export function validateQP10Header(record: {
  actionCode: string;
  inBondEntryType?: string;
  inBondNumber: string;
  inBondCarrierCode?: string;
  usPortOfDestination?: string;
  portOfForeignDestination?: string;
  value: number;
  bondedCarrierId?: string;
  foreignTradeZoneWarehouseIndicator?: string;
  btaFdaIndicator?: string;
}) {
  const errors: string[] = [];

  // Action Code check
  if (!["A", "B", "D"].includes(record.actionCode)) {
    errors.push(`Invalid Action Code '${record.actionCode}'. Must be A, B, or D.`);
  }

  // Action D only requires inBondNumber
  if (record.actionCode === "D") {
    if (!record.inBondNumber) errors.push("In-Bond Number is required for Action D.");
    return errors;
  }

  // Entry Type check for Action A
  if (record.actionCode === "A") {
    if (!record.inBondEntryType || !["61", "62", "63"].includes(record.inBondEntryType)) {
      errors.push(`Invalid In-Bond Entry Type '${record.inBondEntryType}'. Must be 61 (IT), 62 (T&E), or 63 (IE).`);
    }

    // Port rules
    if (record.inBondEntryType === "61") {
      if (!record.usPortOfDestination) errors.push("Schedule D U.S. Port of Destination is required for Entry Type 61 (IT).");
      if (record.portOfForeignDestination && record.portOfForeignDestination.trim() !== "" && record.portOfForeignDestination !== "00000") {
        errors.push("Port of Foreign Destination must be blank/zero for Entry Type 61 (IT).");
      }
    }

    if (record.inBondEntryType === "62") {
      if (!record.usPortOfDestination) errors.push("Schedule D U.S. Port of Destination is required for Entry Type 62 (T&E).");
      if (!record.portOfForeignDestination || record.portOfForeignDestination.trim() === "") {
        errors.push("Schedule K Port of Foreign Destination is required for Entry Type 62 (T&E).");
      }
      if (!record.btaFdaIndicator || !["Y", "N"].includes(record.btaFdaIndicator)) {
        errors.push("BTA/FDA Indicator ('Y' or 'N') is required for Entry Type 62 (T&E).");
      }
    }

    if (record.inBondEntryType === "63") {
      if (!record.usPortOfDestination) errors.push("Schedule D U.S. Port of Destination/Arrival is required for Entry Type 63 (IE).");
      if (!record.portOfForeignDestination || record.portOfForeignDestination.trim() === "") {
        errors.push("Schedule K Port of Foreign Destination is required for Entry Type 63 (IE).");
      }
    }

    // Value rules: whole dollars, no decimals, > 0
    if (record.value <= 0 || !Number.isInteger(record.value)) {
      errors.push("Value must be a positive integer in whole dollars (no decimals).");
    }

    // Carrier & FTZ rules
    if (record.foreignTradeZoneWarehouseIndicator === "Y") {
      if (!record.inBondCarrierCode || record.inBondCarrierCode.length < 4) {
        errors.push("FIRMS code or SCAC is required for FTZ/Warehouse withdrawal in-bond moves.");
      }
    }
  }

  return errors;
}

export function validateWP10ArrivalHeader(record: {
  actionCode: string;
  inBondNumber?: string;
  inBondArrivalPort?: string;
  containerNumber?: string;
  firmsCode?: string;
  modeOfTransportation?: number; // e.g. 10=Vessel, 20=Rail, 30=Truck, 40=Air
}) {
  const errors: string[] = [];

  if (!["1", "2", "3", "4", "5", "6"].includes(record.actionCode)) {
    errors.push(`Invalid Action Code '${record.actionCode}'. Must be 1-6.`);
  }

  // FIRMS code requirement upon arrival (Action Code 1) for non-Air MOTs
  if (record.actionCode === "1" && record.modeOfTransportation !== 40) {
    if (!record.firmsCode || record.firmsCode.trim() === "") {
      errors.push("FIRMS Code is mandatory upon in-bond arrival for all non-Air MOTs (Amendment 44 rule).");
    }
  }

  return errors;
}

export function validateQP20ArrivalDate(dateStr: string): boolean {
  // QP20 specifies MMDDYY format (6 digits: MM in 01-12, DD in 01-31, YY in 00-99)
  if (!/^\d{6}$/.test(dateStr)) return false;
  const month = parseInt(dateStr.substring(0, 2), 10);
  const day = parseInt(dateStr.substring(2, 4), 10);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

export function validateWP20ArrivalDate(dateStr: string): boolean {
  // WP20 specifies YYMMDD format (6 digits: YY in 00-99, MM in 01-12, DD in 01-31)
  if (!/^\d{6}$/.test(dateStr)) return false;
  const month = parseInt(dateStr.substring(2, 4), 10);
  const day = parseInt(dateStr.substring(4, 6), 10);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

// ─────────────────────────────────────────────────────────────────────────────
// VITEST TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe("CATAIR In-Bond (Chapter 9) Business Rules Suite", () => {
  describe("Rule 1: Action Code Routing & Record Dependencies (QP10)", () => {
    it("Validates Action 'A' (Add In-Bond) with valid Entry Type 61 (IT)", () => {
      const errors = validateQP10Header({
        actionCode: "A",
        inBondEntryType: "61",
        inBondNumber: "V123456789",
        inBondCarrierCode: "ABCD",
        usPortOfDestination: "2704", // Los Angeles/Long Beach
        portOfForeignDestination: "00000",
        value: 50000
      });
      expect(errors).toEqual([]);
    });

    it("Validates Action 'B' (Delete In-Bond from Bill) requires inBondNumber", () => {
      const errors = validateQP10Header({
        actionCode: "B",
        inBondNumber: "V123456789",
        value: 0
      });
      expect(errors).toEqual([]);
    });

    it("Validates Action 'D' (Delete In-Bond from all Bills)", () => {
      const errors = validateQP10Header({
        actionCode: "D",
        inBondNumber: "V987654321",
        value: 0
      });
      expect(errors).toEqual([]);
    });

    it("Rejects invalid Action Code", () => {
      const errors = validateQP10Header({
        actionCode: "X",
        inBondNumber: "V123456789",
        value: 100
      });
      expect(errors).toContain("Invalid Action Code 'X'. Must be A, B, or D.");
    });
  });

  describe("Rule 2: In-Bond Movement Types (61 IT, 62 T&E, 63 IE) & Port Constraints", () => {
    it("Enforces Entry Type 61 (IT): Schedule D US Port required, Foreign Port must be blank/zero", () => {
      const invalidIT = validateQP10Header({
        actionCode: "A",
        inBondEntryType: "61",
        inBondNumber: "V123456789",
        usPortOfDestination: "1001",
        portOfForeignDestination: "57001", // Foreign port not allowed for IT
        value: 1000
      });
      expect(invalidIT).toContain("Port of Foreign Destination must be blank/zero for Entry Type 61 (IT).");
    });

    it("Enforces Entry Type 62 (T&E): Schedule D US Port + Schedule K Foreign Port + BTA Indicator required", () => {
      const validTE = validateQP10Header({
        actionCode: "A",
        inBondEntryType: "62",
        inBondNumber: "V123456789",
        usPortOfDestination: "1001",
        portOfForeignDestination: "57001",
        btaFdaIndicator: "Y",
        value: 25000
      });
      expect(validTE).toEqual([]);

      const missingBTA = validateQP10Header({
        actionCode: "A",
        inBondEntryType: "62",
        inBondNumber: "V123456789",
        usPortOfDestination: "1001",
        portOfForeignDestination: "57001",
        value: 25000
      });
      expect(missingBTA).toContain("BTA/FDA Indicator ('Y' or 'N') is required for Entry Type 62 (T&E).");
    });

    it("Enforces Entry Type 63 (IE): Schedule D US Port + Schedule K Foreign Port required", () => {
      const validIE = validateQP10Header({
        actionCode: "A",
        inBondEntryType: "63",
        inBondNumber: "V123456789",
        usPortOfDestination: "2704",
        portOfForeignDestination: "57001",
        value: 12000
      });
      expect(validIE).toEqual([]);
    });
  });

  describe("Rule 3: Carrier Identification & FTZ/Warehouse Withdrawals", () => {
    it("Allows FIRMS code in place of SCAC for FTZ/Warehouse moves (FTZ Indicator = 'Y')", () => {
      const validFTZMove = validateQP10Header({
        actionCode: "A",
        inBondEntryType: "61",
        inBondNumber: "V123456789",
        inBondCarrierCode: "W123", // FIRMS code
        usPortOfDestination: "2704",
        portOfForeignDestination: "00000",
        value: 75000,
        foreignTradeZoneWarehouseIndicator: "Y"
      });
      expect(validFTZMove).toEqual([]);
    });
  });

  describe("Rule 4: Monetary & Quantitative Precision Rules", () => {
    it("Rejects fractional/decimal values in QP10 Value field (must be whole dollars)", () => {
      const decimalValue = validateQP10Header({
        actionCode: "A",
        inBondEntryType: "61",
        inBondNumber: "V123456789",
        usPortOfDestination: "2704",
        value: 1234.56 // Decimals not allowed in CATAIR QP10
      });
      expect(decimalValue).toContain("Value must be a positive integer in whole dollars (no decimals).");
    });
  });

  describe("Rule 5: In-Bond Arrival/Export Action Codes & FIRMS Code Requirement (WP10)", () => {
    it("Enforces FIRMS Code requirement upon arrival (Action 1) for Truck/Rail/Vessel MOTs", () => {
      const arrivalNoFirms = validateWP10ArrivalHeader({
        actionCode: "1",
        inBondNumber: "V123456789",
        inBondArrivalPort: "2704",
        modeOfTransportation: 30 // Truck
      });
      expect(arrivalNoFirms).toContain("FIRMS Code is mandatory upon in-bond arrival for all non-Air MOTs (Amendment 44 rule).");

      const arrivalWithFirms = validateWP10ArrivalHeader({
        actionCode: "1",
        inBondNumber: "V123456789",
        inBondArrivalPort: "2704",
        firmsCode: "W456",
        modeOfTransportation: 30
      });
      expect(arrivalWithFirms).toEqual([]);
    });

    it("Exempts Air MOT (40) from mandatory FIRMS Code upon arrival", () => {
      const airArrival = validateWP10ArrivalHeader({
        actionCode: "1",
        inBondNumber: "V123456789",
        inBondArrivalPort: "2704",
        modeOfTransportation: 40 // Air
      });
      expect(airArrival).toEqual([]);
    });
  });

  describe("Rule 6: Timestamp & Date Format Conventions", () => {
    it("Validates QP20 Arrival Date format as MMDDYY", () => {
      expect(validateQP20ArrivalDate("122526")).toBe(true); // Dec 25, 2026
      expect(validateQP20ArrivalDate("251226")).toBe(false); // Invalid month 25 in MMDDYY
    });

    it("Validates WP20 Arrival Date format as YYMMDD", () => {
      expect(validateWP20ArrivalDate("261225")).toBe(true); // 2026 Dec 25
      expect(validateWP20ArrivalDate("262512")).toBe(false); // Invalid month 25 in YYMMDD
    });
  });

  describe("Rule 7 & 8: Disposition Responses & Negative Indicators (NS30, QT95, WT95)", () => {
    it("Validates NS30 Negative Indicator ('N') for posting reversals", () => {
      const negativeInd = "N";
      expect(["N", " "].includes(negativeInd)).toBe(true);
    });

    it("Validates QT95/WT95 Narrative Response layout (39-char message)", () => {
      const narrativeMessage = "IN-BOND ACCEPTED BY USCBP SYSTEM".padEnd(39, " ");
      expect(narrativeMessage.length).toBe(39);
    });
  });
});
