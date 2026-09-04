import { describe, it, expect } from "vitest";
import {
  validateEntryTypeCode,
  resolveQueryErrorCode,
  resolveDispositionActionCode,
} from "@/lib/abi/cargoManifestQuery/validate";

describe("Cargo Manifest Query opt-in reference-data validation helpers", () => {
  describe("validateEntryTypeCode", () => {
    it("accepts a real Appendix B entry type code (shared by WO10 and WR1-Output)", () => {
      expect(validateEntryTypeCode("01")).toBe(true);
    });

    it("rejects an unpublished entry type code", () => {
      expect(validateEntryTypeCode("99")).toBe(false);
    });
  });

  describe("resolveQueryErrorCode", () => {
    it("resolves a known ACE Error Dictionary code for the WR0-Record's Error Message ID", () => {
      const entries = resolveQueryErrorCode("861");
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].narrativeText).toBe("AUTO LICENSE INSUFFICIENT BALANCE");
    });

    it("returns an empty array for an unrecognized code", () => {
      expect(resolveQueryErrorCode("NOPE99")).toEqual([]);
    });
  });

  describe("resolveDispositionActionCode", () => {
    it("resolves all matching entries for a WO60-Record Disposition Action Code, since these codes are context-dependent and not globally unique", () => {
      const entries = resolveDispositionActionCode("003");
      expect(entries.length).toBeGreaterThan(1);
    });

    it("returns an empty array for an unrecognized code", () => {
      expect(resolveDispositionActionCode("NOPE99")).toEqual([]);
    });
  });
});
