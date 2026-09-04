/**
 * ACE Error Dictionary (CBP Master Error/Condition-Code Dictionary) Unit Tests
 * Source Spreadsheet: docs/plans/catair-source-docs/10-error-dictionary-2026-07.xlsx (sheet "ACE Error Dictionary")
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ACE ERROR DICTIONARY SCOPE & EVIDENTIARY NOTE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Context & Architecture:
 * CBP's master error dictionary contains condition codes referenced across multiple ABI applications,
 * including Batch & Block (X0/X1), Entry Summary (E0/E1), PGA disposition codes, Cargo Release,
 * Cargo Manifest Query (WR0 / WO60), and Census/AD-CVD Queries.
 *
 * Spreadsheet Metrics & Verification:
 *   - Total Sheet Rows: 1,055 (1 Header Row + 1,054 Data Rows)
 *   - Extracted Data Rows: 1,054
 *   - Unique Condition Codes in Map: 1,027 (27 rows belong to 17 codes with multi-context entries)
 *
 * Keys preserved as strings:
 *   - Numeric codes (e.g. "861", "439")
 *   - Codes with leading zeros (e.g. "014", "002", "003")
 *   - Alphanumeric codes (e.g. "60D", "60B", "60A", "Q13", "B22", "L01", "A04", "X42")
 */

import { describe, it, expect } from "vitest";
import {
  ABI_ERROR_DICTIONARY_ROWS,
  ABI_ERROR_DICTIONARY,
  ABI_ERROR_DICTIONARY_RECORD,
  ABI_ERROR_DICTIONARY_ALL,
  getAbiError,
  getAllAbiErrors,
} from "@/lib/abi/errorDictionary";

describe("ACE Error Dictionary Data Module", () => {
  describe("Row Count and Data Completeness Assertions", () => {
    it("should contain exactly 1,054 extracted data rows matching the source spreadsheet data rows", () => {
      expect(ABI_ERROR_DICTIONARY_ROWS.length).toBe(1054);
    });

    it("should map 1,027 unique condition code keys in the primary lookup Map", () => {
      expect(ABI_ERROR_DICTIONARY.size).toBe(1027);
      expect(Object.keys(ABI_ERROR_DICTIONARY_RECORD).length).toBe(1027);
      expect(ABI_ERROR_DICTIONARY_ALL.size).toBe(1027);
    });

    it("should ensure every row has non-empty conditionCode and narrativeText", () => {
      for (const entry of ABI_ERROR_DICTIONARY_ROWS) {
        expect(entry.conditionCode).toBeTruthy();
        expect(typeof entry.conditionCode).toBe("string");
        expect(entry.narrativeText).toBeTruthy();
        expect(typeof entry.narrativeText).toBe("string");
      }
    });

    it("should verify 1,053 rows have non-empty explanations (with row 83 Code B11 eliminated)", () => {
      const emptyExpls = ABI_ERROR_DICTIONARY_ROWS.filter((r) => !r.explanation);
      expect(emptyExpls.length).toBe(1);
      expect(emptyExpls[0].conditionCode).toBe("B11");
      expect(emptyExpls[0].narrativeText).toBe("<eliminated>");
    });
  });

  describe("Condition Code Key String Preservation & Type Safety", () => {
    it("should preserve leading zeros for condition codes as string keys", () => {
      expect(ABI_ERROR_DICTIONARY.has("014")).toBe(true);
      expect(ABI_ERROR_DICTIONARY.has("002")).toBe(true);
      expect(ABI_ERROR_DICTIONARY.has("003")).toBe(true);

      const entry014 = getAbiError("014");
      expect(entry014).toBeDefined();
      expect(entry014?.conditionCode).toBe("014");

      const entry002 = getAbiError("002");
      expect(entry002).toBeDefined();
      expect(entry002?.conditionCode).toBe("002");
    });

    it("should correctly handle alphanumeric condition codes as string keys", () => {
      const alphaCodes = ["60D", "60B", "60A", "Q13", "B22", "L01", "A04", "X42"];

      for (const code of alphaCodes) {
        expect(ABI_ERROR_DICTIONARY.has(code)).toBe(true);
        expect(ABI_ERROR_DICTIONARY_RECORD[code]).toBeDefined();
        const entry = getAbiError(code);
        expect(entry).toBeDefined();
        expect(entry?.conditionCode).toBe(code);
      }
    });

    it("should correctly handle standard numeric condition codes as string keys", () => {
      const numericCodes = ["861", "866", "869", "439", "751"];

      for (const code of numericCodes) {
        expect(ABI_ERROR_DICTIONARY.has(code)).toBe(true);
        const entry = getAbiError(code);
        expect(entry).toBeDefined();
        expect(entry?.conditionCode).toBe(code);
      }
    });
  });

  describe("Exact Spot Checks Against Raw Spreadsheet Cell Values", () => {
    it("should match raw xlsx cell values for Code 861 (First Data Row)", () => {
      const entry = getAbiError("861");
      expect(entry).toEqual({
        conditionCode: "861",
        narrativeText: "AUTO LICENSE INSUFFICIENT BALANCE",
        explanation:
          "The submitted Automobile License for Importer's Additional Declaration Record Type '11' has a balance that is not sufficient to cover the submitted auto part duty.",
        dateUpdated: "2026-07-18",
      });
    });

    it("should match raw xlsx cell values for Code 439", () => {
      const entry = getAbiError("439");
      expect(entry?.conditionCode).toBe("439");
      expect(entry?.narrativeText).toBe("QUANTITY/UOM(S) MISSING");
      expect(entry?.dateUpdated).toBe("2026-07-18");
    });

    it("should match raw xlsx cell values for Code 60D (Alphanumeric)", () => {
      const entry = getAbiError("60D");
      expect(entry).toEqual({
        conditionCode: "60D",
        narrativeText: "LIC/CERT/PERM FOR HTS MISSING",
        explanation:
          "A License Number/ Certificate Number / Permit Number (52-Record) is required for one or more of the HTS numbers cited on the ES line.",
        dateUpdated: "2026-05-19",
      });
    });

    it("should match raw xlsx cell values for Code Q13 (Quota)", () => {
      const entry = getAbiError("Q13");
      expect(entry).toEqual({
        conditionCode: "Q13",
        narrativeText: "QUOTA REQUESTED EXCEEDS RESERVE",
        explanation:
          "An entry summary line is subject to quota based on the tariff numbers, country of origin, and presentation date. If a refiled entry summary line reports a quantity that exceeds the Reserved Quota Quantity apportioned or prorated by CBP for the line, as reflected on the latest ACE Entry Summary Status Notification (UC), this error will result.",
        dateUpdated: "2023-10-12",
      });
    });

    it("should match raw xlsx cell values for Code B22 (Entry Summary)", () => {
      const entry = getAbiError("B22");
      expect(entry).toEqual({
        conditionCode: "B22",
        narrativeText: "Entry Summary To Entry Port Mismatch",
        explanation:
          "The entry number is already on file in the CBP database with a different port of entry (POE) code.  Error occurs when filer makes entry at one POE and attempts to update to new port code via the ACE Cargo Release (SE) Update action without deleting the Summary (AE) data first. If SE Replace/Update is not an option to resolve, the filer may need to make new entry at correct POE and cancel the duplicate entry at the original POE.",
        dateUpdated: "2023-06-20",
      });
    });

    it("should match raw xlsx cell values for Code X42 (Last Data Row)", () => {
      const entry = getAbiError("X42");
      expect(entry).toEqual({
        conditionCode: "X42",
        narrativeText: "Last Record Less Than 80-Char Length",
        explanation:
          "The last record in the batch (Z record) has fewer than 80 characters.",
        dateUpdated: null,
      });
    });
  });

  describe("Multi-Context Duplicate Code Handling", () => {
    it("should return all occurrences for code 014 (3 multi-query contexts)", () => {
      const entries = getAllAbiErrors("014");
      expect(entries.length).toBe(3);
      expect(entries[0].narrativeText).toBe("Date Range Exceeds Query Limit");
      expect(entries[1].narrativeText).toBe("Query Complete No AD/CVD Cases Found");
      expect(entries[2].narrativeText).toBe("Query Not Permitted for Entry Number");
    });

    it("should return all occurrences for code 002 (2 multi-query contexts)", () => {
      const entries = getAllAbiErrors("002");
      expect(entries.length).toBe(2);
      expect(entries[0].narrativeText).toBe("Case Number Missing");
      expect(entries[1].narrativeText).toBe("Query Request Missing");
    });

    it("should return all occurrences for code 751 (2 multi-query contexts)", () => {
      const entries = getAllAbiErrors("751");
      expect(entries.length).toBe(2);
      expect(entries[0].narrativeText).toBe("Known Importer Ind Must Be Y");
      expect(entries[1].narrativeText).toBe("Known importer ind must be a Y");
    });
  });

  describe("Lookup Function Resilience", () => {
    it("should return undefined for non-existent condition codes in getAbiError", () => {
      expect(getAbiError("NONEXISTENT")).toBeUndefined();
      expect(getAbiError("999999")).toBeUndefined();
    });

    it("should return empty array for non-existent condition codes in getAllAbiErrors", () => {
      expect(getAllAbiErrors("NONEXISTENT")).toEqual([]);
    });
  });
});
