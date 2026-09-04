import { describe, it, expect } from "vitest";
import {
  validateEntryTypeCode,
  validateModeOfTransportationCode,
  validateCountryOfOriginCode,
  validateCountryOfExportCode,
  validateUnitOfMeasureCode,
  validateUsStateOfDestinationCode,
  resolveConditionCode,
} from "@/lib/abi/entrySummary/validate";

describe("Entry Summary opt-in reference-data validation helpers", () => {
  describe("validateEntryTypeCode", () => {
    it("accepts a real Appendix B entry type code", () => {
      expect(validateEntryTypeCode("01")).toBe(true);
      expect(validateEntryTypeCode("06")).toBe(true);
    });

    it("rejects an unpublished entry type code", () => {
      expect(validateEntryTypeCode("99")).toBe(false);
    });

    it("rejects a category-header code (e.g. '00' is a header, not a filable entry type)", () => {
      expect(validateEntryTypeCode("00")).toBe(false);
    });
  });

  describe("validateModeOfTransportationCode", () => {
    it("accepts a real Appendix B mode of transportation code", () => {
      expect(validateModeOfTransportationCode("10")).toBe(true);
      expect(validateModeOfTransportationCode("40")).toBe(true);
    });

    it("rejects an unpublished code", () => {
      expect(validateModeOfTransportationCode("99")).toBe(false);
    });
  });

  describe("validateCountryOfOriginCode", () => {
    it("accepts a real ISO country code", () => {
      expect(validateCountryOfOriginCode("DE")).toBe(true);
      expect(validateCountryOfOriginCode("CN")).toBe(true);
    });

    it("accepts the '**' unknown-country sentinel per the field's own spec note", () => {
      expect(validateCountryOfOriginCode("**")).toBe(true);
    });

    it("rejects an unrecognized code", () => {
      expect(validateCountryOfOriginCode("ZZ")).toBe(false);
    });
  });

  describe("validateCountryOfExportCode", () => {
    it("accepts a real ISO country code", () => {
      expect(validateCountryOfExportCode("US")).toBe(true);
    });

    it("does not special-case '**' (unlike Country of Origin)", () => {
      expect(validateCountryOfExportCode("**")).toBe(false);
    });

    it("rejects an unrecognized code", () => {
      expect(validateCountryOfExportCode("XX")).toBe(false);
    });
  });

  describe("validateUnitOfMeasureCode", () => {
    it("accepts a real Appendix B unit of measure code", () => {
      expect(validateUnitOfMeasureCode("KG")).toBe(true);
      expect(validateUnitOfMeasureCode("NO")).toBe(true);
    });

    it("rejects an unrecognized code", () => {
      expect(validateUnitOfMeasureCode("ZZZ")).toBe(false);
    });
  });

  describe("validateUsStateOfDestinationCode", () => {
    it("accepts a real US state code", () => {
      expect(validateUsStateOfDestinationCode("CA")).toBe(true);
      expect(validateUsStateOfDestinationCode("NY")).toBe(true);
    });

    it("rejects a Canadian province code (wrong region for this field)", () => {
      expect(validateUsStateOfDestinationCode("ON")).toBe(false);
    });

    it("rejects an unrecognized code", () => {
      expect(validateUsStateOfDestinationCode("ZZ")).toBe(false);
    });
  });

  describe("resolveConditionCode", () => {
    it("resolves a known ACE Error Dictionary condition code with its narrative and explanation", () => {
      const entries = resolveConditionCode("861");
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].narrativeText).toBe("AUTO LICENSE INSUFFICIENT BALANCE");
      expect(entries[0].explanation).toContain("Additional Declaration Record Type '11'");
    });

    it("returns every matching entry for a non-unique condition code", () => {
      const entries = resolveConditionCode("003");
      expect(entries.length).toBeGreaterThan(1);
    });

    it("returns an empty array for an unrecognized condition code", () => {
      expect(resolveConditionCode("ZZZ999")).toEqual([]);
    });
  });
});
