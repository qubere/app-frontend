import { describe, expect, it } from "vitest";
import {
  ABI_EQUIPMENT_DESCRIPTION_CODES,
  ABI_EQUIPMENT_DESCRIPTION_CODE_MAP,
  ABI_EQUIPMENT_DESCRIPTION_CODE_SET,
  getEquipmentDescriptionCodeEntry,
  isValidEquipmentDescriptionCode,
} from "../src/lib/abi/equipmentDescriptionCodes";

/**
 * CATAIR Appendix B: Equipment Description Codes Unit Test Suite
 * Source PDF: docs/plans/catair-source-docs/appendix-b-valid-codes.pdf (Pages 28-31)
 */
describe("CATAIR Appendix B: Equipment Description Codes Reference Data", () => {
  describe("1. Record Count & Structure Validation", () => {
    it("contains exactly 133 total Equipment Description codes", () => {
      expect(ABI_EQUIPMENT_DESCRIPTION_CODES.length).toBe(133);
      expect(ABI_EQUIPMENT_DESCRIPTION_CODE_MAP.size).toBe(133);
      expect(ABI_EQUIPMENT_DESCRIPTION_CODE_SET.size).toBe(133);
    });

    it("has exact page distribution across pages 28-31", () => {
      const page28 = ABI_EQUIPMENT_DESCRIPTION_CODES.filter((e) => e.page === 28);
      const page29 = ABI_EQUIPMENT_DESCRIPTION_CODES.filter((e) => e.page === 29);
      const page30 = ABI_EQUIPMENT_DESCRIPTION_CODES.filter((e) => e.page === 30);
      const page31 = ABI_EQUIPMENT_DESCRIPTION_CODES.filter((e) => e.page === 31);

      expect(page28.length).toBe(44);
      expect(page29.length).toBe(40);
      expect(page30.length).toBe(40);
      expect(page31.length).toBe(9);
      expect(page28.length + page29.length + page30.length + page31.length).toBe(133);
    });

    it("ensures every code is a 2-character alphanumeric string with valid description and page number", () => {
      for (const entry of ABI_EQUIPMENT_DESCRIPTION_CODES) {
        expect(entry.code).toMatch(/^[A-Z0-9]{2}$/);
        expect(entry.code.length).toBe(2);
        expect(entry.description).toBeTruthy();
        expect(entry.description.trim().length).toBeGreaterThan(0);
        expect([28, 29, 30, 31]).toContain(entry.page);
      }
    });

    it("contains zero duplicate equipment description codes", () => {
      const codes = ABI_EQUIPMENT_DESCRIPTION_CODES.map((e) => e.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe("2. Document Citation & Spot Check Verifications", () => {
    it("verifies Page 28 boundary and key entries (20, 2B, CA, CB, CZ)", () => {
      // First entry on Page 28 (Left Column)
      const code20 = getEquipmentDescriptionCodeEntry("20");
      expect(code20).toBeDefined();
      expect(code20?.description).toBe("20 ft IL Container (Open Top)");
      expect(code20?.page).toBe(28);

      // Second entry on Page 28
      const code2B = getEquipmentDescriptionCodeEntry("2B");
      expect(code2B).toBeDefined();
      expect(code2B?.description).toBe("20 ft. IL Container (Closed Top)");
      expect(code2B?.page).toBe(28);

      // Last entry on Page 28 Left Column
      const codeCA = getEquipmentDescriptionCodeEntry("CA");
      expect(codeCA).toBeDefined();
      expect(codeCA?.description).toBe("Caboose");
      expect(codeCA?.page).toBe(28);

      // First entry on Page 28 Right Column
      const codeCB = getEquipmentDescriptionCodeEntry("CB");
      expect(codeCB).toBeDefined();
      expect(codeCB?.description).toBe("Chassie, Goose neck");
      expect(codeCB?.page).toBe(28);

      // Last entry on Page 28 Right Column
      const codeCZ = getEquipmentDescriptionCodeEntry("CZ");
      expect(codeCZ).toBeDefined();
      expect(codeCZ?.description).toBe("Refrigerated Container");
      expect(codeCZ?.page).toBe(28);
    });

    it("verifies Page 29 boundary and multiline entries (DD, DF, FS, FX, HY, PP, RG)", () => {
      // First entry on Page 29 (Left Column)
      const codeDD = getEquipmentDescriptionCodeEntry("DD");
      expect(codeDD).toBeDefined();
      expect(codeDD?.description).toBe("Double Drop Tailer - A flatbed with two drop decks");
      expect(codeDD?.page).toBe(29);

      // Multiline entry DF
      const codeDF = getEquipmentDescriptionCodeEntry("DF");
      expect(codeDF).toBeDefined();
      expect(codeDF?.description).toBe(
        "Container with Flush Doors - Container doors must be flush with the inside walls of the ocean-type containers"
      );
      expect(codeDF?.page).toBe(29);

      // Multiline entry FS
      const codeFS = getEquipmentDescriptionCodeEntry("FS");
      expect(codeFS).toBeDefined();
      expect(codeFS?.description).toBe(
        "Container with Floor Securing Rings - Appliances at floor level that can be used to secure cargo"
      );

      // Single line FX with verbatim truncation from source
      const codeFX = getEquipmentDescriptionCodeEntry("FX");
      expect(codeFX).toBeDefined();
      expect(codeFX?.description).toBe("Boxcar Cushion Under Frame of");

      // First entry on Page 29 Right Column (complex multiline description)
      const codeHY = getEquipmentDescriptionCodeEntry("HY");
      expect(codeHY).toBeDefined();
      expect(codeHY?.description).toBe(
        "Hydrant Cart – Used at large airports with installed distribution systems to make into plane deliveries; distinguished from other types of fueling vehicles"
      );
      expect(codeHY?.page).toBe(29);

      // Multiline entry PP
      const codePP = getEquipmentDescriptionCodeEntry("PP");
      expect(codePP).toBeDefined();
      expect(codePP?.description).toBe(
        "Power Pack – A container holding a motor, generator, and fuel tank; used to provide power to refrigerated containers on a double stack train"
      );

      // Last entry on Page 29 Right Column
      const codeRG = getEquipmentDescriptionCodeEntry("RG");
      expect(codeRG).toBeDefined();
      expect(codeRG?.description).toBe("Gondola Covered");
      expect(codeRG?.page).toBe(29);
    });

    it("verifies Page 30 boundary and multiline entries (RI, SR, SS, TW, UE, UL)", () => {
      // First entry on Page 30 (Left Column)
      const codeRI = getEquipmentDescriptionCodeEntry("RI");
      expect(codeRI).toBeDefined();
      expect(codeRI?.description).toBe("Gondola Car (Covered – Interior Bulkheads)");
      expect(codeRI?.page).toBe(30);

      // Multiline entry SR
      const codeSR = getEquipmentDescriptionCodeEntry("SR");
      expect(codeSR).toBeDefined();
      expect(codeSR?.description).toBe(
        "Stak-Rak - A device upon which empty chassis may be stacked for movement “En Bloc” on a railcar, stack train, trailer, or water-borne vessel."
      );

      // Multiline entry SS
      const codeSS = getEquipmentDescriptionCodeEntry("SS");
      expect(codeSS).toBeDefined();
      expect(codeSS?.description).toBe("Container with Smooth Sides - Walls in ocean container must be flat/smooth.");

      // Multiline entry TW on Page 30 Right Column
      const codeTW = getEquipmentDescriptionCodeEntry("TW");
      expect(codeTW).toBeDefined();
      expect(codeTW?.description).toBe(
        "Trailer, Refrigerated - A refrigerated trailer capable of keeping product cold. Different from a temperature controlled trailer which is able to keep product at a constant temperature."
      );

      // Multiline entry UE
      const codeUE = getEquipmentDescriptionCodeEntry("UE");
      expect(codeUE).toBeDefined();
      expect(codeUE?.description).toBe("Trilevel Railcar Screened, With Door, No Roof");

      // Last entry on Page 30 Right Column
      const codeUL = getEquipmentDescriptionCodeEntry("UL");
      expect(codeUL).toBeDefined();
      expect(codeUL?.description).toBe("Unit Load Device (ULD)");
      expect(codeUL?.page).toBe(30);
    });

    it("verifies Page 31 boundary and key entries (UP, VA, VE, VT, WY)", () => {
      // First entry on Page 31 (Left Column)
      const codeUP = getEquipmentDescriptionCodeEntry("UP");
      expect(codeUP).toBeDefined();
      expect(codeUP?.description).toBe("Container, Upgraded - Container must be upgraded for higher weights.");
      expect(codeUP?.page).toBe(31);

      // Entry VA
      const codeVA = getEquipmentDescriptionCodeEntry("VA");
      expect(codeVA).toBeDefined();
      expect(codeVA?.description).toBe("Container, Vented - Dry container must have vent openings for air exchange.");

      // Entry VE
      const codeVE = getEquipmentDescriptionCodeEntry("VE");
      expect(codeVE).toBeDefined();
      expect(codeVE?.description).toBe("Vessel, Ocean");

      // Entry VT
      const codeVT = getEquipmentDescriptionCodeEntry("VT");
      expect(codeVT).toBeDefined();
      expect(codeVT?.description).toBe("Vessel, Ocean, Containership");

      // Final entry on Page 31 (Last entry in table)
      const codeWY = getEquipmentDescriptionCodeEntry("WY");
      expect(codeWY).toBeDefined();
      expect(codeWY?.description).toBe("Railroad Maintenance of Way Car");
      expect(codeWY?.page).toBe(31);
    });
  });

  describe("3. Lookup & Validation Helper Functions", () => {
    it("validates case-insensitive lookup and whitespace trimming", () => {
      expect(isValidEquipmentDescriptionCode("20")).toBe(true);
      expect(isValidEquipmentDescriptionCode("2b")).toBe(true);
      expect(isValidEquipmentDescriptionCode(" ac ")).toBe(true);
      expect(isValidEquipmentDescriptionCode("cz")).toBe(true);
      expect(isValidEquipmentDescriptionCode("wy")).toBe(true);

      const entry = getEquipmentDescriptionCodeEntry(" tw ");
      expect(entry).toBeDefined();
      expect(entry?.code).toBe("TW");
    });

    it("correctly rejects invalid, empty, or non-existent equipment description codes", () => {
      expect(isValidEquipmentDescriptionCode("")).toBe(false);
      expect(isValidEquipmentDescriptionCode("  ")).toBe(false);
      expect(isValidEquipmentDescriptionCode("ZZ")).toBe(false);
      expect(isValidEquipmentDescriptionCode("999")).toBe(false);
      expect(isValidEquipmentDescriptionCode("INVALID")).toBe(false);

      expect(getEquipmentDescriptionCodeEntry("ZZ")).toBeUndefined();
      expect(getEquipmentDescriptionCodeEntry("")).toBeUndefined();
    });
  });
});
