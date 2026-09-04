import { describe, it, expect } from "vitest";
import {
  validateTransportationIndicator,
  validateCountryCode,
  validateContainerDescriptionCode,
} from "@/lib/abi/brokerDownload/validate";

describe("Broker Download opt-in reference-data validation helpers", () => {
  describe("validateTransportationIndicator", () => {
    it("accepts a real Appendix B mode of transportation code (1M-Record)", () => {
      expect(validateTransportationIndicator("10")).toBe(true);
      expect(validateTransportationIndicator("11")).toBe(true);
      expect(validateTransportationIndicator("20")).toBe(true);
    });

    it("rejects an unrecognized code", () => {
      expect(validateTransportationIndicator("99")).toBe(false);
    });
  });

  describe("validateCountryCode", () => {
    it("accepts a real ISO country code (shared by 1M and 1D)", () => {
      expect(validateCountryCode("CA")).toBe(true);
    });

    it("rejects an unrecognized code", () => {
      expect(validateCountryCode("ZZ")).toBe(false);
    });
  });

  describe("validateContainerDescriptionCode", () => {
    it("accepts a real Appendix B equipment description code (1C-Record)", () => {
      expect(validateContainerDescriptionCode("20")).toBe(true);
      expect(validateContainerDescriptionCode("NC")).toBe(true);
    });

    it("rejects an unrecognized code", () => {
      expect(validateContainerDescriptionCode("ZZ")).toBe(false);
    });
  });
});
