/**
 * CATAIR ACE Cargo Release (SE) Record Building Tests
 * Source PDF: docs/plans/catair-source-docs/04-cargo-release-implementation-guide-v40.pdf
 */

import { describe, it, expect } from "vitest";
import { encodeRecord } from "@/lib/abi/fixedWidth";
import { buildEntryNumber } from "@/lib/abi/entryNumber";
import { Decimal } from "@/lib/tariff/decimal";
import {
  SE10_HEADER_SPEC,
  SE11_ADDITIONAL_HEADER_SPEC,
  SE13_CONTACT_CANCEL_SPEC,
  SE15_BILL_OF_LADING_SPEC,
  SE16_CONVEYANCE_SPEC,
  SE20_REFERENCE_SPEC,
  SE36_HEADER_ENTITY_GEO_SPEC,
  SE56_LINE_ENTITY_GEO_SPEC,
  SE40_LINE_ITEM_SPEC,
  SE60_HTS_LINE_SPEC,
} from "@/lib/abi/cargoRelease/recordSpecs";
import type { HeaderInput } from "@/lib/abi/cargoRelease/types";

const validEntryNumber = buildEntryNumber("N01", "0324527"); // Appendix E worked example -> "03245278"

describe("SE10-Record Building", () => {
  const validInput: HeaderInput = {
    actionCode: "A",
    entryFilerCode: "N01",
    entryNumber: validEntryNumber,
    entryTypeCode: "01",
    importerOfRecordType: "EI",
    importerOfRecordNumber: "12-3456789XX",
    modeOfTransportationCode: "11",
    bondTypeCode: "8",
    estimatedEntryValue: new Decimal("12500"),
    plannedPortOfEntry: "2704",
  };

  it("produces an exact 80-char record starting with control identifier SE10", () => {
    const line = encodeRecord(SE10_HEADER_SPEC, validInput);
    expect(line).toHaveLength(80);
    expect(line.slice(0, 4)).toBe("SE10");
  });

  it("places fields at their exact spec positions (including internal fillers at 9-10 and 19)", () => {
    const line = encodeRecord(SE10_HEADER_SPEC, validInput);
    expect(line.slice(4, 5)).toBe("A"); // Pos 5: Action Code
    expect(line.slice(5, 8)).toBe("N01"); // Pos 6-8: Filer Code
    expect(line.slice(8, 10)).toBe("  "); // Pos 9-10: Filler 2S
    expect(line.slice(10, 18)).toBe(validEntryNumber); // Pos 11-18: Entry Number
    expect(line.slice(18, 19)).toBe(" "); // Pos 19: Filler 1S
    expect(line.slice(19, 21)).toBe("01"); // Pos 20-21: Entry Type Code
    expect(line.slice(21, 24)).toBe("EI "); // Pos 22-24: Importer Type Code
    expect(line.slice(24, 36)).toBe("12-3456789XX"); // Pos 25-36: Importer Number
    expect(line.slice(36, 38)).toBe("11"); // Pos 37-38: MOT Code
    expect(line.slice(38, 39)).toBe("8"); // Pos 39: Bond Type Code
    expect(line.slice(39, 49)).toBe("0000012500"); // Pos 40-49: Estimated Entry Value
    expect(line.slice(49, 54)).toBe("2704 "); // Pos 50-54: Planned Port of Entry
    expect(line.slice(60, 80)).toBe(" ".repeat(20)); // Pos 61-80: Filler
  });
});

describe("SE11-Record Building", () => {
  it("produces an exact 80-char record starting with control identifier SE11", () => {
    const line = encodeRecord(SE11_ADDITIONAL_HEADER_SPEC, {
      locationOfGoodsFirms: "W123",
      entryDateElectionCode: "W",
      electedEntryDate: new Date(2026, 7, 20), // MMDDYY -> 082026
      electedExamSiteFirms: "F999",
      immediateDeliveryIndicator: "Y",
    });
    expect(line).toHaveLength(80);
    expect(line.slice(0, 4)).toBe("SE11");
    expect(line.slice(4, 5)).toBe("W"); // Pos 5
    expect(line.slice(5, 11)).toBe("082026"); // Pos 6-11: MMDDYY
    expect(line.slice(11, 15)).toBe("W123"); // Pos 12-15: Location of Goods FIRMS
    expect(line.slice(15, 19)).toBe("F999"); // Pos 16-19: Exam Site FIRMS
    expect(line.slice(79, 80)).toBe("Y"); // Pos 80: Immediate Delivery Indicator
  });
});

describe("SE13-Record Building", () => {
  it("produces an exact 80-char record for contact and cancellation info", () => {
    const line = encodeRecord(SE13_CONTACT_CANCEL_SPEC, {
      contactName: "JOHN DOE",
      contactPhone: "5551234567",
      cancellationReasonCode: "01",
    });
    expect(line).toHaveLength(80);
    expect(line.slice(0, 4)).toBe("SE13");
    expect(line.slice(4, 12)).toBe("JOHN DOE");
    expect(line.slice(44, 54)).toBe("5551234567");
    expect(line.slice(59, 61)).toBe("01");
  });
});

describe("SE15-Record Building", () => {
  it("produces an exact 80-char record with internal 5S filler at 68-72", () => {
    const line = encodeRecord(SE15_BILL_OF_LADING_SPEC, {
      billTypeIndicator: "R",
      issuerCodeOfBillOfLadingNumber: "MAEU",
      billOfLadingNumber: "MAEU123456789",
      quantity: 500,
      nonAmsIndicator: "N",
    });
    expect(line).toHaveLength(80);
    expect(line.slice(0, 4)).toBe("SE15");
    expect(line.slice(4, 5)).toBe("R");
    expect(line.slice(5, 9)).toBe("MAEU");
    expect(line.slice(67, 72)).toBe("     "); // Internal 5S filler at 68-72
    expect(line.slice(72, 73)).toBe("N"); // Pos 73: Non-AMS Indicator
  });
});

describe("SE16-Record Building", () => {
  it("produces an exact 80-char record for conveyance details", () => {
    const line = encodeRecord(SE16_CONVEYANCE_SPEC, {
      carrierCode: "MAEU",
      voyageFlightTripManifestNumber: "V101",
      dateOfArrival: new Date(2026, 7, 20), // MMDDYY -> 082026
      quantity: 500,
    });
    expect(line).toHaveLength(80);
    expect(line.slice(0, 4)).toBe("SE16");
    expect(line.slice(4, 8)).toBe("MAEU");
    expect(line.slice(13, 19)).toBe("082026");
  });
});

describe("SE20-Record Building", () => {
  it("produces an exact 80-char reference record", () => {
    const line = encodeRecord(SE20_REFERENCE_SPEC, {
      referenceIdentifierQualifier: "CR",
      referenceIdentifier: "REF-998877",
    });
    expect(line).toHaveLength(80);
    expect(line.slice(0, 4)).toBe("SE20");
    expect(line.slice(4, 7)).toBe("CR ");
  });
});

describe("SE30/35/36 & SE50/55/56 Entity Record Building", () => {
  it("produces exact 80-char records with internal 6S filler at 43-48 in SE36 & SE56", () => {
    const se36 = encodeRecord(SE36_HEADER_ENTITY_GEO_SPEC, {
      cityName: "SAN FRANCISCO",
      countrySubEntityCode: "CA",
      postalCode: "94105",
      countryCode: "US",
    });
    expect(se36).toHaveLength(80);
    expect(se36.slice(42, 48)).toBe("      "); // Pos 43-48: Internal 6S filler
    expect(se36.slice(48, 53)).toBe("94105");

    const se56 = encodeRecord(SE56_LINE_ENTITY_GEO_SPEC, {
      cityName: "SHANGHAI",
      postalCode: "200000",
      countryCode: "CN",
    });
    expect(se56).toHaveLength(80);
    expect(se56.slice(42, 48)).toBe("      "); // Pos 43-48: Internal 6S filler
    expect(se56.slice(63, 65)).toBe("CN");
  });
});

describe("SE40 Line Item Record Building", () => {
  it("produces exact 80-char line item record with internal 1S filler at 10", () => {
    const se40 = encodeRecord(SE40_LINE_ITEM_SPEC, {
      lineItemIdentifier: "001",
      countryOfOrigin: "CN",
      commercialInvoiceDescription: "PLASTIC TOYS",
    });
    expect(se40).toHaveLength(80);
    expect(se40.slice(4, 7)).toBe("001");
    expect(se40.slice(7, 9)).toBe("CN");
    expect(se40.slice(9, 10)).toBe(" "); // Pos 10: Internal 1S filler
    expect(se40.slice(10, 22)).toBe("PLASTIC TOYS");
  });
});

describe("SE60 HTS Line Record Building", () => {
  it("produces exact 80-char HTS line item record", () => {
    const se60 = encodeRecord(SE60_HTS_LINE_SPEC, {
      htsNumber: "8501104020",
      lineItemValue: new Decimal("4500"),
    });
    expect(se60).toHaveLength(80);
    expect(se60.slice(4, 14)).toBe("8501104020");
    expect(se60.slice(14, 24)).toBe("0000004500");
  });
});
