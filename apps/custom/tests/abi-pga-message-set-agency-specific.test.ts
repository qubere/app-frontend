import { describe, it, expect } from "vitest";
import { encodeRecord, decodeRecord } from "@/lib/abi/fixedWidth";
import { Decimal } from "@/lib/tariff/decimal";
import {
  PG05_SCIENTIFIC_SPECIES_SPEC,
  PG17_COMMON_NAME_VENOMOUS_SPEC,
  PG23_AFFIRMATION_OF_COMPLIANCE_SPEC,
  PG28_CAN_DIMENSIONS_TRACKING_SPEC,
  PG31_HARVESTING_VESSEL_SPEC,
  PG33_GEOGRAPHIC_AREA_SPEC,
  PG35_CONFORMANCE_BOND_SPEC,
} from "@/lib/abi/pgaMessageSet/recordSpecs";

/**
 * CATAIR PGA Message Set (Chapter 8) - Agency-Specific Variant Records Test Suite
 * Source: docs/plans/catair-source-docs/08-pga-message-set-2026-07.pdf
 *
 * Covers the 7 previously-deferred agency-specific record variants: PG05
 * (FWS, p.25), PG17 (FWS, p.33), PG23 (FDA, p.39), PG28 (FDA, p.44), PG31
 * (NOAA/NMFS, p.50), PG33 (NOAA/NMFS, p.52), PG35 (DOT/NHTSA, p.54).
 *
 * Implementation notes: this file previously defined its own locally-scoped
 * `RecordSpec` interface and 7 record constants and tested only those against
 * each other (positions contiguous, lengths sum to 80) — never against the
 * real `src/lib/abi/pgaMessageSet/` implementation. That's the same gap
 * already reconciled in `abi-pga-message-set-specs.test.ts` for the 28
 * generic backbone records. It now imports the real `RecordSpec`s and
 * exercises them via `encodeRecord`/`decodeRecord`. Shape differences from
 * the old local specs, reconciled below (cross-checked directly against the
 * source PDF pages cited above):
 *   - Every record's 2-char "Control Identifier" (always "PG") + 2-char
 *     numeric "Record Type" (e.g. "05") collapse into a single 4-char
 *     `constantField` (e.g. "PG05") at positions 1-4, same as every generic
 *     backbone record — not two separate fields.
 *   - PG28's three Can Dimension sub-fields (class "4N" per the PDF) use
 *     `numericCodeField`, not a plain class-N field: each dimension packs two
 *     2-digit values (inches, then 16ths) where a leading zero on the inches
 *     portion is semantically significant (e.g. "0308" = 3in + 8/16in), the
 *     same rationale `numericCodeField` documents for Entry Type Code/Surety
 *     Code-style identifiers — a plain `parseInt` decode would silently
 *     collapse "0308" to 308 and lose that structure.
 *   - PG31's Harvested Commodity Net Weight ("10N", "Two decimal spaces are
 *     implied") and PG35's DOT Bond Amount ("8N", "whole US dollars") are
 *     bound to `Decimal` via `impliedDecimalField` (2 and 0 implied decimals
 *     respectively — the same 0-implied-decimal "whole dollars" convention
 *     PG25's `pgaLineValue` already established), which encodes/decodes as
 *     class "SN", not the PDF's stated "N".
 *   - PG17's Cartons Containing Wildlife ("5N") is a genuine count, so it
 *     stays a plain class-N field decoding to `number` — unlike the Can
 *     Dimensions above, no leading-zero semantics apply.
 *   - No 8-char MMDDCCYY date fields appear in any of these 7 records (unlike
 *     PG06/PG14/PG22/PG25/PG30 in the generic backbone), so `dateFieldCCYY`
 *     is not used here.
 */

describe("PGA Message Set Agency-Specific Variant Records — 80-Column Spec Validation", () => {
  describe("PG05-Record (FWS/APHIS Scientific Genus/Species Detail, PDF p.25)", () => {
    it("has contiguous 1-indexed field positions summing to 80", () => {
      let expectedStart = 1;
      for (const field of PG05_SCIENTIFIC_SPECIES_SPEC.fields) {
        expect(field.start).toBe(expectedStart);
        expectedStart += field.length;
      }
      expect(expectedStart - 1).toBe(80);
    });

    it("field layout (positions/lengths/classes) matches PDF p.25", () => {
      const fields = Object.fromEntries(
        PG05_SCIENTIFIC_SPECIES_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
      );
      expect(fields.filler_1).toMatchObject({ start: 1, length: 4, class: "A", designation: "M", constant: "PG05" });
      expect(fields.scientificGenusName).toMatchObject({ start: 5, length: 22, class: "X", designation: "C" });
      expect(fields.scientificSpeciesName).toMatchObject({ start: 27, length: 22, class: "X", designation: "C" });
      expect(fields.scientificSubSpeciesName).toMatchObject({ start: 49, length: 18, class: "X", designation: "C" });
      expect(fields.scientificSpeciesCode).toMatchObject({ start: 67, length: 7, class: "AN", designation: "C" });
      expect(fields.fwsDescriptionCode).toMatchObject({ start: 74, length: 7, class: "AN", designation: "C" });

      const line = encodeRecord(PG05_SCIENTIFIC_SPECIES_SPEC, {
        scientificGenusName: "PANTHERA",
        scientificSpeciesName: "TIGRIS",
        scientificSpeciesCode: "MAM0012",
      });
      expect(line.slice(0, 4)).toBe("PG05");
      expect(line).toHaveLength(80);
      const decoded = decodeRecord(PG05_SCIENTIFIC_SPECIES_SPEC, line);
      expect(decoded.scientificGenusName).toBe("PANTHERA");
      expect(decoded.scientificSpeciesName).toBe("TIGRIS");
      expect(decoded.scientificSpeciesCode).toBe("MAM0012");
    });
  });

  describe("PG17-Record (FWS Common Name & Venomous/Cartons Detail, PDF p.33)", () => {
    it("has contiguous 1-indexed field positions summing to 80", () => {
      let expectedStart = 1;
      for (const field of PG17_COMMON_NAME_VENOMOUS_SPEC.fields) {
        expect(field.start).toBe(expectedStart);
        expectedStart += field.length;
      }
      expect(expectedStart - 1).toBe(80);
    });

    it("field layout matches PDF p.33 and Cartons Containing Wildlife round-trips as a plain count", () => {
      const fields = Object.fromEntries(
        PG17_COMMON_NAME_VENOMOUS_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
      );
      expect(fields.filler_1).toMatchObject({ start: 1, length: 4, class: "A", designation: "M", constant: "PG17" });
      expect(fields.commonNameSpecific).toMatchObject({ start: 5, length: 30, class: "X", designation: "C" });
      expect(fields.commonNameGeneral).toMatchObject({ start: 35, length: 30, class: "X", designation: "C" });
      expect(fields.liveVenomousWildlifeCode).toMatchObject({ start: 65, length: 1, class: "A", designation: "C" });
      expect(fields.cartonsContainingWildlife).toMatchObject({ start: 66, length: 5, class: "N", designation: "C" });
      expect(fields.filler_71).toMatchObject({ start: 71, length: 10, class: "S", designation: "M" });

      const line = encodeRecord(PG17_COMMON_NAME_VENOMOUS_SPEC, {
        commonNameSpecific: "COBRA",
        liveVenomousWildlifeCode: "Y",
        cartonsContainingWildlife: 42,
      });
      expect(line.slice(65, 70)).toBe("00042");
      const decoded = decodeRecord(PG17_COMMON_NAME_VENOMOUS_SPEC, line);
      expect(decoded.cartonsContainingWildlife).toBe(42);
      expect(decoded.liveVenomousWildlifeCode).toBe("Y");
    });
  });

  describe("PG23-Record (FDA Affirmation of Compliance, PDF p.39)", () => {
    it("has contiguous 1-indexed field positions summing to 80", () => {
      let expectedStart = 1;
      for (const field of PG23_AFFIRMATION_OF_COMPLIANCE_SPEC.fields) {
        expect(field.start).toBe(expectedStart);
        expectedStart += field.length;
      }
      expect(expectedStart - 1).toBe(80);
    });

    it("field layout matches PDF p.39, including the trailing 1-char filler", () => {
      const fields = Object.fromEntries(
        PG23_AFFIRMATION_OF_COMPLIANCE_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
      );
      expect(fields.filler_1).toMatchObject({ start: 1, length: 4, class: "A", designation: "M", constant: "PG23" });
      expect(fields.affirmationOfComplianceCode).toMatchObject({ start: 5, length: 5, class: "X", designation: "M" });
      expect(fields.affirmationOfComplianceDescription).toMatchObject({
        start: 10,
        length: 70,
        class: "X",
        designation: "C",
      });
      expect(fields.filler_80).toMatchObject({ start: 80, length: 1, class: "S", designation: "M" });

      const line = encodeRecord(PG23_AFFIRMATION_OF_COMPLIANCE_SPEC, {
        affirmationOfComplianceCode: "BTA",
        affirmationOfComplianceDescription: "USA",
      });
      expect(line).toHaveLength(80);
      expect(decodeRecord(PG23_AFFIRMATION_OF_COMPLIANCE_SPEC, line).affirmationOfComplianceCode).toBe("BTA");
    });
  });

  describe("PG28-Record (FDA Can Dimensions & Tracking Number, PDF p.44)", () => {
    it("has contiguous 1-indexed field positions summing to 80", () => {
      let expectedStart = 1;
      for (const field of PG28_CAN_DIMENSIONS_TRACKING_SPEC.fields) {
        expect(field.start).toBe(expectedStart);
        expectedStart += field.length;
      }
      expect(expectedStart - 1).toBe(80);
    });

    it("Can Dimensions preserve leading zeros as raw strings (numericCodeField), not lossy parseInt", () => {
      const fields = Object.fromEntries(
        PG28_CAN_DIMENSIONS_TRACKING_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
      );
      expect(fields.canDimensions1).toMatchObject({ start: 5, length: 4, class: "N", designation: "C" });
      expect(fields.canDimensions2).toMatchObject({ start: 9, length: 4, class: "N", designation: "C" });
      expect(fields.canDimensions3).toMatchObject({ start: 13, length: 4, class: "N", designation: "C" });
      expect(fields.packageTrackingNumberCode).toMatchObject({ start: 17, length: 4, class: "AN", designation: "C" });
      expect(fields.packageTrackingNumber).toMatchObject({ start: 21, length: 50, class: "AN", designation: "C" });
      expect(fields.filler_71).toMatchObject({ start: 71, length: 10, class: "S", designation: "M" });

      // 3 inches + 8/16ths = "0308" — the leading zero on the inches portion
      // is significant and must survive the round trip as a string.
      const line = encodeRecord(PG28_CAN_DIMENSIONS_TRACKING_SPEC, {
        canDimensions1: "0308",
        packageTrackingNumberCode: "ITN",
        packageTrackingNumber: "1Z999AA10123456784",
      });
      expect(line.slice(4, 8)).toBe("0308");
      const decoded = decodeRecord(PG28_CAN_DIMENSIONS_TRACKING_SPEC, line);
      expect(decoded.canDimensions1).toBe("0308");
      expect(typeof decoded.canDimensions1).toBe("string");
      expect(decoded.packageTrackingNumberCode).toBe("ITN");
    });
  });

  describe("PG31-Record (NOAA/NMFS Harvesting Vessel Characteristic, PDF p.50)", () => {
    it("has contiguous 1-indexed field positions summing to 80", () => {
      let expectedStart = 1;
      for (const field of PG31_HARVESTING_VESSEL_SPEC.fields) {
        expect(field.start).toBe(expectedStart);
        expectedStart += field.length;
      }
      expect(expectedStart - 1).toBe(80);
    });

    it("Harvested Commodity Net Weight implied decimals (2dp) match PDF p.50", () => {
      const fields = Object.fromEntries(
        PG31_HARVESTING_VESSEL_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
      );
      expect(fields.commodityHarvestingVesselCharacteristicTypeCode).toMatchObject({
        start: 5,
        length: 3,
        class: "AN",
        designation: "M",
      });
      expect(fields.commodityHarvestingVesselCharacteristic).toMatchObject({
        start: 8,
        length: 35,
        class: "X",
        designation: "M",
      });
      expect(fields.unitOfMeasureConveyance).toMatchObject({ start: 43, length: 3, class: "AN", designation: "C" });
      expect(fields.harvestedCommodityNetWeight).toMatchObject({ start: 46, length: 10, class: "SN", designation: "C" });

      const line = encodeRecord(PG31_HARVESTING_VESSEL_SPEC, {
        commodityHarvestingVesselCharacteristicTypeCode: "VNM",
        commodityHarvestingVesselCharacteristic: "F/V PACIFIC STAR",
        unitOfMeasureConveyance: "KG",
        harvestedCommodityNetWeight: new Decimal("1234.56"),
      });
      expect(line.slice(45, 55)).toBe("0000123456"); // pos 46-55, 10 chars, 2 implied decimals
      expect(decodeRecord(PG31_HARVESTING_VESSEL_SPEC, line).harvestedCommodityNetWeight?.toString()).toBe(
        "1234.56"
      );
    });
  });

  describe("PG33-Record (NOAA/NMFS Commodity Geographic Area, PDF p.52)", () => {
    it("has contiguous 1-indexed field positions summing to 80", () => {
      let expectedStart = 1;
      for (const field of PG33_GEOGRAPHIC_AREA_SPEC.fields) {
        expect(field.start).toBe(expectedStart);
        expectedStart += field.length;
      }
      expect(expectedStart - 1).toBe(80);
    });

    it("field layout matches PDF p.52", () => {
      const fields = Object.fromEntries(
        PG33_GEOGRAPHIC_AREA_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
      );
      expect(fields.filler_1).toMatchObject({ start: 1, length: 4, class: "A", designation: "M", constant: "PG33" });
      expect(fields.commodityGeographicAreaCode).toMatchObject({ start: 5, length: 9, class: "X", designation: "C" });
      expect(fields.commodityGeographicAreaName).toMatchObject({ start: 14, length: 65, class: "X", designation: "C" });
      expect(fields.filler_79).toMatchObject({ start: 79, length: 2, class: "S", designation: "M" });

      const line = encodeRecord(PG33_GEOGRAPHIC_AREA_SPEC, {
        commodityGeographicAreaCode: "NPO",
        commodityGeographicAreaName: "NORTH PACIFIC OCEAN",
      });
      const decoded = decodeRecord(PG33_GEOGRAPHIC_AREA_SPEC, line);
      expect(decoded.commodityGeographicAreaCode).toBe("NPO");
      expect(decoded.commodityGeographicAreaName).toBe("NORTH PACIFIC OCEAN");
    });
  });

  describe("PG35-Record (DOT/NHTSA Conformance Bond Detail, PDF p.54)", () => {
    it("has contiguous 1-indexed field positions summing to 80", () => {
      let expectedStart = 1;
      for (const field of PG35_CONFORMANCE_BOND_SPEC.fields) {
        expect(field.start).toBe(expectedStart);
        expectedStart += field.length;
      }
      expect(expectedStart - 1).toBe(80);
    });

    it("DOT Bond Amount is whole-dollar (0 implied decimals), matching PG25's pgaLineValue convention", () => {
      const fields = Object.fromEntries(
        PG35_CONFORMANCE_BOND_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
      );
      expect(fields.dotSuretyCode).toMatchObject({ start: 5, length: 3, class: "AN", designation: "C" });
      expect(fields.dotBondSerialNumber).toMatchObject({ start: 8, length: 30, class: "X", designation: "C" });
      expect(fields.dotBondQualifier).toMatchObject({ start: 38, length: 1, class: "N", designation: "C" });
      expect(fields.dotBondAmount).toMatchObject({ start: 39, length: 8, class: "SN", designation: "C" });

      const line = encodeRecord(PG35_CONFORMANCE_BOND_SPEC, {
        dotSuretyCode: "123",
        dotBondQualifier: 2,
        dotBondAmount: new Decimal("75000"),
      });
      expect(line.slice(38, 46)).toBe("00075000"); // pos 39-46, 8 chars, 0 implied decimals
      const decoded = decodeRecord(PG35_CONFORMANCE_BOND_SPEC, line);
      expect(decoded.dotBondQualifier).toBe(2);
      expect(decoded.dotBondAmount?.toString()).toBe("75000");
    });
  });
});
