import { describe, it, expect } from "vitest";
import { validateEntryTypeCode, resolveConditionCode } from "@/lib/abi/ebond/validate";

describe("eBond opt-in reference-data validation helpers", () => {
  describe("validateEntryTypeCode", () => {
    it("accepts a real Appendix B entry type code", () => {
      expect(validateEntryTypeCode("01")).toBe(true);
    });

    it("rejects an unpublished entry type code", () => {
      expect(validateEntryTypeCode("99")).toBe(false);
    });
  });

  describe("resolveConditionCode", () => {
    it("resolves a known ACE Error Dictionary condition code", () => {
      const entries = resolveConditionCode("861");
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].narrativeText).toBe("AUTO LICENSE INSUFFICIENT BALANCE");
    });

    it("returns an empty array for an unrecognized condition code", () => {
      expect(resolveConditionCode("NOPE99")).toEqual([]);
    });
  });
});
