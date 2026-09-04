import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/tariff/decimal";
import {
  fromCustomsFiling,
  validateCustomsFilingForCargoRelease,
  buildAbiTransmissionForCargoReleaseFiling,
  AbiFilingValidationError,
  type CustomsFilingWithCargoReleaseRelations,
  type EnvelopeHeaderOptions,
} from "@/lib/abi/cargoRelease/fromCustomsFiling";
import { parseCargoReleaseResponse } from "@/lib/abi/cargoRelease/parseResponse";
import { parseOutputBRecord } from "@/lib/abi/batchBlockControl/parse";





const makeMockFiling = (): CustomsFilingWithCargoReleaseRelations => ({
  id: "filing-cargo-001",
  entryNumber: "N0103245275",
  entryType: "01",
  actionCode: "A",
  brokerReferenceNumber: "REF-9901",
  modeOfTransportationCode: "11",
  foreignTradeZoneIdentifier: "FTZ-12",
  estimatedEntryDate: new Date("2026-08-15T00:00:00.000Z"),
  importerOfRecord: {
    cbpImporterNumber: "12-3456789XX",
    irsEin: "12-3456789",
    name: "ACME IMPORTING CO",
  },
  bond: {
    bondType: "continuous",
    suretyCode: "329",
    suretyName: "GREAT AMERICAN INS CO",
  },
  shipment: {
    portOfEntry: "2704",
    entryType: "01",
    transportMode: "11",
    carrierName: "MAEU",
    estimatedArrival: new Date("2026-08-15T00:00:00.000Z"),
    transportLegs: [
      {
        id: "leg-1",
        mode: "SEA",
        carrierCode: "MAEU",
        vesselName: "EVER GIVEN",
        voyageNumber: "001A",
        estimatedArrival: new Date("2026-08-15T00:00:00.000Z"),
      },
    ],
    trackingIdentifiers: [
      { type: "MBL", value: "MAEU123456789", issuer: "MAEU" },
      { type: "CONTAINER", value: "MSKU1234567" },
    ],
    lineItems: [
      {
        id: "item-1",
        lineNumber: 1,
        partNumber: "PART-100",
        description: "ELECTRIC MOTORS",
        quantity: 500,
        unitPrice: new Decimal("25"),
        totalValue: new Decimal("12500"),
        countryOfOrigin: "CN",
        htsCode: "8501104020",
        ftzDetails: [
          {
            merchandiseStatusCode: "P",
            lineItemQuantity: 500,
          },
        ],
      },
    ],
    shipmentParties: [
      {
        role: "MANUFACTURER",
        partyTypeCode: "MF",
        legalEntity: {
          legalName: "ACME MANUFACTURING",
        },
      },
    ],
  },
});

const defaultEnvelope: EnvelopeHeaderOptions = {
  senderReceiverSiteCode: "SITE",
  senderReceiverIdCode: "REC",
  communicationPassword: "PASS",
  processingFilerCode: "N01",
  processingDistrictPortCode: "2704",
};


describe("Cargo Release DB Integration (fromCustomsFiling)", () => {
  it("converts a valid CustomsFiling record into CargoReleaseTransactionInput", () => {
    const filing = makeMockFiling();
    const input = fromCustomsFiling(filing, defaultEnvelope);

    expect(input.header.entryFilerCode).toBe("N01");
    expect(input.header.entryNumber).toBe("03245275");

    expect(input.header.plannedPortOfEntry).toBe("2704");
    expect(input.header.estimatedEntryValue.toString()).toBe("12500");

    expect(input.additionalHeader?.conveyanceNameOrFtzId).toBe("FTZ-12");
    expect(input.additionalHeader?.voyageFlightTripManifestNumber).toBe("001A");

    expect(input.bills).toHaveLength(1);
    expect(input.bills![0].billsOfLading[0].billOfLadingNumber).toBe("MAEU123456789");
    expect(input.bills![0].conveyances![0].carrierCode).toBe("MAEU");
    expect(input.bills![0].equipment![0].equipmentNumber).toBe("MSKU1234567");

    expect(input.lines).toHaveLength(1);
    expect(input.lines![0].lineItem.lineItemIdentifier).toBe("001");
    expect(input.lines![0].lineItem.countryOfOrigin).toBe("CN");
    expect(input.lines![0].htsLines[0].htsLine.htsNumber).toBe("8501104020");
    expect(input.lines![0].ftzStatus?.zoneStatus).toBe("P");
  });

  it("builds end-to-end transmittable batch/block envelope lines", () => {
    const filing = makeMockFiling();
    const lines = buildAbiTransmissionForCargoReleaseFiling(filing, defaultEnvelope);

    expect(lines.length).toBeGreaterThan(5);
    expect(lines[0].startsWith("A")).toBe(true);
    expect(lines[1].startsWith("B")).toBe(true);
    expect(lines[lines.length - 2].startsWith("Y")).toBe(true);
    expect(lines[lines.length - 1].startsWith("Z")).toBe(true);

    // Verify block payload contains B-record header with application ID SE and SE10, SE15, SE40 transaction records
    const bHeader = parseOutputBRecord(lines[1]);
    expect(bHeader.applicationIdentifierCode).toBe("SE");

    const innerRecords = lines.slice(2, -2);
    expect(innerRecords.some(l => l.startsWith("SE10"))).toBe(true);
    expect(innerRecords.some(l => l.startsWith("SE15"))).toBe(true);
    expect(innerRecords.some(l => l.startsWith("SE40"))).toBe(true);


  });

  it("round-trips assembled transmission back through parseCargoReleaseResponse losslessly", () => {
    const filing = makeMockFiling();
    const transmissionLines = buildAbiTransmissionForCargoReleaseFiling(filing, defaultEnvelope);

    // Extract transaction lines inside the block envelope (excluding B and Y control lines)
    const transactionLines = transmissionLines.slice(2, -2);
    // Append mock CBP disposition line
    const acceptLine = "SE9002  TRANSACTION ACCEPTED BY CBP".padEnd(80, " ");
    const rawResponse = [...transactionLines, acceptLine];

    const parsed = parseCargoReleaseResponse(rawResponse);

    expect(parsed.scenario).toBe("ACCEPTED");
    expect(parsed.headerGroups).toHaveLength(1);

    const group = parsed.headerGroups[0];
    expect(group.header.record.entryFilerCode).toBe("N01");
    expect(group.header.record.entryNumber).toBe("03245275");

    expect(group.bills[0].bill.record.billOfLadingNumber).toBe("MAEU123456789");
    expect(group.lines[0].lineItem.record.lineItemIdentifier).toBe("001");
    expect(group.lines[0].htsLines[0].htsLine.record.htsNumber).toBe("8501104020");
  });

  it("throws AbiFilingValidationError when required fields are missing", () => {
    const invalidFiling = makeMockFiling();
    invalidFiling.shipment!.lineItems = []; // Remove required line items

    expect(() => fromCustomsFiling(invalidFiling, defaultEnvelope)).toThrow(
      AbiFilingValidationError
    );

    const validation = validateCustomsFilingForCargoRelease(invalidFiling, defaultEnvelope);
    expect(validation.valid).toBe(false);
    expect(validation.missingFields).toContain("shipment.lineItems (requires at least 1 line item)");
  });
});
