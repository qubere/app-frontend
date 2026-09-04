/**
 * CATAIR ACE Cargo Release (SE) Response Parsing Tests (`parseResponse.ts`)
 * Grounded in docs/plans/catair-source-docs/04-cargo-release-implementation-guide-v40.pdf
 * PDF pages 28–29 (Output Record Usage Map) and page 83 (SE90 Output Disposition spec).
 */

import { describe, it, expect } from "vitest";
import { encodeRecord, AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import { Decimal } from "@/lib/tariff/decimal";
import { assembleTransaction } from "@/lib/abi/cargoRelease/assembleTransaction";
import { parseCargoReleaseResponse, parseCargoReleaseResponseText } from "@/lib/abi/cargoRelease/parseResponse";
import { SE90_OUTPUT_DISPOSITION_SPEC } from "@/lib/abi/cargoRelease/recordSpecs";
import type { CargoReleaseTransactionInput } from "@/lib/abi/cargoRelease/types";

const makeFullTransactionInput = (): CargoReleaseTransactionInput => ({
  header: {
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
  },
  additionalHeader: {
    locationOfGoodsFirms: "F123",
    conveyanceNameOrFtzId: "EVER GIVEN",
    voyageFlightTripManifestNumber: "001A",
  },
  contactCancellation: {
    contactName: "JANE DOE",
    contactPhone: "5551234567",
  },
  bills: [
    {
      billsOfLading: [
        {
          billTypeIndicator: "R",
          issuerCodeOfBillOfLadingNumber: "MAEU",
          billOfLadingNumber: "MAEU123456789",
          quantity: 500,
          nonAmsIndicator: "N",
        },
      ],
      conveyances: [
        {
          carrierCode: "MAEU",
          voyageFlightTripManifestNumber: "001A",
          dateOfArrival: new Date("2026-08-15T00:00:00.000Z"),
          quantity: 500,
        },
      ],
      equipment: [
        { equipmentNumber: "MSKU1234567" },
      ],
    },
  ],
  references: [
    { referenceIdentifierQualifier: "INV", referenceIdentifier: "INV-9901" },
  ],
  headerEntities: [
    {
      entity: { entityCode: "MF", entityName: "ACME CORP" },
      gbiIdentifiers: [{ gbiIdentifierQualifier: "DUNS", gbiIdentifier: "123456789" }],
      streetAddresses: [{ addressComponentQualifier1: "ST", addressInformation1: "100 MAIN ST" }],
      geographicArea: { cityName: "NEW YORK", countryCode: "US" },
    },
  ],
  lines: [
    {
      lineItem: { lineItemIdentifier: "001", countryOfOrigin: "CN" },
      ftzStatus: { zoneStatus: "P", ftzLineItemQuantity: 100 },
      entities: [
        {
          entity: { entityCode: "SE", entityName: "GLOBAL SUPPLIER" },
          gbiIdentifiers: [{ gbiIdentifierQualifier: "GLN", gbiIdentifier: "1234567890123" }],
          streetAddresses: [{ addressComponentQualifier1: "ST", addressInformation1: "200 INDUSTRIAL WAY" }],
          geographicArea: { cityName: "SHANGHAI", countryCode: "CN" },
        },
      ],
      htsLines: [
        {
          htsLine: { htsNumber: "8501104020", lineItemValue: new Decimal("12500") },
          ftzPfHts: { currentHtsNumberForPfStatusMerchandise: "8501104090" },
        },
      ],
      pgaLines: [
        "OI" + "001".padStart(3, "0") + " ".repeat(75),
      ],
    },
  ],
});


const buildSe90Line = (
  messageTypeCode: string,
  narrativeMessageText: string,
  messageIdentifierCode?: string
) =>
  encodeRecord(SE90_OUTPUT_DISPOSITION_SPEC, {
    messageTypeCode,
    messageIdentifierCode,
    narrativeMessageText,
  });

describe("parseCargoReleaseResponse", () => {
  it("parses clean accepted transaction response round-trip losslessly", () => {
    const input = makeFullTransactionInput();
    const builtLines = assembleTransaction(input);
    const acceptLine = buildSe90Line("02", "TRANSACTION ACCEPTED BY CBP");
    const rawResponse = [...builtLines, acceptLine];

    const parsed = parseCargoReleaseResponse(rawResponse);

    expect(parsed.scenario).toBe("ACCEPTED");
    expect(parsed.headerGroups).toHaveLength(1);

    const group = parsed.headerGroups[0];
    expect(group.scenario).toBe("ACCEPTED");
    expect(group.disposition?.messageTypeCode).toBe("02");
    expect(group.disposition?.narrativeMessageText).toBe("TRANSACTION ACCEPTED BY CBP");

    // Verify Header
    expect(group.header.record.entryNumber).toBe("03245278");
    expect(group.header.record.entryFilerCode).toBe("N01");
    expect(group.header.errors).toHaveLength(0);

    // Verify Additional Header
    expect(group.additionalHeader?.record.conveyanceNameOrFtzId).toBe("EVER GIVEN");
    expect(group.additionalHeader?.errors).toHaveLength(0);

    // Verify Contact / Cancellation
    expect(group.contactCancellation?.record.contactName).toBe("JANE DOE");
    expect(group.contactCancellation?.errors).toHaveLength(0);

    // Verify Bill of Lading Grouping
    expect(group.bills).toHaveLength(1);
    expect(group.bills[0].bill.record.billOfLadingNumber).toBe("MAEU123456789");
    expect(group.bills[0].bill.errors).toHaveLength(0);
    expect(group.bills[0].conveyances).toHaveLength(1);
    expect(group.bills[0].conveyances[0].record.carrierCode).toBe("MAEU");
    expect(group.bills[0].equipment).toHaveLength(1);
    expect(group.bills[0].equipment[0].record.equipmentNumber).toBe("MSKU1234567");

    // Verify Reference
    expect(group.references).toHaveLength(1);
    expect(group.references[0].record.referenceIdentifier).toBe("INV-9901");

    // Verify Header Entity
    expect(group.headerEntities).toHaveLength(1);
    expect(group.headerEntities[0].entity.record.entityName).toBe("ACME CORP");
    expect(group.headerEntities[0].gbiIdentifiers).toHaveLength(1);
    expect(group.headerEntities[0].gbiIdentifiers[0].record.gbiIdentifier).toBe("123456789");
    expect(group.headerEntities[0].streetAddresses).toHaveLength(1);
    expect(group.headerEntities[0].streetAddresses[0].record.addressInformation1).toBe("100 MAIN ST");
    expect(group.headerEntities[0].geographicArea?.record.cityName).toBe("NEW YORK");

    // Verify Line Item Grouping
    expect(group.lines).toHaveLength(1);
    expect(group.lines[0].lineItem.record.lineItemIdentifier).toBe("001");
    expect(group.lines[0].ftzStatus?.record.zoneStatus).toBe("P");
    expect(group.lines[0].entities).toHaveLength(1);
    expect(group.lines[0].entities[0].entity.record.entityName).toBe("GLOBAL SUPPLIER");
    expect(group.lines[0].htsLines).toHaveLength(1);
    expect(group.lines[0].htsLines[0].htsLine.record.htsNumber).toBe("8501104020");
    expect(group.lines[0].htsLines[0].ftzPfHts?.record.currentHtsNumberForPfStatusMerchandise).toBe("8501104090");
    expect(group.lines[0].pgaLines).toHaveLength(1);
  });

  it("attaches SE90 record-level errors to the exact record occurrence", () => {
    const input = makeFullTransactionInput();
    const builtLines = assembleTransaction(input);

    // Inject record-level errors following SE15 (Bill of Lading) and SE30 (Header Entity)
    const modifiedLines: string[] = [];
    for (const line of builtLines) {
      modifiedLines.push(line);
      if (line.startsWith("SE15")) {
        // Record-level error on Bill of Lading
        modifiedLines.push(buildSe90Line("11", "INVALID BILL OF LADING NUMBER", "201"));
      } else if (line.startsWith("SE30")) {
        // Record-level error on Header Entity
        modifiedLines.push(buildSe90Line("11", "ENTITY TAX ID NOT ON FILE", "305"));
      }
    }
    // Transaction-level reject disposition
    modifiedLines.push(buildSe90Line("01", "TRANSACTION REJECTED", "999"));

    const parsed = parseCargoReleaseResponse(modifiedLines);

    expect(parsed.scenario).toBe("REJECTED");
    expect(parsed.headerGroups).toHaveLength(1);

    const group = parsed.headerGroups[0];
    expect(group.scenario).toBe("REJECTED");
    expect(group.disposition?.messageTypeCode).toBe("01");

    // Header has NO errors
    expect(group.header.errors).toHaveLength(0);

    // Bill of Lading has 1 attached error
    expect(group.bills[0].bill.errors).toHaveLength(1);
    expect(group.bills[0].bill.errors[0].messageTypeCode).toBe("11");
    expect(group.bills[0].bill.errors[0].messageIdentifierCode).toBe("201");
    expect(group.bills[0].bill.errors[0].narrativeMessageText).toBe("INVALID BILL OF LADING NUMBER");

    // Header Entity has 1 attached error
    expect(group.headerEntities[0].entity.errors).toHaveLength(1);
    expect(group.headerEntities[0].entity.errors[0].messageTypeCode).toBe("11");
    expect(group.headerEntities[0].entity.errors[0].messageIdentifierCode).toBe("305");
    expect(group.headerEntities[0].entity.errors[0].narrativeMessageText).toBe("ENTITY TAX ID NOT ON FILE");

    // Line Item has NO errors
    expect(group.lines[0].lineItem.errors).toHaveLength(0);
  });

  it("handles warning (03) and human-review (04) disposition scenarios", () => {
    const input = makeFullTransactionInput();
    const builtLines = assembleTransaction(input);

    const warningLines = [...builtLines, buildSe90Line("03", "ACCEPTED WITH WARNINGS", "W01")];
    const parsedWarning = parseCargoReleaseResponse(warningLines);
    expect(parsedWarning.scenario).toBe("ACCEPTED_WITH_WARNINGS");
    expect(parsedWarning.headerGroups[0].scenario).toBe("ACCEPTED_WITH_WARNINGS");

    const reviewLines = [...builtLines, buildSe90Line("04", "REFERRED TO HUMAN REVIEW", "R01")];
    const parsedReview = parseCargoReleaseResponse(reviewLines);
    expect(parsedReview.scenario).toBe("REFERRED_TO_HUMAN_REVIEW");
    expect(parsedReview.headerGroups[0].scenario).toBe("REFERRED_TO_HUMAN_REVIEW");
  });

  it("parses minimal response with optional groups omitted", () => {
    const minimalInput: CargoReleaseTransactionInput = {
      header: {
        actionCode: "A",
        entryFilerCode: "N01",
        entryNumber: "03245278",
        entryTypeCode: "01",
        bondTypeCode: "8",
        estimatedEntryValue: new Decimal("5000"),
      },

      contactCancellation: {
        contactName: "JOHN SMITH",
        contactPhone: "5559876543",
      },
    };
    const builtLines = assembleTransaction(minimalInput);
    const rawResponse = [...builtLines, buildSe90Line("02", "ACCEPTED")];

    const parsed = parseCargoReleaseResponse(rawResponse);

    expect(parsed.scenario).toBe("ACCEPTED");
    expect(parsed.headerGroups).toHaveLength(1);

    const group = parsed.headerGroups[0];
    expect(group.header.record.entryFilerCode).toBe("N01");
    expect(group.additionalHeader).toBeUndefined();
    expect(group.bills).toHaveLength(0);
    expect(group.references).toHaveLength(0);
    expect(group.headerEntities).toHaveLength(0);
    expect(group.lines).toHaveLength(0);
  });

  it("preserves unrecognized lines in unrecognizedLines array", () => {
    const input = makeFullTransactionInput();
    const builtLines = assembleTransaction(input);
    const unmodeledLine = "SF10" + "ISF-DATA".padEnd(76, " ");
    const rawResponse = [...builtLines, unmodeledLine, buildSe90Line("02", "ACCEPTED")];

    const parsed = parseCargoReleaseResponse(rawResponse);

    expect(parsed.scenario).toBe("ACCEPTED");
    expect(parsed.unrecognizedLines).toContain(unmodeledLine);
  });

  it("throws AbiFixedWidthError when mandatory SE10 header is missing", () => {
    const invalidLines = [buildSe90Line("02", "ACCEPTED")];
    expect(() => parseCargoReleaseResponse(invalidLines)).toThrow(AbiFixedWidthError);
  });

  it("throws AbiFixedWidthError when record appears without required parent", () => {
    const orphanedSe16 = ["SE10" + " ".repeat(76), "SE16" + " ".repeat(76)];
    expect(() => parseCargoReleaseResponse(orphanedSe16)).toThrow(AbiFixedWidthError);
  });

  it("parses raw response text with parseCargoReleaseResponseText", () => {
    const input = makeFullTransactionInput();
    const builtLines = assembleTransaction(input);
    const acceptLine = buildSe90Line("02", "ACCEPTED");
    const rawText = [...builtLines, acceptLine].join("\n");

    const parsed = parseCargoReleaseResponseText(rawText);

    expect(parsed.scenario).toBe("ACCEPTED");
    expect(parsed.headerGroups[0].header.record.entryNumber).toBe("03245278");
  });

  it("parses response with multiple SE10 header groupings in one raw response, keeping child records distinct", () => {
    const input1 = makeFullTransactionInput();
    const input2: CargoReleaseTransactionInput = {
      header: {
        actionCode: "A",
        entryFilerCode: "N01",
        entryNumber: "03245279",
        entryTypeCode: "01",
        bondTypeCode: "8",
        estimatedEntryValue: new Decimal("8500"),
      },
      contactCancellation: {
        contactName: "BOB JONES",
        contactPhone: "5559876543",
      },
      bills: [
        {
          billsOfLading: [
            {
              billTypeIndicator: "R",
              issuerCodeOfBillOfLadingNumber: "COSU",
              billOfLadingNumber: "COSU987654321",
              nonAmsIndicator: "N",
            },
          ],
        },
      ],
      lines: [
        {
          lineItem: { lineItemIdentifier: "001", countryOfOrigin: "JP" },
          htsLines: [
            {
              htsLine: { htsNumber: "8708295060", lineItemValue: new Decimal("8500") },
            },
          ],
        },
      ],
    };

    const lines1 = [...assembleTransaction(input1), buildSe90Line("02", "ACCEPTED ENTRY 1")];
    const lines2 = [...assembleTransaction(input2), buildSe90Line("01", "REJECTED ENTRY 2", "E99")];
    const rawMultiResponse = [...lines1, ...lines2];

    const parsed = parseCargoReleaseResponse(rawMultiResponse);

    expect(parsed.scenario).toBe("REJECTED"); // Top-level scenario reflects overall status (one rejected)
    expect(parsed.headerGroups).toHaveLength(2);

    // Group 1
    const group1 = parsed.headerGroups[0];
    expect(group1.scenario).toBe("ACCEPTED");
    expect(group1.header.record.entryNumber).toBe("03245278");
    expect(group1.bills).toHaveLength(1);
    expect(group1.bills[0].bill.record.billOfLadingNumber).toBe("MAEU123456789");
    expect(group1.lines).toHaveLength(1);
    expect(group1.lines[0].lineItem.record.countryOfOrigin).toBe("CN");
    expect(group1.disposition?.narrativeMessageText).toBe("ACCEPTED ENTRY 1");

    // Group 2
    const group2 = parsed.headerGroups[1];
    expect(group2.scenario).toBe("REJECTED");
    expect(group2.header.record.entryNumber).toBe("03245279");
    expect(group2.bills).toHaveLength(1);
    expect(group2.bills[0].bill.record.billOfLadingNumber).toBe("COSU987654321");
    expect(group2.lines).toHaveLength(1);
    expect(group2.lines[0].lineItem.record.countryOfOrigin).toBe("JP");
    expect(group2.disposition?.narrativeMessageText).toBe("REJECTED ENTRY 2");
  });
});

