import { describe, expect, it } from "vitest";
import {
  ABI_CANADIAN_PROVINCE_CODES,
  ABI_CANADIAN_PROVINCE_CODE_SET,
  ABI_LOCATION_CODES,
  ABI_LOCATION_CODE_MAP,
  ABI_LOCATION_CODE_SET,
  ABI_MEXICAN_STATE_CODES,
  ABI_MEXICAN_STATE_CODE_SET,
  ABI_US_LOCATION_CODES,
  ABI_US_LOCATION_CODES_PAGE_18,
  ABI_US_LOCATION_CODES_PAGE_19,
  ABI_US_LOCATION_CODE_SET,
  getCanadianProvinceCodes,
  getLocationCodeEntry,
  getMexicanStateCodes,
  getUsLocationCodes,
  isValidLocationCode,
} from "../src/lib/abi/locationCodes";

/**
 * CATAIR Appendix B: Location Identifiers Reference Data Unit Test Suite
 * Source PDF: docs/plans/catair-source-docs/appendix-b-valid-codes.pdf (Pages 18-21)
 */
describe("CATAIR Appendix B: Location Identifiers Reference Data", () => {
  describe("1. Record Count & Regional Distribution Validation", () => {
    it("contains exactly 102 total location code entries across all 4 tables", () => {
      expect(ABI_LOCATION_CODES.length).toBe(102);
      expect(ABI_LOCATION_CODE_MAP.size).toBe(102);
    });

    it("verifies Page 18: United States Location Identifiers (Part 1 - 44 entries)", () => {
      expect(ABI_US_LOCATION_CODES_PAGE_18.length).toBe(44);
      for (const entry of ABI_US_LOCATION_CODES_PAGE_18) {
        expect(entry.page).toBe(18);
        expect(entry.region).toBe("US");
        expect(entry.code).toMatch(/^[A-Z]{2}$/);
      }
      expect(ABI_US_LOCATION_CODES_PAGE_18[0].code).toBe("AK");
      expect(ABI_US_LOCATION_CODES_PAGE_18[43].code).toBe("SD");
    });

    it("verifies Page 19: United States Location Identifiers (Part 2 - 13 entries)", () => {
      expect(ABI_US_LOCATION_CODES_PAGE_19.length).toBe(13);
      for (const entry of ABI_US_LOCATION_CODES_PAGE_19) {
        expect(entry.page).toBe(19);
        expect(entry.region).toBe("US");
        expect(entry.code).toMatch(/^[A-Z]{2}$/);
      }
      expect(ABI_US_LOCATION_CODES_PAGE_19[0].code).toBe("TN");
      expect(ABI_US_LOCATION_CODES_PAGE_19[9].code).toBe("WY");
      expect(ABI_US_LOCATION_CODES_PAGE_19[10].code).toBe("AA");
      expect(ABI_US_LOCATION_CODES_PAGE_19[11].code).toBe("AE");
      expect(ABI_US_LOCATION_CODES_PAGE_19[12].code).toBe("AP");
    });

    it("verifies combined United States Location Identifiers (57 entries across Pages 18 & 19)", () => {
      expect(ABI_US_LOCATION_CODES.length).toBe(57);
      expect(getUsLocationCodes().length).toBe(57);
      expect(ABI_US_LOCATION_CODE_SET.size).toBe(57);
    });

    it("verifies Page 20: Mexican States (32 entries)", () => {
      expect(ABI_MEXICAN_STATE_CODES.length).toBe(32);
      expect(getMexicanStateCodes().length).toBe(32);
      expect(ABI_MEXICAN_STATE_CODE_SET.size).toBe(32);

      for (const entry of ABI_MEXICAN_STATE_CODES) {
        expect(entry.page).toBe(20);
        expect(entry.region).toBe("MX");
        expect(entry.code).toMatch(/^[A-Z]{3}$/);
      }
      expect(ABI_MEXICAN_STATE_CODES[0].code).toBe("AGU");
      expect(ABI_MEXICAN_STATE_CODES[31].code).toBe("ZAC");
    });

    it("verifies Page 21: Canadian Provinces (13 entries)", () => {
      expect(ABI_CANADIAN_PROVINCE_CODES.length).toBe(13);
      expect(getCanadianProvinceCodes().length).toBe(13);
      expect(ABI_CANADIAN_PROVINCE_CODE_SET.size).toBe(13);

      for (const entry of ABI_CANADIAN_PROVINCE_CODES) {
        expect(entry.page).toBe(21);
        expect(entry.region).toBe("CA");
        expect(entry.code).toMatch(/^[A-Z]{2}$/);
      }
      expect(ABI_CANADIAN_PROVINCE_CODES[0].code).toBe("AB");
      expect(ABI_CANADIAN_PROVINCE_CODES[12].code).toBe("YT");
    });
  });

  describe("2. Document Citation & Evidence Verification", () => {
    it("verifies Page 18 boundary entries and exact spelling (AK, CA, NY, RI Rhoda Island, SD)", () => {
      const ak = getLocationCodeEntry("AK", "US");
      expect(ak).toBeDefined();
      expect(ak?.description).toBe("Alaska");
      expect(ak?.page).toBe(18);

      const ca = getLocationCodeEntry("CA", "US");
      expect(ca?.description).toBe("California");
      expect(ca?.page).toBe(18);

      // Verifies exact spelling in source document for RI
      const ri = getLocationCodeEntry("RI", "US");
      expect(ri?.description).toBe("Rhoda Island");
      expect(ri?.page).toBe(18);

      const sd = getLocationCodeEntry("SD", "US");
      expect(sd?.description).toBe("South Dakota");
      expect(sd?.page).toBe(18);
    });

    it("verifies Page 19 Armed Forces entries and asterisk flags (AA, AE, AP)", () => {
      const aa = getLocationCodeEntry("AA", "US");
      expect(aa).toBeDefined();
      expect(aa?.description).toBe("Armed Forces America*");
      expect(aa?.isUpdatedCode).toBe(true);
      expect(aa?.page).toBe(19);

      const ae = getLocationCodeEntry("AE", "US");
      expect(ae?.description).toBe("Armed Forces Europe*");
      expect(ae?.isUpdatedCode).toBe(true);
      expect(ae?.page).toBe(19);

      const ap = getLocationCodeEntry("AP", "US");
      expect(ap?.description).toBe("Armed Forces Pacific*");
      expect(ap?.isUpdatedCode).toBe(true);
      expect(ap?.page).toBe(19);
    });

    it("verifies Page 20 Mexican State entries and Puebla* asterisk annotation", () => {
      const agu = getLocationCodeEntry("AGU", "MX");
      expect(agu).toBeDefined();
      expect(agu?.description).toBe("Aguascalientes");
      expect(agu?.page).toBe(20);

      const fue = getLocationCodeEntry("PUE", "MX");
      expect(fue?.description).toBe("Puebla*");
      expect(fue?.isUpdatedCode).toBe(true);
      expect(fue?.page).toBe(20);

      const zac = getLocationCodeEntry("ZAC", "MX");
      expect(zac?.description).toBe("Zacatecas");
      expect(zac?.page).toBe(20);
    });

    it("verifies Page 21 Canadian Province entries and Ontario* asterisk annotation", () => {
      const ab = getLocationCodeEntry("AB", "CA");
      expect(ab).toBeDefined();
      expect(ab?.description).toBe("Alberta");
      expect(ab?.page).toBe(21);

      const on = getLocationCodeEntry("ON", "CA");
      expect(on?.description).toBe("Ontario*");
      expect(on?.isUpdatedCode).toBe(true);
      expect(on?.page).toBe(21);

      const yt = getLocationCodeEntry("YT", "CA");
      expect(yt?.description).toBe("Yukon Territory");
      expect(yt?.page).toBe(21);
    });
  });

  describe("3. Lookup & Validation Helper Functions", () => {
    it("validates location codes by region scope", () => {
      expect(isValidLocationCode("CA", "US")).toBe(true);
      expect(isValidLocationCode("CA", "MX")).toBe(false);

      expect(isValidLocationCode("AGU", "MX")).toBe(true);
      expect(isValidLocationCode("AGU", "US")).toBe(false);

      expect(isValidLocationCode("ON", "CA")).toBe(true);
      expect(isValidLocationCode("ON", "US")).toBe(false);
    });

    it("handles case-insensitive lookups gracefully", () => {
      expect(isValidLocationCode("ca", "US")).toBe(true);
      expect(isValidLocationCode("agu", "MX")).toBe(true);
      expect(isValidLocationCode("on", "CA")).toBe(true);

      const entry = getLocationCodeEntry("  tx  ", "US");
      expect(entry?.code).toBe("TX");
      expect(entry?.description).toBe("Texas");
    });

    it("returns false / undefined for invalid codes", () => {
      expect(isValidLocationCode("XX")).toBe(false);
      expect(isValidLocationCode("INVALID")).toBe(false);
      expect(getLocationCodeEntry("INVALID")).toBeUndefined();
    });
  });
});
