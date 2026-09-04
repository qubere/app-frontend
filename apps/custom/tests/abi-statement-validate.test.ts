import { describe, it, expect } from "vitest";
import { validateEntryTypeCode } from "@/lib/abi/statement/validate";

describe("Statement Processing opt-in reference-data validation helpers", () => {
  describe("validateEntryTypeCode", () => {
    it("accepts a real Appendix B entry type code", () => {
      expect(validateEntryTypeCode("01")).toBe(true);
      expect(validateEntryTypeCode("21")).toBe(true);
    });

    it("rejects an unpublished entry type code", () => {
      expect(validateEntryTypeCode("99")).toBe(false);
    });

    it("rejects a category-header code", () => {
      expect(validateEntryTypeCode("20")).toBe(false);
    });
  });
});
