/**
 * CATAIR ACE Cargo Release (SE/SX) Response Parsing & Classification Tests
 * Source PDF: docs/plans/catair-source-docs/04-cargo-release-implementation-guide-v40.pdf
 */

import { describe, it, expect } from "vitest";
import { encodeRecord, decodeRecord } from "@/lib/abi/fixedWidth";
import { Decimal } from "@/lib/tariff/decimal";
import {
  SE10_HEADER_SPEC,
  SE15_BILL_OF_LADING_SPEC,
  SE60_HTS_LINE_SPEC,
  SE90_OUTPUT_DISPOSITION_SPEC,
} from "@/lib/abi/cargoRelease/recordSpecs";
import { classifyCargoReleaseLine } from "@/lib/abi/cargoRelease/parse";

const validSe10Line = () =>
  encodeRecord(SE10_HEADER_SPEC, {
    actionCode: "A",
    entryFilerCode: "N01",
    entryNumber: "03245278",
    entryTypeCode: "01",
    importerOfRecordType: "EI",
    importerOfRecordNumber: "12-3456789XX",
    modeOfTransportationCode: "11",
    bondTypeCode: "8",
    estimatedEntryValue: new Decimal("12500"),
    plannedPortOfEntry: "2704",
  });

const validSe15Line = () =>
  encodeRecord(SE15_BILL_OF_LADING_SPEC, {
    billTypeIndicator: "R",
    issuerCodeOfBillOfLadingNumber: "MAEU",
    billOfLadingNumber: "MAEU123456789",
    quantity: 500,
    nonAmsIndicator: "N",
  });

const validSe60Line = () =>
  encodeRecord(SE60_HTS_LINE_SPEC, {
    htsNumber: "8501104020",
    lineItemValue: new Decimal("4500"),
  });

const validSe90AcceptedLine = () =>
  encodeRecord(SE90_OUTPUT_DISPOSITION_SPEC, {
    messageTypeCode: "02",
    narrativeMessageText: "TRANSACTION ACCEPTED",
  });

const validSe90RejectedLine = () =>
  encodeRecord(SE90_OUTPUT_DISPOSITION_SPEC, {
    messageTypeCode: "01",
    messageIdentifierCode: "101",
    narrativeMessageText: "INVALID ENTRY FILER CODE",
  });

describe("classifyCargoReleaseLine", () => {
  it.each([
    ["SE10" + " ".repeat(76), "SE10"],
    ["SE11" + " ".repeat(76), "SE11"],
    ["SE13" + " ".repeat(76), "SE13"],
    ["SE15" + " ".repeat(76), "SE15"],
    ["SE16" + " ".repeat(76), "SE16"],
    ["SE20" + " ".repeat(76), "SE20"],
    ["SE30" + " ".repeat(76), "SE30"],
    ["SE35" + " ".repeat(76), "SE35"],
    ["SE36" + " ".repeat(76), "SE36"],
    ["SE40" + " ".repeat(76), "SE40"],
    ["SE50" + " ".repeat(76), "SE50"],
    ["SE55" + " ".repeat(76), "SE55"],
    ["SE56" + " ".repeat(76), "SE56"],
    ["SE60" + " ".repeat(76), "SE60"],
    ["SE90" + " ".repeat(76), "SE90"],
    ["SE17" + " ".repeat(76), "SE17"], // Equipment detail
    ["SE31" + " ".repeat(76), "SE31"], // Header entity GBI detail
    ["SE41" + " ".repeat(76), "SE41"], // FTZ detail
    ["SE51" + " ".repeat(76), "SE51"], // Line entity GBI detail
    ["SE61" + " ".repeat(76), "SE61"], // FTZ privileged foreign status HTS detail
    ["SF10" + " ".repeat(76), "UNKNOWN"], // ISF-10 detail - deferred (unique to this chapter, no test coverage this slice)
    ["PG01" + " ".repeat(76), "UNKNOWN"], // PGA detail - reused from src/lib/abi/pgaMessageSet/, not redefined in cargoRelease
  ] as const)("classifies %j as %s", (line, expected) => {
    expect(classifyCargoReleaseLine(line)).toBe(expected);
  });
});

describe("decodeRecord on SE10 Header", () => {
  it("decodes core identifying fields from SE10 header line", () => {
    const line = validSe10Line();
    const decoded = decodeRecord(SE10_HEADER_SPEC, line);
    expect(decoded.actionCode).toBe("A");
    expect(decoded.entryFilerCode).toBe("N01");
    expect(decoded.entryNumber).toBe("03245278");
    expect(decoded.entryTypeCode).toBe("01");
    expect(decoded.importerOfRecordType).toBe("EI");
    expect(decoded.importerOfRecordNumber).toBe("12-3456789XX");
    expect(decoded.modeOfTransportationCode).toBe("11");
    expect(decoded.bondTypeCode).toBe(8);
    expect(decoded.estimatedEntryValue?.toString()).toBe("12500");
    expect(decoded.plannedPortOfEntry).toBe("2704");
  });
});

describe("decodeRecord on SE15 Bill of Lading", () => {
  it("decodes bill of lading number, quantity, and non-AMS indicator (respecting internal 5S filler)", () => {
    const line = validSe15Line();
    const decoded = decodeRecord(SE15_BILL_OF_LADING_SPEC, line);
    expect(decoded.billTypeIndicator).toBe("R");
    expect(decoded.issuerCodeOfBillOfLadingNumber).toBe("MAEU");
    expect(decoded.billOfLadingNumber).toBe("MAEU123456789");
    expect(decoded.quantity).toBe(500);
    expect(decoded.nonAmsIndicator).toBe("N");
  });
});

describe("decodeRecord on SE60 HTS Line", () => {
  it("decodes HTS number and line item value as a Decimal, not a float", () => {
    const line = validSe60Line();
    const decoded = decodeRecord(SE60_HTS_LINE_SPEC, line);
    expect(decoded.htsNumber).toBe("8501104020");
    expect(decoded.lineItemValue?.toString()).toBe("4500");
  });
});

describe("decodeRecord on SE90 Output Disposition", () => {
  it("decodes acceptance message from SE90 output line", () => {
    const line = validSe90AcceptedLine();
    const decoded = decodeRecord(SE90_OUTPUT_DISPOSITION_SPEC, line);
    expect(decoded.messageTypeCode).toBe("02");
    expect(decoded.narrativeMessageText).toBe("TRANSACTION ACCEPTED");
  });

  it("decodes rejection message and condition code from SE90 output line", () => {
    const line = validSe90RejectedLine();
    const decoded = decodeRecord(SE90_OUTPUT_DISPOSITION_SPEC, line);
    expect(decoded.messageTypeCode).toBe("01");
    expect(decoded.messageIdentifierCode).toBe("101");
    expect(decoded.narrativeMessageText).toBe("INVALID ENTRY FILER CODE");
  });
});
