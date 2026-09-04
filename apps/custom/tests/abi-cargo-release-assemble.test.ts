import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/tariff/decimal";
import { decodeRecord, AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import {
  SE10_HEADER_SPEC,
  SE11_ADDITIONAL_HEADER_SPEC,
  SE13_CONTACT_CANCEL_SPEC,
  SE15_BILL_OF_LADING_SPEC,
  SE16_CONVEYANCE_SPEC,
  SE17_EQUIPMENT_SPEC,
  SE20_REFERENCE_SPEC,
  SE30_HEADER_ENTITY_SPEC,
  SE31_HEADER_ENTITY_GBI_SPEC,
  SE35_HEADER_ENTITY_ADDRESS_SPEC,
  SE36_HEADER_ENTITY_GEO_SPEC,
  SE40_LINE_ITEM_SPEC,
  SE41_FTZ_DETAIL_SPEC,
  SE50_LINE_ENTITY_SPEC,
  SE51_LINE_ENTITY_GBI_SPEC,
  SE55_LINE_ENTITY_ADDRESS_SPEC,
  SE56_LINE_ENTITY_GEO_SPEC,
  SE60_HTS_LINE_SPEC,
  SE61_FTZ_PF_HTS_SPEC,
  assembleTransaction,
} from "@/lib/abi/cargoRelease";
import type {
  CargoReleaseTransactionInput,
  HeaderInput,
  AdditionalHeaderInput,
  ContactCancellationInput,
  BillOfLadingInput,
  ConveyanceInput,
  EquipmentInput,
  ReferenceInput,
  EntityInput,
  EntityGbiInput,
  EntityAddressInput,
  EntityGeoInput,
  LineItemInput,
  FtzDetailInput,
  HtsLineInput,
  FtzPfHtsInput,
} from "@/lib/abi/cargoRelease";

describe("Cargo Release assembleTransaction", () => {
  const header: HeaderInput = {
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
  };

  const additionalHeader: AdditionalHeaderInput = {
    locationOfGoodsFirms: "W123",
    immediateDeliveryIndicator: "Y",
  };

  const contactCancellation: ContactCancellationInput = {
    contactName: "JOHN DOE",
    contactPhone: "5551234567",
    cancellationReasonCode: "01",
  };

  const billOfLading: BillOfLadingInput = {
    billTypeIndicator: "R",
    issuerCodeOfBillOfLadingNumber: "MAEU",
    billOfLadingNumber: "MAEU123456789",
    quantity: 500,
    nonAmsIndicator: "N",
  };

  const conveyance: ConveyanceInput = {
    carrierCode: "MAEU",
    voyageFlightTripManifestNumber: "V101",
    dateOfArrival: new Date(2026, 7, 20),
    quantity: 500,
  };

  const equipment: EquipmentInput = {
    equipmentNumber: "MSCU1234567",
  };

  const reference: ReferenceInput = {
    referenceIdentifierQualifier: "CR",
    referenceIdentifier: "REF-998877",
  };

  const headerEntity: EntityInput = {
    entityCode: "MF",
    entityName: "ACME MANUFACTURING CORP",
  };

  const headerGbi: EntityGbiInput = {
    gbiIdentifierQualifier: "LEI",
    gbiIdentifier: "5493001KJ957B9551736",
  };

  const headerAddress: EntityAddressInput = {
    addressComponentQualifier1: "01",
    addressInformation1: "123 MAIN STREET",
  };

  const headerGeo: EntityGeoInput = {
    cityName: "SAN FRANCISCO",
    countrySubEntityCode: "CA",
    postalCode: "94105",
    countryCode: "US",
  };

  const lineItem: LineItemInput = {
    lineItemIdentifier: "001",
    countryOfOrigin: "CN",
    commercialInvoiceDescription: "PLASTIC TOYS",
  };

  const ftzDetail: FtzDetailInput = {
    zoneStatus: "P",
    ftzLineItemQuantity: 100,
  };

  const lineEntity: EntityInput = {
    entityCode: "SE",
    entityName: "SHANGHAI TOYS LTD",
  };

  const lineGbi: EntityGbiInput = {
    gbiIdentifierQualifier: "GLN",
    gbiIdentifier: "0614141000005",
  };

  const lineAddress: EntityAddressInput = {
    addressComponentQualifier1: "01",
    addressInformation1: "456 SHANGHAI ROAD",
  };

  const lineGeo: EntityGeoInput = {
    cityName: "SHANGHAI",
    postalCode: "200000",
    countryCode: "CN",
  };

  const htsLine: HtsLineInput = {
    htsNumber: "8501104020",
    lineItemValue: new Decimal("4500"),
  };

  const ftzPfHts: FtzPfHtsInput = {
    currentHtsNumberForPfStatusMerchandise: "8501104029",
  };

  it("assembles a full transaction with every record type populated and round-trips losslessly through decode", () => {
    const fullInput: CargoReleaseTransactionInput = {
      header,
      additionalHeader,
      contactCancellation,
      bills: [
        {
          billsOfLading: [billOfLading],
          conveyances: [conveyance],
          equipment: [equipment],
        },
      ],
      references: [reference],
      headerEntities: [
        {
          entity: headerEntity,
          gbiIdentifiers: [headerGbi],
          streetAddresses: [headerAddress],
          geographicArea: headerGeo,
        },
      ],
      lines: [
        {
          lineItem,
          ftzStatus: ftzDetail,
          entities: [
            {
              entity: lineEntity,
              gbiIdentifiers: [lineGbi],
              streetAddresses: [lineAddress],
              geographicArea: lineGeo,
            },
          ],
          htsLines: [
            {
              htsLine,
              ftzPfHts,
            },
          ],
        },
      ],
    };

    const lines = assembleTransaction(fullInput);

    // Expect 19 record lines
    expect(lines).toHaveLength(19);

    // Verify every line length is 80 characters
    lines.forEach((line, index) => {
      expect(line).toHaveLength(80);
    });

    // Check exact sequence of control codes
    const controlCodes = lines.map((l) => l.slice(0, 4));
    expect(controlCodes).toEqual([
      "SE10",
      "SE11",
      "SE13",
      "SE15",
      "SE16",
      "SE17",
      "SE20",
      "SE30",
      "SE31",
      "SE35",
      "SE36",
      "SE40",
      "SE41",
      "SE50",
      "SE51",
      "SE55",
      "SE56",
      "SE60",
      "SE61",
    ]);

    // Decode and spot-check every record field value for lossless round-tripping
    const decodedSe10 = decodeRecord(SE10_HEADER_SPEC, lines[0]);
    expect(decodedSe10.actionCode).toBe("A");
    expect(decodedSe10.entryFilerCode).toBe("N01");
    expect(decodedSe10.entryNumber).toBe("03245278");
    expect(decodedSe10.entryTypeCode).toBe("01");
    expect(decodedSe10.estimatedEntryValue).toEqual(new Decimal("12500"));

    const decodedSe11 = decodeRecord(SE11_ADDITIONAL_HEADER_SPEC, lines[1]);
    expect(decodedSe11.locationOfGoodsFirms).toBe("W123");
    expect(decodedSe11.immediateDeliveryIndicator).toBe("Y");

    const decodedSe13 = decodeRecord(SE13_CONTACT_CANCEL_SPEC, lines[2]);
    expect(decodedSe13.contactName).toBe("JOHN DOE");
    expect(decodedSe13.contactPhone).toBe("5551234567");

    const decodedSe15 = decodeRecord(SE15_BILL_OF_LADING_SPEC, lines[3]);
    expect(decodedSe15.billTypeIndicator).toBe("R");
    expect(decodedSe15.billOfLadingNumber).toBe("MAEU123456789");
    expect(decodedSe15.nonAmsIndicator).toBe("N");

    const decodedSe16 = decodeRecord(SE16_CONVEYANCE_SPEC, lines[4]);
    expect(decodedSe16.carrierCode).toBe("MAEU");
    expect(decodedSe16.voyageFlightTripManifestNumber).toBe("V101");
    expect(decodedSe16.quantity).toBe(500);

    const decodedSe17 = decodeRecord(SE17_EQUIPMENT_SPEC, lines[5]);
    expect(decodedSe17.equipmentNumber).toBe("MSCU1234567");

    const decodedSe20 = decodeRecord(SE20_REFERENCE_SPEC, lines[6]);
    expect(decodedSe20.referenceIdentifierQualifier).toBe("CR");
    expect(decodedSe20.referenceIdentifier).toBe("REF-998877");

    const decodedSe30 = decodeRecord(SE30_HEADER_ENTITY_SPEC, lines[7]);
    expect(decodedSe30.entityCode).toBe("MF");
    expect(decodedSe30.entityName).toBe("ACME MANUFACTURING CORP");

    const decodedSe31 = decodeRecord(SE31_HEADER_ENTITY_GBI_SPEC, lines[8]);
    expect(decodedSe31.gbiIdentifierQualifier).toBe("LEI");
    expect(decodedSe31.gbiIdentifier).toBe("5493001KJ957B9551736");

    const decodedSe35 = decodeRecord(SE35_HEADER_ENTITY_ADDRESS_SPEC, lines[9]);
    expect(decodedSe35.addressComponentQualifier1).toBe("01");
    expect(decodedSe35.addressInformation1).toBe("123 MAIN STREET");

    const decodedSe36 = decodeRecord(SE36_HEADER_ENTITY_GEO_SPEC, lines[10]);
    expect(decodedSe36.cityName).toBe("SAN FRANCISCO");
    expect(decodedSe36.countryCode).toBe("US");

    const decodedSe40 = decodeRecord(SE40_LINE_ITEM_SPEC, lines[11]);
    expect(decodedSe40.lineItemIdentifier).toBe("001");
    expect(decodedSe40.countryOfOrigin).toBe("CN");
    expect(decodedSe40.commercialInvoiceDescription).toBe("PLASTIC TOYS");

    const decodedSe41 = decodeRecord(SE41_FTZ_DETAIL_SPEC, lines[12]);
    expect(decodedSe41.zoneStatus).toBe("P");
    expect(decodedSe41.ftzLineItemQuantity).toBe(100);

    const decodedSe50 = decodeRecord(SE50_LINE_ENTITY_SPEC, lines[13]);
    expect(decodedSe50.entityCode).toBe("SE");
    expect(decodedSe50.entityName).toBe("SHANGHAI TOYS LTD");

    const decodedSe51 = decodeRecord(SE51_LINE_ENTITY_GBI_SPEC, lines[14]);
    expect(decodedSe51.gbiIdentifierQualifier).toBe("GLN");
    expect(decodedSe51.gbiIdentifier).toBe("0614141000005");

    const decodedSe55 = decodeRecord(SE55_LINE_ENTITY_ADDRESS_SPEC, lines[15]);
    expect(decodedSe55.addressComponentQualifier1).toBe("01");
    expect(decodedSe55.addressInformation1).toBe("456 SHANGHAI ROAD");

    const decodedSe56 = decodeRecord(SE56_LINE_ENTITY_GEO_SPEC, lines[16]);
    expect(decodedSe56.cityName).toBe("SHANGHAI");
    expect(decodedSe56.countryCode).toBe("CN");

    const decodedSe60 = decodeRecord(SE60_HTS_LINE_SPEC, lines[17]);
    expect(decodedSe60.htsNumber).toBe("8501104020");
    expect(decodedSe60.lineItemValue).toEqual(new Decimal("4500"));

    const decodedSe61 = decodeRecord(SE61_FTZ_PF_HTS_SPEC, lines[18]);
    expect(decodedSe61.currentHtsNumberForPfStatusMerchandise).toBe("8501104029");
  });

  it("omitting optional groups produces a correctly shorter, still-valid sequence", () => {
    const minimalInput: CargoReleaseTransactionInput = {
      header,
      contactCancellation,
      bills: [
        {
          billsOfLading: [billOfLading],
          conveyances: [conveyance],
        },
      ],
      headerEntities: [
        {
          entity: headerEntity,
        },
      ],
      lines: [
        {
          lineItem,
          entities: [
            {
              entity: lineEntity,
            },
          ],
          htsLines: [
            {
              htsLine,
            },
          ],
        },
      ],
    };

    const lines = assembleTransaction(minimalInput);

    expect(lines).toHaveLength(8);
    const controlCodes = lines.map((l) => l.slice(0, 4));
    expect(controlCodes).toEqual([
      "SE10",
      "SE13",
      "SE15",
      "SE16",
      "SE30",
      "SE40",
      "SE50",
      "SE60",
    ]);

    lines.forEach((line) => {
      expect(line).toHaveLength(80);
    });
  });

  it("enforces max limit for SE15 records per bill group", () => {
    const invalidInput: CargoReleaseTransactionInput = {
      header,
      contactCancellation,
      bills: [
        {
          billsOfLading: [billOfLading, billOfLading, billOfLading, billOfLading], // 4 SE15s
        },
      ],
      lines: [{ lineItem, htsLines: [{ htsLine }] }],
    };

    expect(() => assembleTransaction(invalidInput)).toThrow(AbiFixedWidthError);
    expect(() => assembleTransaction(invalidInput)).toThrow(/between 1 and 3/);
  });

  it("enforces max limit for conveyances per bill group", () => {
    const conveyances = Array(100).fill(conveyance);
    const invalidInput: CargoReleaseTransactionInput = {
      header,
      contactCancellation,
      bills: [
        {
          billsOfLading: [billOfLading],
          conveyances,
        },
      ],
      lines: [{ lineItem, htsLines: [{ htsLine }] }],
    };

    expect(() => assembleTransaction(invalidInput)).toThrow(AbiFixedWidthError);
    expect(() => assembleTransaction(invalidInput)).toThrow(/exceeding spec limit of 99/);
  });

  it("enforces max limit for header level entity groups", () => {
    const headerEntities = Array(13).fill({ entity: headerEntity });
    const invalidInput: CargoReleaseTransactionInput = {
      header,
      contactCancellation,
      headerEntities,
      lines: [{ lineItem, htsLines: [{ htsLine }] }],
    };

    expect(() => assembleTransaction(invalidInput)).toThrow(AbiFixedWidthError);
    expect(() => assembleTransaction(invalidInput)).toThrow(/exceeding spec limit of 12/);
  });

  it("enforces max limit for HTS lines per line item group", () => {
    const htsLines = Array(33).fill({ htsLine });
    const invalidInput: CargoReleaseTransactionInput = {
      header,
      contactCancellation,
      lines: [
        {
          lineItem,
          htsLines,
        },
      ],
    };

    expect(() => assembleTransaction(invalidInput)).toThrow(AbiFixedWidthError);
    expect(() => assembleTransaction(invalidInput)).toThrow(/must be between 1 and 32/);
  });
});
