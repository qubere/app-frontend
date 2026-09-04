import { describe, it, expect } from "vitest";
import { validateEntryTypeCode, resolveConditionCode } from "@/lib/abi/entrySummaryQuery/validate";
import { CONDITION_CODES } from "@/lib/abi/entrySummaryQuery/conditionCodes";

describe("Entry Summary Query opt-in reference-data validation helpers", () => {
  describe("validateEntryTypeCode", () => {
    it("accepts a real Appendix B entry type code", () => {
      expect(validateEntryTypeCode("01")).toBe(true);
      expect(validateEntryTypeCode("21")).toBe(true);
    });

    it("rejects an unpublished entry type code", () => {
      expect(validateEntryTypeCode("99")).toBe(false);
    });
  });

  describe("resolveConditionCode", () => {
    it("resolves a JZ-Record condition code shared with this chapter's local narrative table", () => {
      // "003" appears in this chapter's own local CONDITION_CODES table
      // ("ENTRY FILER CODE MISSING") as well as in the full ACE Error
      // Dictionary (which documents multiple contexts for "003").
      expect(CONDITION_CODES["003"]).toBe("ENTRY FILER CODE MISSING");
      const entries = resolveConditionCode("003");
      expect(entries.length).toBeGreaterThan(0);
    });

    it("resolves an X-series structural condition code with its full explanation", () => {
      const entries = resolveConditionCode("X34");
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].narrativeText.toUpperCase()).toContain("UNKNOWN RECORD ID");
    });

    it("returns an empty array for an unrecognized condition code", () => {
      expect(resolveConditionCode("NOPE")).toEqual([]);
    });
  });
});
