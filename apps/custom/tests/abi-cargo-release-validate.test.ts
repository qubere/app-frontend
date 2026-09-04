import { describe, it, expect } from "vitest";
import {
  validateEntryTypeCode,
  validateModeOfTransportationCode,
  validateCountryOfOrigin,
  validateEntityCountryCode,
  validateConveyanceUnitOfMeasure,
} from "@/lib/abi/cargoRelease/validate";

describe("Cargo Release opt-in reference-data validation helpers", () => {
  describe("validateEntryTypeCode", () => {
    it("accepts a real Appendix B entry type code", () => {
      expect(validateEntryTypeCode("01")).toBe(true);
    });

    it("rejects an unpublished entry type code", () => {
      expect(validateEntryTypeCode("77")).toBe(false);
    });
  });

  describe("validateModeOfTransportationCode", () => {
    it("accepts a real Appendix B mode of transportation code", () => {
      expect(validateModeOfTransportationCode("11")).toBe(true);
    });

    it("rejects an unpublished code", () => {
      expect(validateModeOfTransportationCode("99")).toBe(false);
    });
  });

  describe("validateCountryOfOrigin", () => {
    it("accepts a real ISO country code", () => {
      expect(validateCountryOfOrigin("JP")).toBe(true);
    });

    it("rejects an unrecognized code", () => {
      expect(validateCountryOfOrigin("ZZ")).toBe(false);
    });
  });

  describe("validateEntityCountryCode", () => {
    it("accepts a real ISO country code (shared by SE36 and SE56)", () => {
      expect(validateEntityCountryCode("MX")).toBe(true);
    });

    it("rejects an unrecognized code", () => {
      expect(validateEntityCountryCode("XX")).toBe(false);
    });
  });

  describe("validateConveyanceUnitOfMeasure", () => {
    it("accepts a real Appendix B unit of measure code", () => {
      expect(validateConveyanceUnitOfMeasure("PCS")).toBe(true);
    });

    it("rejects an unrecognized code", () => {
      expect(validateConveyanceUnitOfMeasure("ZZZ")).toBe(false);
    });
  });
});
