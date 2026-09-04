import { describe, it, expect } from "vitest";
import {
  ABI_ENTRY_TYPE_CODES,
  ABI_VALID_ENTRY_TYPE_CODES,
  ABI_MODE_OF_TRANSPORTATION_CODES,
  ABI_EU_COUNTRY_CODES,
  isValidEntryTypeCode,
  getEntryTypeCodeEntry,
  isValidModeOfTransportationCode,
  getModeOfTransportationCodeEntry,
  isEuCountryCode,
  getEuCountryCodeEntry,
} from "@/lib/abi/validCodes";

describe("CATAIR Appendix B: Reference Data Extraction", () => {
  describe("Evidentiary Table Record Counts", () => {
    it("extracts exactly 47 entry type entries (7 category headers + 40 valid entry codes)", () => {
      expect(ABI_ENTRY_TYPE_CODES.length).toBe(47);
      expect(ABI_VALID_ENTRY_TYPE_CODES.length).toBe(40);
      const headers = ABI_ENTRY_TYPE_CODES.filter((e) => e.isCategoryHeader);
      expect(headers.length).toBe(7);
    });

    it("extracts exactly 15 Mode of Transportation codes", () => {
      expect(ABI_MODE_OF_TRANSPORTATION_CODES.length).toBe(15);
    });

    it("extracts exactly 27 European Union (EU) Country codes", () => {
      expect(ABI_EU_COUNTRY_CODES.length).toBe(27);
    });
  });

  describe("Entry Type Code Validation & Metadata", () => {
    it("validates core consumption entry types", () => {
      expect(isValidEntryTypeCode("01")).toBe(true);
      expect(isValidEntryTypeCode("02")).toBe(true);
      expect(isValidEntryTypeCode("03")).toBe(true);
      expect(isValidEntryTypeCode("06")).toBe(true);
      expect(isValidEntryTypeCode("07")).toBe(true);
      expect(isValidEntryTypeCode("08")).toBe(true);
      expect(isValidEntryTypeCode("09")).toBe(true);
    });

    it("validates informal, warehouse, drawback, and transportation entry types", () => {
      expect(isValidEntryTypeCode("11")).toBe(true);
      expect(isValidEntryTypeCode("12")).toBe(true);
      expect(isValidEntryTypeCode("13")).toBe(true);
      expect(isValidEntryTypeCode("21")).toBe(true);
      expect(isValidEntryTypeCode("22")).toBe(true);
      expect(isValidEntryTypeCode("23")).toBe(true);
      expect(isValidEntryTypeCode("31")).toBe(true);
      expect(isValidEntryTypeCode("32")).toBe(true);
      expect(isValidEntryTypeCode("41")).toBe(true);
      expect(isValidEntryTypeCode("47")).toBe(true);
      expect(isValidEntryTypeCode("51")).toBe(true);
      expect(isValidEntryTypeCode("61")).toBe(true);
      expect(isValidEntryTypeCode("62")).toBe(true);
      expect(isValidEntryTypeCode("63")).toBe(true);
      expect(isValidEntryTypeCode("86")).toBe(true);
      expect(isValidEntryTypeCode("90")).toBe(true);
    });

    it("handles numeric input by zero-padding to 2 digits", () => {
      expect(isValidEntryTypeCode(1)).toBe(true);
      expect(getEntryTypeCodeEntry(1)?.code).toBe("01");
      expect(isValidEntryTypeCode(6)).toBe(true);
      expect(getEntryTypeCodeEntry(6)?.code).toBe("06");
    });

    it("rejects category headers as valid entry filing codes", () => {
      expect(isValidEntryTypeCode("00")).toBe(false);
      expect(isValidEntryTypeCode("10")).toBe(false);
      expect(isValidEntryTypeCode("20")).toBe(false);
      expect(isValidEntryTypeCode("30")).toBe(false);
      expect(isValidEntryTypeCode("40")).toBe(false);
      expect(isValidEntryTypeCode("50")).toBe(false);
      expect(isValidEntryTypeCode("60")).toBe(false);
    });

    it("rejects invalid or unassigned entry type codes", () => {
      expect(isValidEntryTypeCode("99")).toBe(false);
      expect(isValidEntryTypeCode("14")).toBe(false);
      expect(isValidEntryTypeCode("999")).toBe(false);
      expect(isValidEntryTypeCode("ABC")).toBe(false);
    });

    it("correctly identifies filing status annotations (*, **, ***)", () => {
      // *** Approved for EIP/RLF Filing
      expect(getEntryTypeCodeEntry("01")?.filingStatus).toBe("approved_eip_rlf");
      expect(getEntryTypeCodeEntry("11")?.filingStatus).toBe("approved_eip_rlf");

      // * Not appropriate for automated filing
      expect(getEntryTypeCodeEntry("04")?.filingStatus).toBe("not_appropriate");
      expect(getEntryTypeCodeEntry("05")?.filingStatus).toBe("not_appropriate");

      // ** Not approved for automated filing
      expect(getEntryTypeCodeEntry("24")?.filingStatus).toBe("not_approved");
      expect(getEntryTypeCodeEntry("25")?.filingStatus).toBe("not_approved");
      expect(getEntryTypeCodeEntry("26")?.filingStatus).toBe("not_approved");
      expect(getEntryTypeCodeEntry("33")?.filingStatus).toBe("not_approved");
      expect(getEntryTypeCodeEntry("64")?.filingStatus).toBe("not_approved");
      expect(getEntryTypeCodeEntry("65")?.filingStatus).toBe("not_approved");
      expect(getEntryTypeCodeEntry("66")?.filingStatus).toBe("not_approved");

      // Standard approved entry types
      expect(getEntryTypeCodeEntry("02")?.filingStatus).toBe("standard");
      expect(getEntryTypeCodeEntry("21")?.filingStatus).toBe("standard");
    });
  });

  describe("Mode of Transportation Code Validation & Metadata", () => {
    it("validates all 15 modes of transportation", () => {
      const validMotCodes = [
        "10", "11", "12", "20", "21", "30", "31", "32", "33", "34", "40", "41", "50", "60", "70",
      ];
      for (const code of validMotCodes) {
        expect(isValidModeOfTransportationCode(code)).toBe(true);
      }
    });

    it("handles numeric input by zero-padding to 2 digits", () => {
      expect(isValidModeOfTransportationCode(10)).toBe(true);
      expect(getModeOfTransportationCodeEntry(10)?.description).toContain("Vessel");
      expect(isValidModeOfTransportationCode(40)).toBe(true);
      expect(getModeOfTransportationCodeEntry(40)?.description).toContain("Air");
    });

    it("rejects invalid mode of transportation codes", () => {
      expect(isValidModeOfTransportationCode("00")).toBe(false);
      expect(isValidModeOfTransportationCode("15")).toBe(false);
      expect(isValidModeOfTransportationCode("99")).toBe(false);
      expect(isValidModeOfTransportationCode("AIR")).toBe(false);
    });

    it("verifies accurate descriptions for vessel, rail, truck, air, mail, and pipeline", () => {
      expect(getModeOfTransportationCodeEntry("10")?.description).toContain("Vessel, non-container");
      expect(getModeOfTransportationCodeEntry("11")?.description).toBe("Vessel, Container");
      expect(getModeOfTransportationCodeEntry("21")?.description).toBe("Rail, Container");
      expect(getModeOfTransportationCodeEntry("31")?.description).toBe("Truck, Container");
      expect(getModeOfTransportationCodeEntry("41")?.description).toBe("Air, Container");
      expect(getModeOfTransportationCodeEntry("50")?.description).toBe("Mail");
      expect(getModeOfTransportationCodeEntry("70")?.description).toContain("Fixed Transport Installations");
    });
  });

  describe("EU Country Code Validation & Metadata", () => {
    it("validates member countries of the European Union", () => {
      const euSamples = ["DE", "FR", "IT", "ES", "NL", "BE", "PL", "AT", "SE", "FI", "IE", "GR"];
      for (const code of euSamples) {
        expect(isEuCountryCode(code)).toBe(true);
      }
    });

    it("handles lowercase and trimmed input", () => {
      expect(isEuCountryCode(" de ")).toBe(true);
      expect(getEuCountryCodeEntry("fr")?.countryName).toBe("FRANCE");
    });

    it("rejects non-EU country codes", () => {
      expect(isEuCountryCode("US")).toBe(false);
      expect(isEuCountryCode("CA")).toBe(false);
      expect(isEuCountryCode("MX")).toBe(false);
      expect(isEuCountryCode("CN")).toBe(false);
      expect(isEuCountryCode("JP")).toBe(false);
    });

    it("verifies Brexit removal: GB and UK are NOT in EU country codes per Rev 16", () => {
      expect(isEuCountryCode("GB")).toBe(false);
      expect(isEuCountryCode("UK")).toBe(false);
    });
  });
});
