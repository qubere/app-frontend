import { describe, expect, it } from "vitest";
import {
  ABI_GOVERNMENT_AGENCY_CODES,
  ABI_GOVERNMENT_AGENCY_CODE_MAP,
  ABI_GOVERNMENT_AGENCY_CODE_SET,
  getGovernmentAgencyCodeEntry,
  isValidGovernmentAgencyCode,
} from "../src/lib/abi/governmentAgencyCodes";

/**
 * CATAIR Appendix V: Government Agency Codes Unit Test Suite
 * Source PDF: docs/plans/catair-source-docs/appendix-v-government-agency-codes.pdf (June 8, 2020, Pub # 0875-0419)
 */
describe("CATAIR Appendix V: Government Agency Codes Reference Data", () => {
  describe("1. Record Count & Structure Validation", () => {
    it("contains exactly 53 total Participating Government Agency (PGA) codes", () => {
      expect(ABI_GOVERNMENT_AGENCY_CODES.length).toBe(53);
      expect(ABI_GOVERNMENT_AGENCY_CODE_MAP.size).toBe(53);
      expect(ABI_GOVERNMENT_AGENCY_CODE_SET.size).toBe(53);
    });

    it("has exact page distribution: 27 codes on Page 3 and 26 codes on Page 4", () => {
      const page3Codes = ABI_GOVERNMENT_AGENCY_CODES.filter((e) => e.page === 3);
      const page4Codes = ABI_GOVERNMENT_AGENCY_CODES.filter((e) => e.page === 4);

      expect(page3Codes.length).toBe(27);
      expect(page4Codes.length).toBe(26);
      expect(page3Codes.length + page4Codes.length).toBe(53);
    });

    it("ensures every code is a 3-character uppercase string with a valid description and page number", () => {
      for (const entry of ABI_GOVERNMENT_AGENCY_CODES) {
        expect(entry.code).toMatch(/^[A-Z0-9]{3}$/);
        expect(entry.code.length).toBe(3);
        expect(entry.agencyName).toBeTruthy();
        expect(entry.agencyName.trim().length).toBeGreaterThan(0);
        expect([3, 4]).toContain(entry.page);
      }
    });

    it("contains zero duplicate agency codes", () => {
      const codes = ABI_GOVERNMENT_AGENCY_CODES.map((e) => e.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe("2. Document Citation & Spot Check Verifications", () => {
    it("verifies Page 3 boundary entries (ACE, FDA, CBP, EPA, BTS)", () => {
      // First entry on Page 3
      const ace = getGovernmentAgencyCodeEntry("ACE");
      expect(ace).toBeDefined();
      expect(ace?.agencyName).toBe("U.S. Department of Defense, Department of the Army, Army Corps of Engineers");
      expect(ace?.page).toBe(3);

      // Key agency: FDA
      const fda = getGovernmentAgencyCodeEntry("FDA");
      expect(fda).toBeDefined();
      expect(fda?.agencyName).toBe("U.S. Department of Health and Human Services, Food and Drug Administration");
      expect(fda?.page).toBe(3);

      // Key agency: CBP
      const cbp = getGovernmentAgencyCodeEntry("CBP");
      expect(cbp).toBeDefined();
      expect(cbp?.agencyName).toBe("U.S. Department of Homeland Security, Customs and Border Protection");
      expect(cbp?.page).toBe(3);

      // Key agency: EPA
      const epa = getGovernmentAgencyCodeEntry("EPA");
      expect(epa).toBeDefined();
      expect(epa?.agencyName).toBe("U.S. Environmental Protection Agency");
      expect(epa?.page).toBe(3);

      // Multi-line wrapped entry on Page 3: BTS
      const bts = getGovernmentAgencyCodeEntry("BTS");
      expect(bts).toBeDefined();
      expect(bts?.agencyName).toBe(
        "U.S. Department of Transportation, Research & Innovative Technology, Bureau of Transportation Statistics"
      );
      expect(bts?.page).toBe(3);
    });

    it("verifies Page 4 boundary entries (FHA, TTB, FWS, NMF, OMC, UTC)", () => {
      // First entry on Page 4
      const fha = getGovernmentAgencyCodeEntry("FHA");
      expect(fha).toBeDefined();
      expect(fha?.agencyName).toBe("U.S. Department of Transportation, Federal Highway Administration");
      expect(fha?.page).toBe(4);

      // Key agency: TTB
      const ttb = getGovernmentAgencyCodeEntry("TTB");
      expect(ttb).toBeDefined();
      expect(ttb?.agencyName).toBe("U.S. Department of the Treasury, Alcohol and Tobacco Tax and Trade Bureau");
      expect(ttb?.page).toBe(4);

      // Key agency: FWS
      const fws = getGovernmentAgencyCodeEntry("FWS");
      expect(fws).toBeDefined();
      expect(fws?.agencyName).toBe("U.S. Department of the Interior, Fish & Wildlife Service");
      expect(fws?.page).toBe(4);

      // Multi-line wrapped entry on Page 4: NMF
      const nmf = getGovernmentAgencyCodeEntry("NMF");
      expect(nmf).toBeDefined();
      expect(nmf?.agencyName).toBe(
        "U.S. Department of Commerce, National Oceanic and Atmospheric Administration, National Marine Fisheries"
      );
      expect(nmf?.page).toBe(4);

      // Multi-line wrapped entry on Page 4: OMC
      const omc = getGovernmentAgencyCodeEntry("OMC");
      expect(omc).toBeDefined();
      expect(omc?.agencyName).toBe(
        "U.S. Department of State, Bureau of Oceans and International Environmental and Scientific Affairs, Office of Marine Conservation"
      );
      expect(omc?.page).toBe(4);

      // Last entry on Page 4
      const utc = getGovernmentAgencyCodeEntry("UTC");
      expect(utc).toBeDefined();
      expect(utc?.agencyName).toBe("U.S. International Trade Commission");
      expect(utc?.page).toBe(4);
    });
  });

  describe("3. PDF Document Order & Anomaly Verification", () => {
    it("preserves exact source sequence of all 53 codes as printed in CATAIR Appendix V", () => {
      const expectedCodes = [
        // Page 3 (27)
        "ACE", "AMS", "APH", "ATF", "BIS", "BLS", "BTS", "CBC", "CBP", "CDC",
        "CGD", "CPS", "DCM", "DEA", "DEE", "DTC", "DOL", "ECO", "EIA", "EPA",
        "ETA", "EXI", "FAA", "FAS", "FCC", "FCN", "FDA",
        // Page 4 (26)
        "FHA", "FMC", "FMS", "FSI", "FTZ", "FWS", "GIP", "IDV", "ICE", "IRS",
        "MAR", "NHT", "NMF", "NRC", "OFA", "OFE", "OFM", "OGC", "OLM", "OMC",
        "OTX", "PHM", "TRP", "TSA", "TTB", "UTC"
      ];

      const actualCodes = ABI_GOVERNMENT_AGENCY_CODES.map((e) => e.code);
      expect(actualCodes).toEqual(expectedCodes);
    });

    it("documents and verifies the non-alphabetical ordering anomalies present in CBP's PDF document", () => {
      // Anomaly 1 on Page 3: DTC precedes DOL in official document
      const dtcIndex = ABI_GOVERNMENT_AGENCY_CODES.findIndex((e) => e.code === "DTC");
      const dolIndex = ABI_GOVERNMENT_AGENCY_CODES.findIndex((e) => e.code === "DOL");
      expect(dtcIndex).toBe(15);
      expect(dolIndex).toBe(16);
      expect(dtcIndex).toBeLessThan(dolIndex);

      // Anomaly 2 on Page 4: IDV precedes ICE in official document
      const idvIndex = ABI_GOVERNMENT_AGENCY_CODES.findIndex((e) => e.code === "IDV");
      const iceIndex = ABI_GOVERNMENT_AGENCY_CODES.findIndex((e) => e.code === "ICE");
      expect(idvIndex).toBe(34);
      expect(iceIndex).toBe(35);
      expect(idvIndex).toBeLessThan(iceIndex);
    });
  });

  describe("4. Helper & Lookup Function Behavior", () => {
    it("validates valid codes with case-insensitive and whitespace-trimmed input", () => {
      expect(isValidGovernmentAgencyCode("FDA")).toBe(true);
      expect(isValidGovernmentAgencyCode("fda")).toBe(true);
      expect(isValidGovernmentAgencyCode(" Fda ")).toBe(true);
      expect(isValidGovernmentAgencyCode("cbp")).toBe(true);
      expect(isValidGovernmentAgencyCode("epa")).toBe(true);
      expect(isValidGovernmentAgencyCode("ttb")).toBe(true);
    });

    it("rejects invalid codes", () => {
      expect(isValidGovernmentAgencyCode("XYZ")).toBe(false);
      expect(isValidGovernmentAgencyCode("123")).toBe(false);
      expect(isValidGovernmentAgencyCode("ABCD")).toBe(false);
      expect(isValidGovernmentAgencyCode("FD")).toBe(false);
      expect(isValidGovernmentAgencyCode("")).toBe(false);
      expect(isValidGovernmentAgencyCode("USA")).toBe(false);
    });

    it("retrieves entries cleanly with case-insensitive lookup", () => {
      const entry1 = getGovernmentAgencyCodeEntry("fda");
      expect(entry1?.code).toBe("FDA");
      expect(entry1?.agencyName).toBe("U.S. Department of Health and Human Services, Food and Drug Administration");

      const entry2 = getGovernmentAgencyCodeEntry("INVALID");
      expect(entry2).toBeUndefined();
    });
  });

  describe("5. Integration with PGA Message Set PG01 governmentAgencyCode Field", () => {
    it("validates PG01 governmentAgencyCode field inputs against official agency list", () => {
      const validPg01AgencyCodes = ["FDA", "EPA", "CBP", "TTB", "APH", "FWS", "CGD", "FCC"];
      for (const code of validPg01AgencyCodes) {
        expect(isValidGovernmentAgencyCode(code)).toBe(true);

        const entry = getGovernmentAgencyCodeEntry(code);
        expect(entry).toBeDefined();
        expect(entry?.code).toBe(code);
      }

      const invalidPg01AgencyCodes = ["PGA", "DHS", "DOT", "USDA", "DOJ", "999", "XXX"];
      for (const code of invalidPg01AgencyCodes) {
        expect(isValidGovernmentAgencyCode(code)).toBe(false);
      }
    });
  });
});
