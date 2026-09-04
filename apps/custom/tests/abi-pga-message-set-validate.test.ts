import { describe, it, expect } from "vitest";
import {
  validateGovernmentAgencyCode,
  validateUnitOfMeasureCode,
  validateCountryCode,
} from "@/lib/abi/pgaMessageSet/validate";

describe("PGA Message Set opt-in reference-data validation helpers", () => {
  describe("validateGovernmentAgencyCode", () => {
    it("accepts a real Appendix V government agency code", () => {
      expect(validateGovernmentAgencyCode("FDA")).toBe(true);
      expect(validateGovernmentAgencyCode("EPA")).toBe(true);
    });

    it("rejects an unrecognized agency code", () => {
      expect(validateGovernmentAgencyCode("XYZ")).toBe(false);
    });
  });

  describe("validateUnitOfMeasureCode", () => {
    it("accepts a real Appendix B unit of measure code (shared by PG04/PG14/PG26/PG29)", () => {
      expect(validateUnitOfMeasureCode("KG")).toBe(true);
    });

    it("rejects an unrecognized code", () => {
      expect(validateUnitOfMeasureCode("ZZZ")).toBe(false);
    });
  });

  describe("validateCountryCode", () => {
    it("accepts a real ISO country code (shared by PG06/PG20/PG32/PG34)", () => {
      expect(validateCountryCode("FR")).toBe(true);
    });

    it("rejects an unrecognized code", () => {
      expect(validateCountryCode("ZZ")).toBe(false);
    });
  });
});
