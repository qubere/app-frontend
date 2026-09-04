import { describe, expect, it } from "vitest";
import {
  ABI_UNITS_OF_MEASURE,
  ABI_UNIT_OF_MEASURE_MAP,
  ABI_UNIT_OF_MEASURE_SET,
  getUnitOfMeasureEntry,
  isValidUnitOfMeasure,
} from "../src/lib/abi/unitsOfMeasure";

/**
 * CATAIR Appendix B: Units of Measure Unit Test Suite
 * Source PDF: docs/plans/catair-source-docs/appendix-b-valid-codes.pdf (Pages 22-25)
 */
describe("CATAIR Appendix B: Units of Measure Reference Data", () => {
  describe("1. Record Count & Structure Validation", () => {
    it("contains exactly 255 total Units of Measure codes", () => {
      expect(ABI_UNITS_OF_MEASURE.length).toBe(255);
      expect(ABI_UNIT_OF_MEASURE_MAP.size).toBe(255);
      expect(ABI_UNIT_OF_MEASURE_SET.size).toBe(255);
    });

    it("has exact page distribution across pages 22-25", () => {
      const page22 = ABI_UNITS_OF_MEASURE.filter((e) => e.page === 22);
      const page23 = ABI_UNITS_OF_MEASURE.filter((e) => e.page === 23);
      const page24 = ABI_UNITS_OF_MEASURE.filter((e) => e.page === 24);
      const page25 = ABI_UNITS_OF_MEASURE.filter((e) => e.page === 25);

      expect(page22.length).toBe(71);
      expect(page23.length).toBe(78);
      expect(page24.length).toBe(77);
      expect(page25.length).toBe(29);
      expect(page22.length + page23.length + page24.length + page25.length).toBe(255);
    });

    it("contains exactly 30 updated or new codes marked with asterisk (*)", () => {
      const updatedOrNew = ABI_UNITS_OF_MEASURE.filter((e) => e.isUpdatedOrNew);
      expect(updatedOrNew.length).toBe(30);
    });

    it("ensures every code is a valid 1 to 4 character code with non-empty description and page number", () => {
      for (const entry of ABI_UNITS_OF_MEASURE) {
        expect(entry.code).toMatch(/^[A-Z0-9]{1,4}$/);
        expect(entry.description).toBeTruthy();
        expect(entry.description.trim().length).toBeGreaterThan(0);
        expect([22, 23, 24, 25]).toContain(entry.page);
        expect(typeof entry.isUpdatedOrNew).toBe("boolean");
      }
    });

    it("contains zero duplicate UOM codes", () => {
      const codes = ABI_UNITS_OF_MEASURE.map((e) => e.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe("2. Document Citation & Page Boundary Verifications", () => {
    it("verifies Page 22 boundary entries and key codes (AC, AST, BBL, BX, BZ, C, CV)", () => {
      // First entry on Page 22
      const ac = getUnitOfMeasureEntry("AC");
      expect(ac).toBeDefined();
      expect(ac?.description).toBe("Alternating Current");
      expect(ac?.page).toBe(22);

      // Multiline entry on Page 22 (American Society for Testing Materials*)
      const ast = getUnitOfMeasureEntry("AST");
      expect(ast).toBeDefined();
      expect(ast?.description).toBe("American Society for Testing Materials*");
      expect(ast?.page).toBe(22);
      expect(ast?.isUpdatedOrNew).toBe(true);

      // Common UOM: BBL (Barrels)
      const bbl = getUnitOfMeasureEntry("BBL");
      expect(bbl).toBeDefined();
      expect(bbl?.description).toBe("Barrels");
      expect(bbl?.page).toBe(22);

      // Common UOM: BX (Box)
      const bx = getUnitOfMeasureEntry("BX");
      expect(bx).toBeDefined();
      expect(bx?.description).toBe("Box");
      expect(bx?.page).toBe(22);

      // Last entry of Page 22 Left Column: BZ
      const bz = getUnitOfMeasureEntry("BZ");
      expect(bz).toBeDefined();
      expect(bz?.description).toBe("Bars, In Bundle/Bunch/Truss");
      expect(bz?.page).toBe(22);

      // First entry of Page 22 Right Column: C
      const celsius = getUnitOfMeasureEntry("C");
      expect(celsius).toBeDefined();
      expect(celsius?.description).toBe("Celsius");
      expect(celsius?.page).toBe(22);

      // Last entry of Page 22 Right Column: CV
      const cv = getUnitOfMeasureEntry("CV");
      expect(cv).toBeDefined();
      expect(cv?.description).toBe("Cover");
      expect(cv?.page).toBe(22);
    });

    it("verifies Page 23 boundary entries and key codes (CX, DOZ, FT, G, GAL, KG, KW, KWH, L, LB, M, MB)", () => {
      // First entry on Page 23
      const cx = getUnitOfMeasureEntry("CX");
      expect(cx).toBeDefined();
      expect(cx?.description).toBe("Can, Cylindrical");
      expect(cx?.page).toBe(23);

      // Common UOM: DOZ (Dozen)
      const doz = getUnitOfMeasureEntry("DOZ");
      expect(doz).toBeDefined();
      expect(doz?.description).toBe("Dozen");
      expect(doz?.page).toBe(23);

      // Length UOM: FT (Feet)
      const ft = getUnitOfMeasureEntry("FT");
      expect(ft).toBeDefined();
      expect(ft?.description).toBe("Feet (Length)");
      expect(ft?.page).toBe(23);

      // Mass UOM: G (Gram)
      const g = getUnitOfMeasureEntry("G");
      expect(g).toBeDefined();
      expect(g?.description).toBe("Gram");
      expect(g?.page).toBe(23);

      // Volume UOM: GAL
      const gal = getUnitOfMeasureEntry("GAL");
      expect(gal).toBeDefined();
      expect(gal?.description).toBe("(US)(Volume)");
      expect(gal?.page).toBe(23);

      // Common UOM: KG (Kilogram)
      const kg = getUnitOfMeasureEntry("KG");
      expect(kg).toBeDefined();
      expect(kg?.description).toBe("1,000 Grams (kilogram)");
      expect(kg?.page).toBe(23);

      // Power UOM: KW (Kilowatts)
      const kw = getUnitOfMeasureEntry("KW");
      expect(kw).toBeDefined();
      expect(kw?.description).toBe("Kilowatts");
      expect(kw?.page).toBe(23);

      // Volume UOM: L (Liter)
      const liter = getUnitOfMeasureEntry("L");
      expect(liter).toBeDefined();
      expect(liter?.description).toBe("Liter");
      expect(liter?.page).toBe(23);

      // Weight UOM: LB (Pounds)
      const lb = getUnitOfMeasureEntry("LB");
      expect(lb).toBeDefined();
      expect(lb?.description).toBe("Pounds, (weight) avdp)");
      expect(lb?.page).toBe(23);

      // Length UOM: M (Meters)
      const meters = getUnitOfMeasureEntry("M");
      expect(meters).toBeDefined();
      expect(meters?.description).toBe("Meters");
      expect(meters?.page).toBe(23);

      // Last entry on Page 23
      const mb = getUnitOfMeasureEntry("MB");
      expect(mb).toBeDefined();
      expect(mb?.description).toBe("Multi-ply Bag");
      expect(mb?.page).toBe(23);
    });

    it("verifies Page 24 boundary entries and key codes (MBQ, NO, OZ, PCS, PTU, PU, PZ, SS, STN, TB)", () => {
      // First entry on Page 24
      const mbq = getUnitOfMeasureEntry("MBQ");
      expect(mbq).toBeDefined();
      expect(mbq?.description).toBe("Megabecquerel");
      expect(mbq?.page).toBe(24);

      // Common UOM: NO (Number)
      const no = getUnitOfMeasureEntry("NO");
      expect(no).toBeDefined();
      expect(no?.description).toBe("Number");
      expect(no?.page).toBe(24);

      // Weight UOM: OZ (Ounces)
      const oz = getUnitOfMeasureEntry("OZ");
      expect(oz).toBeDefined();
      expect(oz?.description).toBe("Ounces, (weight) (avdp)");
      expect(oz?.page).toBe(24);

      // Common UOM: PCS (Pieces)
      const pcs = getUnitOfMeasureEntry("PCS");
      expect(pcs).toBeDefined();
      expect(pcs?.description).toBe("Pieces");
      expect(pcs?.page).toBe(24);

      // Page 24 Right Column Start: PTU
      const ptu = getUnitOfMeasureEntry("PTU");
      expect(ptu).toBeDefined();
      expect(ptu?.description).toBe("Plant Unit*");
      expect(ptu?.page).toBe(24);

      // Multi-line description: PU
      const pu = getUnitOfMeasureEntry("PU");
      expect(pu).toBeDefined();
      expect(pu?.description).toBe("Tray or Tray Pack");
      expect(pu?.page).toBe(24);

      // Multi-line description: PZ
      const pz = getUnitOfMeasureEntry("PZ");
      expect(pz).toBeDefined();
      expect(pz?.description).toBe("Planks or Pipes, In Bundle/Bunch/Truss");
      expect(pz?.page).toBe(24);

      // Deprecation notice entry: SS
      const ss = getUnitOfMeasureEntry("SS");
      expect(ss).toBeDefined();
      expect(ss?.description).toBe("Stem* [to be deprecated]");
      expect(ss?.page).toBe(24);
      expect(ss?.isUpdatedOrNew).toBe(true);

      // Weight UOM: STN (Short Ton)
      const stn = getUnitOfMeasureEntry("STN");
      expect(stn).toBeDefined();
      expect(stn?.description).toBe("Short Ton (2000 LB) (Weight)");
      expect(stn?.page).toBe(24);

      // Last entry of Page 24
      const tb = getUnitOfMeasureEntry("TB");
      expect(tb).toBeDefined();
      expect(tb?.description).toBe("Tub");
      expect(tb?.page).toBe(24);
    });

    it("verifies Page 25 boundary entries and key codes (TC, TON, VG, VI, VO, VQ, VR, VY, W, YD)", () => {
      // First entry on Page 25
      const tc = getUnitOfMeasureEntry("TC");
      expect(tc).toBeDefined();
      expect(tc?.description).toBe("Tea-Chest");
      expect(tc?.page).toBe(25);

      // Weight UOM: TON (Long Ton)
      const ton = getUnitOfMeasureEntry("TON");
      expect(ton).toBeDefined();
      expect(ton?.description).toBe("Long Ton (2,240 LB) (WGT)");
      expect(ton?.page).toBe(25);

      // Multi-line Bulk Gas UOM: VG
      const vg = getUnitOfMeasureEntry("VG");
      expect(vg).toBeDefined();
      expect(vg?.description).toBe("Bulk Gas (At 1031 MBAR and 15 degrees Celsius)");
      expect(vg?.page).toBe(25);

      // First entry of Page 25 Right Column: VI
      const vi = getUnitOfMeasureEntry("VI");
      expect(vi).toBeDefined();
      expect(vi?.description).toBe("Vial");
      expect(vi?.page).toBe(25);

      // Bulk UOMs: VO, VQ, VR, VY
      const vo = getUnitOfMeasureEntry("VO");
      expect(vo?.description).toBe("Bulk, Solid, Large Particles (“Nodules”)");

      const vq = getUnitOfMeasureEntry("VQ");
      expect(vq?.description).toBe("Bulk, Liquified Gas (At Normal Temperature)");

      const vr = getUnitOfMeasureEntry("VR");
      expect(vr?.description).toBe("Bulk, Solid, Granular Particles (“Grains”)");

      const vy = getUnitOfMeasureEntry("VY");
      expect(vy?.description).toBe("Bulk, Solid, Fine Particles (“Powders”)");

      // Power UOM: W (Watts)
      const watts = getUnitOfMeasureEntry("W");
      expect(watts).toBeDefined();
      expect(watts?.description).toBe("Watts");
      expect(watts?.page).toBe(25);

      // Final entry of Appendix B Units of Measure (Page 25): YD
      const yd = getUnitOfMeasureEntry("YD");
      expect(yd).toBeDefined();
      expect(yd?.description).toBe("Yards (Length)");
      expect(yd?.page).toBe(25);
    });
  });

  describe("3. Lookup & Validation Helper Functions", () => {
    it("validates known UOM codes correctly with isValidUnitOfMeasure", () => {
      expect(isValidUnitOfMeasure("KG")).toBe(true);
      expect(isValidUnitOfMeasure("L")).toBe(true);
      expect(isValidUnitOfMeasure("BBL")).toBe(true);
      expect(isValidUnitOfMeasure("DOZ")).toBe(true);
      expect(isValidUnitOfMeasure("CM3")).toBe(true);
      expect(isValidUnitOfMeasure("STN")).toBe(true);
    });

    it("handles whitespace and case insensitivity gracefully", () => {
      expect(isValidUnitOfMeasure("  kg  ")).toBe(true);
      expect(isValidUnitOfMeasure("l")).toBe(true);
      expect(isValidUnitOfMeasure("bbl")).toBe(true);
      expect(getUnitOfMeasureEntry(" kg ")?.code).toBe("KG");
      expect(getUnitOfMeasureEntry("doz")?.description).toBe("Dozen");
    });

    it("returns false / undefined for invalid or empty UOM codes", () => {
      expect(isValidUnitOfMeasure("INVALID")).toBe(false);
      expect(isValidUnitOfMeasure("XYZ123")).toBe(false);
      expect(isValidUnitOfMeasure("")).toBe(false);
      expect(getUnitOfMeasureEntry("UNKNOWN")).toBeUndefined();
      expect(getUnitOfMeasureEntry("")).toBeUndefined();
    });
  });
});
