import { describe, it, expect } from "vitest";
import {
  validateUnitOfMeasureCode,
  validateCountryOfExport,
  validateCountryOfUltimateDestination,
  resolveConditionCode,
} from "@/lib/abi/drawback/validate";

describe("Drawback opt-in reference-data validation helpers", () => {
  describe("validateUnitOfMeasureCode", () => {
    it("accepts a real Appendix B unit of measure code (shared by Records 42/50/60/70)", () => {
      expect(validateUnitOfMeasureCode("KG")).toBe(true);
      expect(validateUnitOfMeasureCode("NO")).toBe(true);
    });

    it("rejects an unrecognized code", () => {
      expect(validateUnitOfMeasureCode("ZZZ")).toBe(false);
    });
  });

  describe("validateCountryOfExport", () => {
    it("accepts a recognized CBP country code (e.g. Record 64's CA/MX)", () => {
      expect(validateCountryOfExport("CA")).toBe(true);
      expect(validateCountryOfExport("MX")).toBe(true);
    });

    it("accepts other recognized country codes too — the CA/MX restriction is a business rule, not a reference-data check", () => {
      expect(validateCountryOfExport("DE")).toBe(true);
    });

    it("rejects an unrecognized code", () => {
      expect(validateCountryOfExport("ZZ")).toBe(false);
    });
  });

  describe("validateCountryOfUltimateDestination", () => {
    it("accepts a real ISO country code", () => {
      expect(validateCountryOfUltimateDestination("GB")).toBe(true);
    });

    it("rejects an unrecognized code", () => {
      expect(validateCountryOfUltimateDestination("XX")).toBe(false);
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
