/**
 * CATAIR Participating Government Agencies (PGA) Message Set (Chapter 8) Business Rules Tests
 * Source PDF: docs/plans/catair-source-docs/08-pga-message-set-2026-07.pdf (July 1, 2026 - Pub # 0875-0419)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BUSINESS RULES & VERIFICATION ENGINE FOR CATAIR CHAPTER 8
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Implementation notes (post-reconciliation): the record-sequencing/hierarchy
 * rules below (PGA line numbering, OI placement, PG01 disclaimer scope, PG02
 * product/component cardinality, PG26 packaging-level ordering, PG50/PG51
 * grouping, PG60 qualifier attachment) are pure domain logic that isn't part
 * of `src/lib/abi/pgaMessageSet/` (which only encodes/decodes individual
 * fixed-width lines, not cross-record sequencing) — those helpers stay local
 * and unchanged. What *was* wrong is that every wire-format assertion in this
 * file exercised a locally-defined `formatImpliedDecimal`/`parseImpliedDecimal`
 * pair operating on raw JS numbers against a duplicate, locally-scoped
 * `PgaRecordSpec` shape, instead of the real `RecordSpec`s from
 * `@/lib/abi/pgaMessageSet/recordSpecs` via `encodeRecord`/`decodeRecord` from
 * `@/lib/abi/fixedWidth` — so none of it validated the real implementation.
 * Every wire-format-touching test below now goes through the real specs, and
 * money/quantity fixtures use `Decimal` (not raw numbers) and PGA's MMDDCCYY
 * date fields use `Date` (not raw digit strings), matching the real
 * implementation's `impliedDecimalField`/`dateFieldCCYY` binding.
 */

import { describe, it, expect } from "vitest";
import { encodeRecord, decodeRecord } from "@/lib/abi/fixedWidth";
import { Decimal } from "@/lib/tariff/decimal";
import {
  PG01_HEADER_SPEC,
  PG02_PRODUCT_COMPONENT_SPEC,
  PG04_CONSTITUENT_ELEMENT_SPEC,
  PG06_SOURCE_PROCESSING_SPEC,
  PG14_LPCO_DETAILS_SPEC,
  PG25_TEMPERATURE_LOT_VALUES_SPEC,
  PG26_PACKAGING_BREAKDOWN_SPEC,
  PG50_GROUP_START_SPEC,
  PG51_GROUP_END_SPEC,
  PG60_ADDITIONAL_REFERENCE_SPEC,
} from "@/lib/abi/pgaMessageSet/recordSpecs";

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN TYPES AND HELPERS FOR PGA BUSINESS RULES (record-sequencing logic —
// not modeled by src/lib/abi/pgaMessageSet/, which only codecs single lines)
// ─────────────────────────────────────────────────────────────────────────────

export interface PgaLineIdentifier {
  agencyCode: string;
  pgaLineNumber: string; // 3-digit formatted string, e.g. "001"
}

export interface PgaRecordInput {
  recordType: string;
  [key: string]: unknown;
}

export interface PgaValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Evaluate PGA Line Numbering restart and increment logic.
 * Rule: Within a tariff line, PG01 PGA Line Number starts at 001 for a given Agency Code,
 * and increments by 1 for every new PG01 for that same Agency Code.
 * When the Agency Code changes, line numbering restarts at 001.
 */
export function computePgaLineNumbers(agencyCodes: string[]): PgaLineIdentifier[] {
  const results: PgaLineIdentifier[] = [];
  let currentAgency = "";
  let counter = 0;

  for (const agency of agencyCodes) {
    if (agency !== currentAgency) {
      currentAgency = agency;
      counter = 1;
    } else {
      counter++;
    }
    const formatted = String(counter).padStart(3, "0");
    results.push({ agencyCode: agency, pgaLineNumber: formatted });
  }

  return results;
}

/**
 * Validate OI (Commercial Line Description) placement.
 * Rule: Exactly one OI record per HTS line item; must precede PG01 records.
 */
export function validateOiPlacement(records: PgaRecordInput[]): PgaValidationResult {
  const errors: string[] = [];
  const oiIndices = records
    .map((r, idx) => (r.recordType === "OI" ? idx : -1))
    .filter((idx) => idx !== -1);

  if (oiIndices.length === 0) {
    errors.push("Missing mandatory OI (Commercial Line Item Description) record.");
  } else if (oiIndices.length > 1) {
    errors.push("Only one OI record is allowed per HTS entry line.");
  } else {
    const firstPg01Index = records.findIndex((r) => r.recordType === "PG01");
    if (firstPg01Index !== -1 && oiIndices[0] > firstPg01Index) {
      errors.push("OI record must precede all PG01 records.");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate Disclaimer code rules in PG01.
 * Codes: A (not regulated), B (data not required), C (filed other means), D (filed paper),
 * E (FWS only), F (FDA Entry Type 21 only), G (APHIS Lacey de minimis only).
 */
export function validatePg01Disclaimer(disclaimerCode: string, agencyCode?: string): PgaValidationResult {
  const errors: string[] = [];
  const validCodes = ["A", "B", "C", "D", "E", "F", "G"];
  if (!validCodes.includes(disclaimerCode)) {
    errors.push(`Invalid Disclaimer code '${disclaimerCode}'. Must be one of A, B, C, D, E, F, G.`);
    return { valid: false, errors };
  }

  if (disclaimerCode === "E" && agencyCode && agencyCode !== "FWS") {
    errors.push("Disclaimer code E is only allowed for U.S. Fish and Wildlife Service (FWS).");
  }
  if (disclaimerCode === "F" && agencyCode && agencyCode !== "FDA") {
    errors.push("Disclaimer code F is only allowed for Food and Drug Administration (FDA).");
  }
  if (disclaimerCode === "G" && agencyCode && agencyCode !== "APH") {
    errors.push("Disclaimer code G is only allowed for USDA APHIS Lacey Act.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate PG02 Product vs Component rules.
 */
export function validatePg02Hierarchy(pg02Records: PgaRecordInput[]): PgaValidationResult {
  const errors: string[] = [];
  const productRecords = pg02Records.filter((r) => r.itemType === "P");

  if (productRecords.length > 1) {
    errors.push("Only one PG02 'P' (Product) record is allowed per PGA line number.");
  }

  for (const r of pg02Records) {
    if (r.itemType !== "P" && r.itemType !== "C") {
      errors.push(`Invalid PG02 itemType '${r.itemType}'. Must be 'P' (Product) or 'C' (Component).`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate PG26 Packaging Level hierarchy rules.
 * Packaging Qualifiers 1 to 6 (1=outermost, 6=innermost).
 */
export function validatePg26Packaging(pg26Records: PgaRecordInput[]): PgaValidationResult {
  const errors: string[] = [];
  if (pg26Records.length > 6) {
    errors.push("A maximum of 6 packaging level PG26 records are allowed.");
  }

  let lastLevel = 0;
  for (let i = 0; i < pg26Records.length; i++) {
    const level = parseInt(String(pg26Records[i].packagingQualifier), 10);
    if (isNaN(level) || level < 1 || level > 6) {
      errors.push(`Invalid Packaging Qualifier '${pg26Records[i].packagingQualifier}'. Must be between 1 (outermost) and 6 (innermost).`);
    }
    if (i > 0 && level <= lastLevel) {
      errors.push("PG26 packaging levels must be reported sequentially from outermost (1) to innermost.");
    }
    lastLevel = level;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate PG50/PG51 Grouping structure.
 */
export function validateGroupingStructure(records: PgaRecordInput[]): PgaValidationResult {
  const errors: string[] = [];
  let inGroup = false;
  const allowedParents = ["PG02", "PG04", "PG13", "PG14"];
  const allowedChildren = ["PG05", "PG06", "PG07", "PG10", "PG14", "PG19", "PG22", "PG25", "PG26", "PG29", "PG31", "PG32"];

  let lastRecordType = "";
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (rec.recordType === "PG50") {
      if (inGroup) {
        errors.push("Nested PG50 groupings are not allowed.");
      }
      if (!allowedParents.includes(lastRecordType)) {
        errors.push(`PG50 grouping parent '${lastRecordType}' is invalid. Allowed parents: PG02, PG04, PG13, PG14.`);
      }
      inGroup = true;
    } else if (rec.recordType === "PG51") {
      if (!inGroup) {
        errors.push("PG51 end-of-grouping without preceding PG50 start-of-grouping.");
      }
      inGroup = false;
    } else if (inGroup) {
      if (!allowedChildren.includes(rec.recordType)) {
        errors.push(`Record '${rec.recordType}' is not allowed inside a PG50/PG51 group.`);
      }
    }
    if (rec.recordType !== "PG50" && rec.recordType !== "PG51") {
      lastRecordType = rec.recordType;
    }
  }

  if (inGroup) {
    errors.push("Unclosed PG50 grouping missing corresponding PG51.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate PG60 Additional Reference qualifier attachment rules.
 */
export function validatePg60Qualifier(qualifier: string, parentRecordType: string): PgaValidationResult {
  const errors: string[] = [];
  const qualifierMap: Record<string, string[]> = {
    TBN: ["PG07"],
    PMN: ["PG07"],
    AD1: ["PG19"],
    ENA: ["PG19"],
    CP1: ["PG19"],
    CP2: ["PG19"],
    CP3: ["PG19"],
    CP4: ["PG19"],
    LAT: ["PG19"],
    LON: ["PG19"],
    AD2: ["PG20"],
    AD3: ["PG20"],
    AD4: ["PG20"],
    AD5: ["PG20"],
    ECI: ["PG20"],
    TEL: ["PG21"],
    EMA: ["PG21"],
    INA: ["PG21"],
    CIT: ["PG19", "PG20", "PG21"],
  };

  const validParents = qualifierMap[qualifier];
  if (!validParents) {
    errors.push(`Invalid PG60 Additional Reference qualifier code '${qualifier}'.`);
  } else if (!validParents.includes(parentRecordType)) {
    errors.push(`PG60 qualifier '${qualifier}' is not valid after parent record '${parentRecordType}'. Allowed parents: ${validParents.join(", ")}.`);
  }

  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// VITEST BUSINESS RULES TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe("PGA Message Set Generic Business Rules — Unit Verification", () => {
  describe("Rule 1: PGA Line Numbering & Restart Logic", () => {
    it("increments line number for same agency and restarts at 001 for new agency", () => {
      const agencies = ["EPA", "EPA", "EPA", "FSI", "FDA"];
      const lines = computePgaLineNumbers(agencies);
      expect(lines).toEqual([
        { agencyCode: "EPA", pgaLineNumber: "001" },
        { agencyCode: "EPA", pgaLineNumber: "002" },
        { agencyCode: "EPA", pgaLineNumber: "003" },
        { agencyCode: "FSI", pgaLineNumber: "001" },
        { agencyCode: "FDA", pgaLineNumber: "001" },
      ]);
    });

    it("encodes/decodes PGA Line Number onto the wire preserving significant leading zeros (numericCodeField)", () => {
      const line = encodeRecord(PG01_HEADER_SPEC, {
        pgaLineNumber: "001",
        governmentAgencyCode: "EPA",
        governmentAgencyProgramCode: "TSC",
      });
      expect(line.slice(4, 7)).toBe("001"); // pos 5-7
      const decoded = decodeRecord(PG01_HEADER_SPEC, line);
      expect(decoded.pgaLineNumber).toBe("001");
      expect(typeof decoded.pgaLineNumber).toBe("string");
    });
  });

  describe("Rule 2: OI Commercial Description Placement", () => {
    it("passes when exactly one OI record precedes PG01", () => {
      const records = [{ recordType: "OI" }, { recordType: "PG01" }, { recordType: "PG02" }];
      const res = validateOiPlacement(records);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("fails when OI record is missing", () => {
      const records = [{ recordType: "PG01" }];
      const res = validateOiPlacement(records);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("Missing mandatory OI");
    });

    it("fails when multiple OI records are submitted for a single HTS line", () => {
      const records = [{ recordType: "OI" }, { recordType: "OI" }, { recordType: "PG01" }];
      const res = validateOiPlacement(records);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("Only one OI record is allowed");
    });

    it("fails when OI appears after PG01", () => {
      const records = [{ recordType: "PG01" }, { recordType: "OI" }];
      const res = validateOiPlacement(records);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("OI record must precede");
    });
  });

  describe("Rule 3: PG01 Disclaimer Codes & Agency Guidance Constraints", () => {
    it("accepts generic disclaimer codes A, B, C, D for any agency", () => {
      expect(validatePg01Disclaimer("A", "EPA").valid).toBe(true);
      expect(validatePg01Disclaimer("B", "FDA").valid).toBe(true);
      expect(validatePg01Disclaimer("C", "FWS").valid).toBe(true);
      expect(validatePg01Disclaimer("D", "APH").valid).toBe(true);
    });

    it("enforces agency restrictions on disclaimers E, F, and G", () => {
      expect(validatePg01Disclaimer("E", "FWS").valid).toBe(true);
      expect(validatePg01Disclaimer("E", "EPA").valid).toBe(false);

      expect(validatePg01Disclaimer("F", "FDA").valid).toBe(true);
      expect(validatePg01Disclaimer("F", "FWS").valid).toBe(false);

      expect(validatePg01Disclaimer("G", "APH").valid).toBe(true);
      expect(validatePg01Disclaimer("G", "FDA").valid).toBe(false);
    });

    it("encodes/decodes the PG01 Disclaimer code onto the wire (pos 80, class A)", () => {
      for (const code of ["A", "B", "C", "D"] as const) {
        const line = encodeRecord(PG01_HEADER_SPEC, {
          pgaLineNumber: "001",
          governmentAgencyCode: "EPA",
          governmentAgencyProgramCode: "TSC",
          disclaimer: code,
        });
        expect(line[79]).toBe(code);
        expect(decodeRecord(PG01_HEADER_SPEC, line).disclaimer).toBe(code);
      }
    });
  });

  describe("Rule 4: PG02 Product vs Component Level Data", () => {
    it("passes with one Product ('P') and multiple Components ('C')", () => {
      const pg02s = [
        { recordType: "PG02", itemType: "P" },
        { recordType: "PG02", itemType: "C" },
        { recordType: "PG02", itemType: "C" },
      ];
      const res = validatePg02Hierarchy(pg02s);
      expect(res.valid).toBe(true);
    });

    it("fails if multiple Product ('P') records are submitted for a single PGA line", () => {
      const pg02s = [
        { recordType: "PG02", itemType: "P" },
        { recordType: "PG02", itemType: "P" },
      ];
      const res = validatePg02Hierarchy(pg02s);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("Only one PG02 'P' (Product) record is allowed");
    });

    it("encodes/decodes PG02 Product ('P') and Component ('C') item types onto the wire", () => {
      const productLine = encodeRecord(PG02_PRODUCT_COMPONENT_SPEC, {
        itemType: "P",
        productCodeQualifier1: "GTIN",
        productCodeNumber1: "00012345678905",
      });
      expect(decodeRecord(PG02_PRODUCT_COMPONENT_SPEC, productLine).itemType).toBe("P");

      const componentLine = encodeRecord(PG02_PRODUCT_COMPONENT_SPEC, { itemType: "C" });
      expect(decodeRecord(PG02_PRODUCT_COMPONENT_SPEC, componentLine).itemType).toBe("C");
    });
  });

  describe("Rule 5: PG26 Packaging Level Breakdown", () => {
    it("validates sequential packaging level qualifiers from 1 to 6", () => {
      const pg26s = [
        { recordType: "PG26", packagingQualifier: "1" },
        { recordType: "PG26", packagingQualifier: "2" },
        { recordType: "PG26", packagingQualifier: "3" },
      ];
      expect(validatePg26Packaging(pg26s).valid).toBe(true);
    });

    it("rejects non-sequential or out-of-order packaging qualifiers", () => {
      const pg26s = [
        { recordType: "PG26", packagingQualifier: "2" },
        { recordType: "PG26", packagingQualifier: "1" },
      ];
      const res = validatePg26Packaging(pg26s);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("must be reported sequentially");
    });

    it("encodes/decodes PG26 Packaging Qualifier as a plain number and Quantity as Decimal (2 implied decimals)", () => {
      const line = encodeRecord(PG26_PACKAGING_BREAKDOWN_SPEC, {
        packagingQualifier: 1,
        quantity: new Decimal("24.5"),
      });
      expect(line.slice(4, 5)).toBe("1"); // pos 5
      expect(line.slice(5, 17)).toBe("000000002450"); // pos 6-17

      const decoded = decodeRecord(PG26_PACKAGING_BREAKDOWN_SPEC, line);
      expect(decoded.packagingQualifier).toBe(1);
      expect(typeof decoded.packagingQualifier).toBe("number");
      expect(decoded.quantity?.toString()).toBe("24.5");
    });
  });

  describe("Rule 6: PG50 / PG51 Grouping Parent-Child Constraints", () => {
    it("allows valid grouping under parent PG14 with allowed child records", () => {
      const records = [
        { recordType: "PG13" },
        { recordType: "PG14" },
        { recordType: "PG50" },
        { recordType: "PG10" },
        { recordType: "PG19" },
        { recordType: "PG26" },
        { recordType: "PG51" },
      ];
      const res = validateGroupingStructure(records);
      expect(res.valid).toBe(true);
    });

    it("rejects unclosed PG50 groupings", () => {
      const records = [{ recordType: "PG14" }, { recordType: "PG50" }, { recordType: "PG10" }];
      const res = validateGroupingStructure(records);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("Unclosed PG50 grouping");
    });

    it("rejects nested PG50 groupings", () => {
      const records = [
        { recordType: "PG14" },
        { recordType: "PG50" },
        { recordType: "PG10" },
        { recordType: "PG50" },
        { recordType: "PG51" },
        { recordType: "PG51" },
      ];
      const res = validateGroupingStructure(records);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain("Nested PG50 groupings are not allowed");
    });

    it("encodes/decodes PG50 start-of-grouping and PG51 end-of-grouping as pure control markers with no data fields", () => {
      const startLine = encodeRecord(PG50_GROUP_START_SPEC, {});
      const endLine = encodeRecord(PG51_GROUP_END_SPEC, {});

      expect(startLine).toHaveLength(80);
      expect(startLine.slice(0, 4)).toBe("PG50");
      expect(startLine.slice(4)).toBe(" ".repeat(76));
      expect(endLine.slice(0, 4)).toBe("PG51");
      expect(endLine.slice(4)).toBe(" ".repeat(76));

      expect(decodeRecord(PG50_GROUP_START_SPEC, startLine)).toEqual({});
      expect(decodeRecord(PG51_GROUP_END_SPEC, endLine)).toEqual({});
    });
  });

  describe("Rule 7: PG60 Overflow Qualifier Attachment Rules", () => {
    it("validates qualifier attachment to designated parent record types", () => {
      expect(validatePg60Qualifier("TBN", "PG07").valid).toBe(true);
      expect(validatePg60Qualifier("TBN", "PG19").valid).toBe(false);

      expect(validatePg60Qualifier("AD1", "PG19").valid).toBe(true);
      expect(validatePg60Qualifier("AD2", "PG20").valid).toBe(true);
      expect(validatePg60Qualifier("TEL", "PG21").valid).toBe(true);
      expect(validatePg60Qualifier("CIT", "PG20").valid).toBe(true);
    });

    it("encodes/decodes a PG60 Additional Reference qualifier/value pair (both mandatory)", () => {
      const line = encodeRecord(PG60_ADDITIONAL_REFERENCE_SPEC, {
        additionalInformationQualifierCode: "TBN",
        additionalInformation: "ACME WIDGET MODEL X100",
      });
      expect(line.slice(4, 7)).toBe("TBN"); // pos 5-7
      const decoded = decodeRecord(PG60_ADDITIONAL_REFERENCE_SPEC, line);
      expect(decoded.additionalInformationQualifierCode).toBe("TBN");
      expect(decoded.additionalInformation).toBe("ACME WIDGET MODEL X100");
    });
  });

  describe("Rule 8: Implied Decimal Precision & Scaling — Money/Quantity Fields Bound to `Decimal`", () => {
    it("encodes/decodes PG04 Constituent Quantity (12N, 2 implied decimals) via Decimal", () => {
      const line = encodeRecord(PG04_CONSTITUENT_ELEMENT_SPEC, {
        quantityOfConstituentElement: new Decimal("1250.75"),
      });
      expect(line.slice(56, 68)).toBe("000000125075"); // pos 57-68
      expect(
        decodeRecord(PG04_CONSTITUENT_ELEMENT_SPEC, line).quantityOfConstituentElement?.toString()
      ).toBe("1250.75");
    });

    it("encodes/decodes PG04 Constituent Percent (7N, 4 implied decimals) via Decimal", () => {
      const line = encodeRecord(PG04_CONSTITUENT_ELEMENT_SPEC, {
        percentOfConstituentElement: new Decimal("0.0009"),
      });
      expect(line.slice(73, 80)).toBe("0000009"); // pos 74-80
      expect(
        decodeRecord(PG04_CONSTITUENT_ELEMENT_SPEC, line).percentOfConstituentElement?.toString()
      ).toBe("0.0009");
    });

    it("encodes/decodes PG14 LPCO Quantity (16N, 4 implied decimals) via Decimal", () => {
      const line = encodeRecord(PG14_LPCO_DETAILS_SPEC, {
        lpcoQuantity: new Decimal("50.1234"),
      });
      expect(line.slice(50, 66)).toBe("0000000000501234"); // pos 51-66
      expect(decodeRecord(PG14_LPCO_DETAILS_SPEC, line).lpcoQuantity?.toString()).toBe("50.1234");
    });

    it("encodes/decodes PG25 PGA Line Value (12N, 0 implied decimals — whole dollars) via Decimal", () => {
      const line = encodeRecord(PG25_TEMPERATURE_LOT_VALUES_SPEC, {
        pgaLineValue: new Decimal("75000"),
      });
      expect(line.slice(56, 68)).toBe("000000075000"); // pos 57-68
      expect(decodeRecord(PG25_TEMPERATURE_LOT_VALUES_SPEC, line).pgaLineValue?.toString()).toBe("75000");
    });

    it("encodes/decodes PG25 PGA Unit Value (12N, 2 implied decimals) via Decimal — distinct from Line Value's 0", () => {
      const line = encodeRecord(PG25_TEMPERATURE_LOT_VALUES_SPEC, {
        pgaUnitValue: new Decimal("49.99"),
      });
      expect(line.slice(68, 80)).toBe("000000004999"); // pos 69-80
      expect(decodeRecord(PG25_TEMPERATURE_LOT_VALUES_SPEC, line).pgaUnitValue?.toString()).toBe("49.99");
    });
  });

  describe("Rule 9: PGA MMDDCCYY Date Fields Bound to `Date` (not raw digit strings)", () => {
    it("encodes/decodes PG06 Processing Start/End Date as Date objects (8-char MMDDCCYY)", () => {
      const line = encodeRecord(PG06_SOURCE_PROCESSING_SPEC, {
        sourceTypeCode: "MFG",
        processingStartDate: new Date(2026, 0, 15), // Jan 15, 2026 -> 01152026
        processingEndDate: new Date(2026, 5, 30), // Jun 30, 2026 -> 06302026
      });
      expect(line.slice(29, 37)).toBe("01152026"); // pos 30-37
      expect(line.slice(37, 45)).toBe("06302026"); // pos 38-45

      const decoded = decodeRecord(PG06_SOURCE_PROCESSING_SPEC, line);
      expect(decoded.processingStartDate).toEqual(new Date(2026, 0, 15));
      expect(decoded.processingEndDate).toEqual(new Date(2026, 5, 30));
    });
  });
});
