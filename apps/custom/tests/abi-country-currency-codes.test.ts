import { describe, expect, it } from "vitest";
import {
  ABI_COUNTRY_CURRENCY_CODES,
  ABI_VALID_COUNTRY_CODES,
  ABI_VALID_CURRENCY_CODES,
  getCountryByCode,
  getCurrenciesForCountry,
  isValidCountryCode,
  isValidCurrencyCode,
} from "../src/lib/abi/countryCurrencyCodes";

/**
 * CATAIR Appendix B: Country and Currency Codes Unit Test Suite
 * Source PDF: docs/plans/catair-source-docs/appendix-b-valid-codes.pdf (Pages 6-16, August 4, 2026)
 */
describe("CATAIR Appendix B: Country and Currency Codes Reference Data", () => {
  describe("1. Record Count & Evidentiary Proof Assertions", () => {
    it("contains exactly 243 total Country entries extracted from Pages 6-15", () => {
      expect(ABI_COUNTRY_CURRENCY_CODES.length).toBe(243);
    });

    it("contains exactly 242 2-letter country codes plus 1 IMF entry without a 2-letter code", () => {
      const with2LetterCode = ABI_COUNTRY_CURRENCY_CODES.filter((c) => c.countryCode.length === 2);
      const withoutCode = ABI_COUNTRY_CURRENCY_CODES.filter((c) => c.countryCode === "");

      expect(with2LetterCode.length).toBe(242);
      expect(withoutCode.length).toBe(1);
      expect(withoutCode[0].countryName).toBe("INTERNATIONAL MONETARY FUND (I.M.F.)");
    });

    it("contains exactly 256 total Country-Currency mappings across all 243 countries", () => {
      const totalMappings = ABI_COUNTRY_CURRENCY_CODES.reduce(
        (sum, country) => sum + country.currencies.length,
        0
      );
      expect(totalMappings).toBe(256);
    });

    it("contains exactly 166 unique 3-letter currency codes", () => {
      expect(ABI_VALID_CURRENCY_CODES.length).toBe(166);
    });

    it("confirms exact page distribution of 243 country starting entries across PDF Pages 6 to 15", () => {
      const pageCounts: Record<number, number> = {};
      for (const country of ABI_COUNTRY_CURRENCY_CODES) {
        pageCounts[country.page] = (pageCounts[country.page] || 0) + 1;
      }

      expect(pageCounts[6]).toBe(23); // AFGHANISTAN .. BERMUDA
      expect(pageCounts[7]).toBe(24); // BHUTAN .. COLOMBIA
      expect(pageCounts[8]).toBe(25); // COMOROS .. FIJI
      expect(pageCounts[9]).toBe(24); // FINLAND .. HOLY SEE
      expect(pageCounts[10]).toBe(25); // HONDURAS .. LATVIA
      expect(pageCounts[11]).toBe(25); // LEBANON .. MONGOLIA
      expect(pageCounts[12]).toBe(24); // MONTENEGRO .. PERU
      expect(pageCounts[13]).toBe(26); // PHILIPPINES .. SLOVAKIA
      expect(pageCounts[14]).toBe(23); // SLOVENIA .. TRINIDAD AND TOBAGO
      expect(pageCounts[15]).toBe(24); // TUNISIA .. ZIMBABWE

      const sumPages = Object.values(pageCounts).reduce((a, b) => a + b, 0);
      expect(sumPages).toBe(243);
    });
  });

  describe("2. Multi-Currency Countries (11 Countries / Territories)", () => {
    it("verifies the 11 countries with multiple currency entries in CATAIR Appendix B", () => {
      const multiCurrencyCountries = ABI_COUNTRY_CURRENCY_CODES.filter(
        (c) => c.currencies.length > 1
      );
      expect(multiCurrencyCountries.length).toBe(11);

      const countryCodes = multiCurrencyCountries.map((c) => c.countryCode).sort();
      expect(countryCodes).toEqual(["BO", "BT", "CH", "GW", "HT", "LS", "NA", "PA", "SK", "SV", "US"]);
    });

    it("verifies United States (US) currencies: USD, USS, USN", () => {
      const us = getCountryByCode("US");
      expect(us).toBeDefined();
      expect(us?.currencies.map((c) => c.currencyCode)).toEqual(["USD", "USS", "USN"]);
      expect(us?.currencies.map((c) => c.currencyName)).toEqual([
        "US Dollar",
        "(Same Day)",
        "(Next Day)",
      ]);
    });

    it("verifies Switzerland (CH) currencies: CHF, CHW, CHE", () => {
      const ch = getCountryByCode("CH");
      expect(ch).toBeDefined();
      expect(ch?.currencies.map((c) => c.currencyCode)).toEqual(["CHF", "CHW", "CHE"]);
    });

    it("verifies Slovakia (SK) currencies spanning page boundary (SKK Page 13, EUR Page 14)", () => {
      const sk = getCountryByCode("SK");
      expect(sk).toBeDefined();
      expect(sk?.page).toBe(13);
      expect(sk?.currencies.map((c) => c.currencyCode)).toEqual(["SKK", "EUR"]);
      expect(sk?.currencies[0].page).toBe(13);
      expect(sk?.currencies[1].page).toBe(14);
      expect(sk?.currencies[1].currencyName).toBe("Euro (Effective 1 January 2009)");
    });

    it("verifies El Salvador (SV) currencies: SVC, USD", () => {
      const sv = getCountryByCode("SV");
      expect(sv).toBeDefined();
      expect(sv?.currencies.map((c) => c.currencyCode)).toEqual(["SVC", "USD"]);
    });

    it("verifies Panama (PA) currencies: PAB, USD", () => {
      const pa = getCountryByCode("PA");
      expect(pa).toBeDefined();
      expect(pa?.currencies.map((c) => c.currencyCode)).toEqual(["PAB", "USD"]);
    });
  });

  describe("3. Multi-line Wrapped Entries & Complex Layouts", () => {
    it("correctly reconstructs multi-line wrapped country names", () => {
      const um = getCountryByCode("UM");
      expect(um).toBeDefined();
      expect(um?.countryName).toBe("UNITED STATES MINOR OUTLYING ISLANDS");

      const kp = getCountryByCode("KP");
      expect(kp).toBeDefined();
      expect(kp?.countryName).toBe("KOREA, DEMOCRATIC PEOPLE’S REPUBLIC OF");

      const imf = ABI_COUNTRY_CURRENCY_CODES.find((c) => c.countryName.includes("INTERNATIONAL MONETARY"));
      expect(imf).toBeDefined();
      expect(imf?.countryName).toBe("INTERNATIONAL MONETARY FUND (I.M.F.)");
    });
  });

  describe("4. Documented Discrepancies & Non-Standard / CBP-Specific Codes", () => {
    it("handles BURMA (MM) and supports BU flagged from Page 5 Change Log item 3", () => {
      const mm = getCountryByCode("MM");
      expect(mm).toBeDefined();
      expect(mm?.countryName).toBe("BURMA");
      expect(mm?.notes).toContain("Removed MM (Myanmar) and added BU (Burma)");

      // Both MM and BU return valid in helper function
      expect(isValidCountryCode("MM")).toBe(true);
      expect(isValidCountryCode("BU")).toBe(true);

      const buLookup = getCountryByCode("BU");
      expect(buLookup).toBeDefined();
      expect(buLookup?.countryName).toBe("BURMA");
    });

    it("flags non-standard / CBP-specific entity codes (IMF, GZ, WE, KV)", () => {
      const gz = getCountryByCode("GZ");
      expect(gz).toBeDefined();
      expect(gz?.countryName).toBe("GAZA STRIP");
      expect(gz?.isNonStandardIso).toBe(true);

      const we = getCountryByCode("WE");
      expect(we).toBeDefined();
      expect(we?.countryName).toBe("WEST BANK");
      expect(we?.isNonStandardIso).toBe(true);

      const kv = getCountryByCode("KV");
      expect(kv).toBeDefined();
      expect(kv?.countryName).toBe("KOSOVO");
      expect(kv?.isNonStandardIso).toBe(true);
    });

    it("verifies Serbia (RS) currency spelling 'Servian Dinar' from source PDF", () => {
      const rs = getCountryByCode("RS");
      expect(rs).toBeDefined();
      expect(rs?.currencyName).toBe("Servian Dinar");
      expect(rs?.currencyCode).toBe("RSD");
    });
  });

  describe("5. Lookup Functions & Helpers", () => {
    it("validates 2-letter country codes with case-insensitivity and whitespace tolerance", () => {
      expect(isValidCountryCode("US")).toBe(true);
      expect(isValidCountryCode("us")).toBe(true);
      expect(isValidCountryCode(" CA ")).toBe(true);
      expect(isValidCountryCode("GB")).toBe(true);
      expect(isValidCountryCode("CN")).toBe(true);
      expect(isValidCountryCode("DE")).toBe(true);

      expect(isValidCountryCode("XX")).toBe(false);
      expect(isValidCountryCode("12")).toBe(false);
      expect(isValidCountryCode("")).toBe(false);
    });

    it("validates 3-letter currency codes with case-insensitivity and whitespace tolerance", () => {
      expect(isValidCurrencyCode("USD")).toBe(true);
      expect(isValidCurrencyCode("usd")).toBe(true);
      expect(isValidCurrencyCode(" EUR ")).toBe(true);
      expect(isValidCurrencyCode("GBP")).toBe(true);
      expect(isValidCurrencyCode("JPY")).toBe(true);
      expect(isValidCurrencyCode("USS")).toBe(true); // Banking code
      expect(isValidCurrencyCode("USN")).toBe(true); // Banking code

      expect(isValidCurrencyCode("XYZ")).toBe(false);
      expect(isValidCurrencyCode("123")).toBe(false);
      expect(isValidCurrencyCode("")).toBe(false);
    });

    it("retrieves currency details by country code using getCurrenciesForCountry()", () => {
      const usCurrencies = getCurrenciesForCountry("US");
      expect(usCurrencies.length).toBe(3);
      expect(usCurrencies.map((c) => c.currencyCode)).toEqual(["USD", "USS", "USN"]);

      const chCurrencies = getCurrenciesForCountry("CH");
      expect(chCurrencies.length).toBe(3);
      expect(chCurrencies.map((c) => c.currencyCode)).toEqual(["CHF", "CHW", "CHE"]);

      const invalidCurrencies = getCurrenciesForCountry("XX");
      expect(invalidCurrencies).toEqual([]);
    });
  });
});
