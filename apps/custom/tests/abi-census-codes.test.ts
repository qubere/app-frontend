import { describe, expect, it } from "vitest";
import {
  ABI_CENSUS_OVERRIDE_CODES,
  ABI_CENSUS_WARNING_CONDITIONS,
  getCensusOverrideCode,
  getCensusWarningCondition,
  getValidOverrideCodesForWarning,
  isOverrideValidForWarning,
  isValidCensusOverrideCode
} from "../src/lib/abi/censusCodes";

describe("CATAIR Appendix H - Census Warning Messages & Override Codes Reference Data", () => {
  describe("Census Override Codes (Pages 18-19)", () => {
    it("should contain exactly 30 unique Census Override Codes", () => {
      expect(ABI_CENSUS_OVERRIDE_CODES).toHaveLength(30);

      const codeSet = new Set(ABI_CENSUS_OVERRIDE_CODES.map((c) => c.code));
      expect(codeSet.size).toBe(30);
    });

    it("should have expected structure and valid page citations (18 or 19) for all override codes", () => {
      for (const entry of ABI_CENSUS_OVERRIDE_CODES) {
        expect(entry.code).toMatch(/^\d{2}$/);
        expect(entry.description.length).toBeGreaterThan(0);
        expect(entry.comments.length).toBeGreaterThan(0);
        expect([18, 19]).toContain(entry.page);
      }
    });

    it("should contain specific landmark override codes from CATAIR Appendix H", () => {
      const code01 = getCensusOverrideCode("01");
      expect(code01).toBeDefined();
      expect(code01?.description).toBe("Exception to Embargo");
      expect(code01?.page).toBe(18);

      const code19 = getCensusOverrideCode("19");
      expect(code19).toBeDefined();
      expect(code19?.description).toBe("Rush Delivery");
      expect(code19?.comments).toBe("Importer paid increased cost for speedy delivery of the article.");
      expect(code19?.page).toBe(18);

      const code27 = getCensusOverrideCode("27");
      expect(code27).toBeDefined();
      expect(code27?.description).toBe("FTZ Withdrawal Low Foreign Value");
      expect(code27?.page).toBe(19);

      const code51 = getCensusOverrideCode("51");
      expect(code51).toBeDefined();
      expect(code51?.description).toBe("Entered under Special Conditions");
      expect(code51?.page).toBe(19);
    });

    it("should correctly validate override codes using isValidCensusOverrideCode", () => {
      expect(isValidCensusOverrideCode("01")).toBe(true);
      expect(isValidCensusOverrideCode("26")).toBe(true);
      expect(isValidCensusOverrideCode("50")).toBe(true);
      expect(isValidCensusOverrideCode("51")).toBe(true);
      expect(isValidCensusOverrideCode("99")).toBe(false);
      expect(isValidCensusOverrideCode("INVALID")).toBe(false);
    });
  });

  describe("Census Warning Conditions (Pages 6-17)", () => {
    it("should contain exactly 13 Census Warning Conditions (covering codes 27A-27Q and 28E)", () => {
      expect(ABI_CENSUS_WARNING_CONDITIONS).toHaveLength(13);

      const warningSet = new Set(ABI_CENSUS_WARNING_CONDITIONS.map((w) => w.warningCode));
      expect(warningSet.size).toBe(13);
    });

    it("should have valid schema and page citations (6 to 17) for all warning conditions", () => {
      for (const cond of ABI_CENSUS_WARNING_CONDITIONS) {
        expect(cond.warningCode).toMatch(/^(27|28)[A-Z]$/);
        expect(cond.fullWarningTitle).toContain("*CENSUS*");
        expect(cond.description.length).toBeGreaterThan(0);
        expect(cond.reason.length).toBeGreaterThan(0);
        expect(cond.resolution.length).toBeGreaterThan(0);
        expect(cond.allowedOverrideCodes.length).toBeGreaterThan(0);
        expect(cond.affectedRecordPositions.length).toBeGreaterThan(0);
        expect(cond.page).toBeGreaterThanOrEqual(6);
        expect(cond.page).toBeLessThanOrEqual(17);

        // Ensure all referenced allowed override codes exist in ABI_CENSUS_OVERRIDE_CODES
        for (const ovrCode of cond.allowedOverrideCodes) {
          expect(isValidCensusOverrideCode(ovrCode)).toBe(true);
        }
      }
    });

    it("should verify page 7 dual warning conditions (27B and 27M)", () => {
      const cond27B = getCensusWarningCondition("27B");
      expect(cond27B).toBeDefined();
      expect(cond27B?.fullWarningTitle).toBe("27B*CENSUS* QTY1/QTY2");
      expect(cond27B?.page).toBe(7);

      const cond27M = getCensusWarningCondition("27M");
      expect(cond27M).toBeDefined();
      expect(cond27M?.fullWarningTitle).toBe("27M*CENSUS* QTY2/QTY1");
      expect(cond27M?.page).toBe(7);

      expect(cond27B?.allowedOverrideCodes).toEqual(["09", "20", "21", "49", "50"]);
      expect(cond27M?.allowedOverrideCodes).toEqual(["09", "20", "21", "49", "50"]);
    });

    it("should verify maximum thresholds warning conditions (27P and 27Q)", () => {
      const cond27P = getCensusWarningCondition("27P");
      expect(cond27P).toBeDefined();
      expect(cond27P?.description).toContain("$100M");
      expect(cond27P?.allowedOverrideCodes).toEqual(["51"]);
      expect(cond27P?.page).toBe(16);

      const cond27Q = getCensusWarningCondition("27Q");
      expect(cond27Q).toBeDefined();
      expect(cond27Q?.description).toContain("$8M");
      expect(cond27Q?.allowedOverrideCodes).toEqual(["51"]);
      expect(cond27Q?.page).toBe(17);
    });

    it("should correctly validate allowed override codes for warning conditions", () => {
      // 27A Improbable Country allows 01, 02, 03, 49, 50
      expect(isOverrideValidForWarning("27A", "01")).toBe(true);
      expect(isOverrideValidForWarning("27A", "03")).toBe(true);
      expect(isOverrideValidForWarning("27A", "50")).toBe(true);
      expect(isOverrideValidForWarning("27A", "51")).toBe(false);

      // 27P Maximum Value Exceeded only allows 51
      expect(isOverrideValidForWarning("27P", "51")).toBe(true);
      expect(isOverrideValidForWarning("27P", "50")).toBe(false);
      expect(isOverrideValidForWarning("27P", "01")).toBe(false);

      // 27G Improbable Air Tariff allows 05, 49, 50
      expect(getValidOverrideCodesForWarning("27G")).toEqual(["05", "49", "50"]);
    });
  });
});
