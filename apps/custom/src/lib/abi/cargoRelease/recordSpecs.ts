import {
  dateField,
  dateFieldNumericMMDDYY,
  filler,
  constantField,
  numericCodeField,
  type FieldSpec,
  type RecordSpec,
} from "@/lib/abi/fixedWidth";
import { Decimal, roundToCents } from "@/lib/tariff/decimal";
import type {
  HeaderInput,
  AdditionalHeaderInput,
  ContactCancellationInput,
  BillOfLadingInput,
  ConveyanceInput,
  ReferenceInput,
  EntityInput,
  EntityAddressInput,
  EntityGeoInput,
  LineItemInput,
  HtsLineInput,
  OutputDispositionInput,
  EquipmentInput,
  EntityGbiInput,
  FtzDetailInput,
  FtzPfHtsInput,
} from "./types";

// RecordSpecs for the CATAIR Cargo Release (SE) chapter.
// Source: docs/plans/catair-source-docs/04-cargo-release-implementation-guide-v40.pdf
// Position math for every field cross-checked against the extracted PDF tables
// (including internal filler gaps — not just trailing fillers) before writing.

/** A whole-dollar (no implied decimals) numeric amount field, bound to `Decimal`. */
function wholeDollarField<K extends string>(
  key: K,
  start: number,
  length: number,
  designation: "M" | "C" | "O"
): FieldSpec<K> {
  return {
    key,
    start,
    length,
    class: "SN",
    designation,
    encodeValue: (raw) => roundToCents(raw as Decimal).toDecimalPlaces(0).toString().padStart(length, "0"),
    decodeValue: (field) => {
      const trimmed = field.trim();
      return trimmed.length === 0 ? undefined : new Decimal(trimmed);
    },
  };
}

export const SE10_HEADER_SPEC: RecordSpec<HeaderInput> = {
  recordType: "SE10-Record (SE Header)",
  length: 80,
  fields: [
    constantField(1, "SE10"),
    { key: "actionCode", start: 5, length: 1, class: "A", designation: "M" },
    { key: "entryFilerCode", start: 6, length: 3, class: "AN", designation: "M" },
    filler(9, 2),
    { key: "entryNumber", start: 11, length: 8, class: "AN", designation: "M" },
    filler(19, 1),
    { key: "entryTypeCode", start: 20, length: 2, class: "AN", designation: "M" },
    { key: "importerOfRecordType", start: 22, length: 3, class: "AN", designation: "C" },
    { key: "importerOfRecordNumber", start: 25, length: 12, class: "X", designation: "C" },
    { key: "modeOfTransportationCode", start: 37, length: 2, class: "AN", designation: "C" },
    { key: "bondTypeCode", start: 39, length: 1, class: "N", designation: "M" },
    wholeDollarField("estimatedEntryValue", 40, 10, "M"),
    { key: "plannedPortOfEntry", start: 50, length: 5, class: "AN", designation: "C" },
    { key: "splitShipmentReleaseCode", start: 55, length: 1, class: "AN", designation: "O" },
    { key: "portOfUnlading", start: 56, length: 5, class: "AN", designation: "C" },
    filler(61, 20),
  ],
};

export const SE11_ADDITIONAL_HEADER_SPEC: RecordSpec<AdditionalHeaderInput> = {
  recordType: "SE11-Record (SE Additional Header)",
  length: 80,
  fields: [
    constantField(1, "SE11"),
    { key: "entryDateElectionCode", start: 5, length: 1, class: "X", designation: "C" },
    dateField("electedEntryDate", 6, "C"),
    { key: "locationOfGoodsFirms", start: 12, length: 4, class: "AN", designation: "C" },
    { key: "electedExamSiteFirms", start: 16, length: 4, class: "AN", designation: "O" },
    { key: "conveyanceNameOrFtzId", start: 20, length: 20, class: "X", designation: "C" },
    { key: "voyageFlightTripManifestNumber", start: 40, length: 5, class: "X", designation: "C" },
    { key: "generalOrderNumber", start: 45, length: 20, class: "AN", designation: "O" },
    { key: "cbpBondedWarehouseFirms", start: 65, length: 4, class: "AN", designation: "C" },
    { key: "originatingWarehouseEntryFilerCode", start: 69, length: 3, class: "AN", designation: "C" },
    { key: "originatingWarehouseEntryNumber", start: 72, length: 8, class: "AN", designation: "C" },
    { key: "immediateDeliveryIndicator", start: 80, length: 1, class: "X", designation: "C" },
  ],
};

export const SE13_CONTACT_CANCEL_SPEC: RecordSpec<ContactCancellationInput> = {
  recordType: "SE13-Record (Contact / Cancellation)",
  length: 80,
  fields: [
    constantField(1, "SE13"),
    { key: "contactName", start: 5, length: 40, class: "AN", designation: "M" },
    { key: "contactPhone", start: 45, length: 15, class: "AN", designation: "M" },
    { key: "cancellationReasonCode", start: 60, length: 2, class: "AN", designation: "C" },
    { key: "multipleCargoDispositionsIndicator", start: 62, length: 1, class: "N", designation: "O" },
    { key: "disIndicator", start: 63, length: 1, class: "N", designation: "O" },
    { key: "splitShipmentIndicator", start: 64, length: 1, class: "N", designation: "O" },
    filler(65, 16),
  ],
};

export const SE15_BILL_OF_LADING_SPEC: RecordSpec<BillOfLadingInput> = {
  recordType: "SE15-Record (Bill of Lading Information)",
  length: 80,
  fields: [
    constantField(1, "SE15"),
    { key: "billTypeIndicator", start: 5, length: 1, class: "A", designation: "M" },
    { key: "issuerCodeOfBillOfLadingNumber", start: 6, length: 4, class: "AN", designation: "C" },
    { key: "billOfLadingNumber", start: 10, length: 50, class: "X", designation: "M" },
    { key: "quantity", start: 60, length: 8, class: "N", designation: "C" },
    filler(68, 5),
    { key: "nonAmsIndicator", start: 73, length: 1, class: "X", designation: "M" },
    filler(74, 7),
  ],
};

export const SE16_CONVEYANCE_SPEC: RecordSpec<ConveyanceInput> = {
  recordType: "SE16-Record (Conveyance Information)",
  length: 80,
  fields: [
    constantField(1, "SE16"),
    { key: "carrierCode", start: 5, length: 4, class: "AN", designation: "M" },
    { key: "voyageFlightTripManifestNumber", start: 9, length: 5, class: "X", designation: "M" },
    dateField("dateOfArrival", 14, "M"),
    { key: "quantity", start: 20, length: 8, class: "N", designation: "M" },
    { key: "unitOfMeasure", start: 28, length: 5, class: "X", designation: "O" },
    { key: "conveyanceName", start: 33, length: 20, class: "X", designation: "C" },
    filler(53, 28),
  ],
};

export const SE17_EQUIPMENT_SPEC: RecordSpec<EquipmentInput> = {
  recordType: "SE17-Record (Equipment Detail)",
  length: 80,
  fields: [
    constantField(1, "SE17"),
    { key: "equipmentNumber", start: 5, length: 20, class: "AN", designation: "M" },
    filler(25, 56),
  ],
};

export const SE20_REFERENCE_SPEC: RecordSpec<ReferenceInput> = {
  recordType: "SE20-Record (Reference Information)",
  length: 80,
  fields: [
    constantField(1, "SE20"),
    { key: "referenceIdentifierQualifier", start: 5, length: 3, class: "AN", designation: "M" },
    { key: "referenceIdentifier", start: 8, length: 50, class: "X", designation: "M" },
    filler(58, 23),
  ],
};

export const SE30_HEADER_ENTITY_SPEC: RecordSpec<EntityInput> = {
  recordType: "SE30-Record (Header Entity Name and Type)",
  length: 80,
  fields: [
    constantField(1, "SE30"),
    { key: "entityCode", start: 5, length: 3, class: "A", designation: "M" },
    { key: "entityName", start: 8, length: 35, class: "X", designation: "C" },
    { key: "entityIdentifierQualifier", start: 43, length: 3, class: "X", designation: "C" },
    { key: "entityIdentifier", start: 46, length: 20, class: "X", designation: "C" },
    filler(66, 15),
  ],
};

/** Shared by SE31 (header) and SE51 (line) — see `EntityGbiInput`. */
export const SE31_HEADER_ENTITY_GBI_SPEC: RecordSpec<EntityGbiInput> = {
  recordType: "SE31-Record (Header Entity GBI Identifier)",
  length: 80,
  fields: [
    constantField(1, "SE31"),
    { key: "gbiIdentifierQualifier", start: 5, length: 4, class: "A", designation: "M" },
    { key: "gbiIdentifier", start: 9, length: 20, class: "AN", designation: "M" },
    filler(29, 52),
  ],
};

export const SE35_HEADER_ENTITY_ADDRESS_SPEC: RecordSpec<EntityAddressInput> = {
  recordType: "SE35-Record (Header Entity Street Address)",
  length: 80,
  fields: [
    constantField(1, "SE35"),
    { key: "addressComponentQualifier1", start: 5, length: 2, class: "AN", designation: "M" },
    { key: "addressInformation1", start: 7, length: 35, class: "X", designation: "M" },
    { key: "addressComponentQualifier2", start: 42, length: 2, class: "AN", designation: "O" },
    { key: "addressInformation2", start: 44, length: 35, class: "X", designation: "O" },
    filler(79, 2),
  ],
};

export const SE36_HEADER_ENTITY_GEO_SPEC: RecordSpec<EntityGeoInput> = {
  recordType: "SE36-Record (Header Entity Geographic Area)",
  length: 80,
  fields: [
    constantField(1, "SE36"),
    { key: "cityName", start: 5, length: 35, class: "X", designation: "M" },
    { key: "countrySubEntityCode", start: 40, length: 3, class: "AN", designation: "O" },
    filler(43, 6),
    { key: "postalCode", start: 49, length: 15, class: "X", designation: "C" },
    { key: "countryCode", start: 64, length: 2, class: "A", designation: "M" },
    filler(66, 15),
  ],
};

export const SE40_LINE_ITEM_SPEC: RecordSpec<LineItemInput> = {
  recordType: "SE40-Record (Line Item)",
  length: 80,
  fields: [
    constantField(1, "SE40"),
    numericCodeField("lineItemIdentifier", 5, 3, "M"),
    { key: "countryOfOrigin", start: 8, length: 2, class: "A", designation: "M" },
    filler(10, 1),
    { key: "commercialInvoiceDescription", start: 11, length: 70, class: "X", designation: "O" },
  ],
};

export const SE41_FTZ_DETAIL_SPEC: RecordSpec<FtzDetailInput> = {
  recordType: "SE41-Record (FTZ Detail)",
  length: 80,
  fields: [
    constantField(1, "SE41"),
    { key: "zoneStatus", start: 5, length: 1, class: "A", designation: "M" },
    // Privileged FTZ Merchandise Filing Date is documented as class "6N" (not
    // class D) — same "MMDDYY digit order, class-N wire tag" convention as
    // ACE Cargo Manifest Query's output dates, hence `dateFieldNumericMMDDYY`.
    dateFieldNumericMMDDYY("privilegedFtzMerchandiseFilingDate", 6, "C"),
    { key: "ftzLineItemQuantity", start: 12, length: 8, class: "N", designation: "M" },
    filler(20, 61),
  ],
};

export const SE50_LINE_ENTITY_SPEC: RecordSpec<EntityInput> = {
  recordType: "SE50-Record (Line Entity Name and Type)",
  length: 80,
  fields: [
    constantField(1, "SE50"),
    { key: "entityCode", start: 5, length: 3, class: "A", designation: "M" },
    { key: "entityName", start: 8, length: 35, class: "X", designation: "C" },
    { key: "entityIdentifierQualifier", start: 43, length: 3, class: "X", designation: "O" },
    { key: "entityIdentifier", start: 46, length: 20, class: "X", designation: "O" },
    filler(66, 15),
  ],
};

/** Shared by SE31 (header) and SE51 (line) — see `EntityGbiInput`. */
export const SE51_LINE_ENTITY_GBI_SPEC: RecordSpec<EntityGbiInput> = {
  recordType: "SE51-Record (Line Entity GBI Identifier)",
  length: 80,
  fields: [
    constantField(1, "SE51"),
    { key: "gbiIdentifierQualifier", start: 5, length: 4, class: "A", designation: "M" },
    { key: "gbiIdentifier", start: 9, length: 20, class: "AN", designation: "M" },
    filler(29, 52),
  ],
};

export const SE55_LINE_ENTITY_ADDRESS_SPEC: RecordSpec<EntityAddressInput> = {
  recordType: "SE55-Record (Line Entity Street Address)",
  length: 80,
  fields: [
    constantField(1, "SE55"),
    { key: "addressComponentQualifier1", start: 5, length: 2, class: "AN", designation: "M" },
    { key: "addressInformation1", start: 7, length: 35, class: "X", designation: "M" },
    { key: "addressComponentQualifier2", start: 42, length: 2, class: "AN", designation: "O" },
    { key: "addressInformation2", start: 44, length: 35, class: "X", designation: "O" },
    filler(79, 2),
  ],
};

export const SE56_LINE_ENTITY_GEO_SPEC: RecordSpec<EntityGeoInput> = {
  recordType: "SE56-Record (Line Entity Geographic Area)",
  length: 80,
  fields: [
    constantField(1, "SE56"),
    { key: "cityName", start: 5, length: 35, class: "X", designation: "M" },
    { key: "countrySubEntityCode", start: 40, length: 3, class: "AN", designation: "O" },
    filler(43, 6),
    { key: "postalCode", start: 49, length: 15, class: "X", designation: "C" },
    { key: "countryCode", start: 64, length: 2, class: "A", designation: "M" },
    filler(66, 15),
  ],
};

export const SE60_HTS_LINE_SPEC: RecordSpec<HtsLineInput> = {
  recordType: "SE60-Record (HTS Line)",
  length: 80,
  fields: [
    constantField(1, "SE60"),
    { key: "htsNumber", start: 5, length: 10, class: "AN", designation: "M" },
    wholeDollarField("lineItemValue", 15, 10, "C"),
    filler(25, 56),
  ],
};

export const SE61_FTZ_PF_HTS_SPEC: RecordSpec<FtzPfHtsInput> = {
  recordType: "SE61-Record (FTZ Privileged Foreign Status Additional Detail)",
  length: 80,
  fields: [
    constantField(1, "SE61"),
    { key: "currentHtsNumberForPfStatusMerchandise", start: 5, length: 10, class: "AN", designation: "M" },
    filler(15, 66),
  ],
};

export const SE90_OUTPUT_DISPOSITION_SPEC: RecordSpec<OutputDispositionInput> = {
  recordType: "SE90-Record (Output Disposition)",
  length: 80,
  fields: [
    constantField(1, "SE90"),
    { key: "messageTypeCode", start: 5, length: 2, class: "AN", designation: "M" },
    { key: "messageIdentifierCode", start: 7, length: 3, class: "AN", designation: "C" },
    { key: "narrativeMessageText", start: 10, length: 40, class: "X", designation: "M" },
    filler(50, 31),
  ],
};
