import { describe, it, expect } from "vitest";
import { resolveConditionCode } from "@/lib/abi/batchBlockControl/validate";
import { CONDITION_CODES } from "@/lib/abi/batchBlockControl/conditionCodes";

describe("Batch & Block Control opt-in reference-data validation helpers", () => {
  describe("resolveConditionCode", () => {
    it("resolves an X1-Record condition code to a fuller entry than the chapter-local narrative table", () => {
      // This chapter's own local table only has a bare narrative string...
      expect(CONDITION_CODES["X12"]).toBe("NOT A KNOWN ACE APPLICATION ID CODE");
      // ...while the ACE Error Dictionary carries the same code plus an explanation.
      const entries = resolveConditionCode("X12");
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].narrativeText.toUpperCase()).toContain("NOT A KNOWN ACE APPLICATION ID CODE");
      expect(entries[0].explanation.length).toBeGreaterThan(0);
    });

    it("returns every matching entry for a non-unique condition code", () => {
      const entries = resolveConditionCode("003");
      expect(entries.length).toBeGreaterThan(0);
    });

    it("returns an empty array for the chapter's own synthetic '999' final-disposition code, which isn't in the ACE Error Dictionary", () => {
      expect(CONDITION_CODES["999"]).toBe("BATCH REJECTED");
      expect(resolveConditionCode("999")).toEqual([]);
    });

    it("returns an empty array for an unrecognized condition code", () => {
      expect(resolveConditionCode("NOPE99")).toEqual([]);
    });
  });
});
