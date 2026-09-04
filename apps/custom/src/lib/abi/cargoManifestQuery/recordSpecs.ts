import {
  dateFieldNumericMMDDYY,
  filler,
  constantField,
  numericCodeField,
  type Designation,
  type FieldSpec,
  type RecordSpec,
} from "@/lib/abi/fixedWidth";
import type {
  CargoManifestQueryRequestInput,
  CargoManifestQueryErrorOutput,
  EntryStatusHeaderOutput,
  EntryDispositionResultOutput,
  ManifestConveyanceResultOutput,
  TripFirmsLocationOutput,
  InBondBillQueryErrorOutput,
  AirWaybillQueryErrorOutput,
  CountryOriginTariffResultOutput,
  InBondStatusUpdateOutput,
  InBondBillDetailOutput,
  InBondStatusDetailOutput,
  AirInBondManifestStatusOutput,
  AirWaybillDispositionResultOutput,
  InBondBillDispositionResultOutput,
  AmendedBillQuantitiesOutput,
  PortDateDetailOutput,
  ReferenceDataOutput,
  CountryOriginTariffLineOutput,
  BillDetailOutput,
  InBondDetailOutput,
  BillMatchDispositionOutput,
  PgaStatusActionDetailOutput,
  PgaReferenceIdentificationDetailOutput,
  PgaNarrativeCommentsOutput,
} from "./types";

// RecordSpecs for the CATAIR ACE Cargo Manifest/In-bond/Entry Status Query
// chapter (04b) — the 6 records forming one complete "query an entry, get
// its status back" round trip. Position math cross-checked against the
// extracted spec tables (and the source PDF directly for the two documented
// quirks below) to sum to exactly 80 per record before writing.
// Source: docs/plans/catair-source-docs/04b-cargo-manifest-bond-entry-status-query-v21.pdf

/**
 * The WR-Record family's Entry Number field (WR0, WR1-Input, WR1-Output) is
 * 9 chars wide on the wire — one char wider than the 8-char Appendix E entry
 * number (7-digit transaction number + check digit) it carries — and the
 * WR1-Input field's own note explicitly says "The number must be right
 * justified," unlike this codec's default AN encoding (left-justified,
 * space-padded end). So this right-pads at the *start* instead: an 8-char
 * value becomes " 12345678" (leading space + value), and decode trims that
 * leading space back off. Distinct from WO10's plain 8AN Entry Number field
 * (no right-justify note there, and it's already exactly 8 chars wide), which
 * uses a plain field instead.
 */
function rightJustifiedEntryNumberField<K extends string>(
  key: K,
  start: number,
  designation: Designation
): FieldSpec<K> {
  return {
    key,
    start,
    length: 9,
    class: "AN",
    designation,
    encodeValue: (raw) => String(raw).padStart(9, " "),
    decodeValue: (field) => (field.trim().length === 0 ? undefined : field.trimStart()),
  };
}

// ── WR1-Record (Input): Cargo Manifest Query Request ────────────────────────

export const CARGO_MANIFEST_QUERY_REQUEST_SPEC: RecordSpec<CargoManifestQueryRequestInput> = {
  recordType: "WR1-Record (Cargo Manifest Query Request, Input)",
  length: 80,
  fields: [
    constantField(1, "WR"),
    constantField(3, "1"),
    filler(4, 4),
    { key: "entryFilerCode", start: 8, length: 3, class: "AN", designation: "C" },
    rightJustifiedEntryNumberField("entryNumber", 11, "C"),
    { key: "inBondNumber", start: 20, length: 12, class: "AN", designation: "C" },
    { key: "issuerCode", start: 32, length: 4, class: "AN", designation: "C" },
    { key: "billNumber", start: 36, length: 12, class: "AN", designation: "C" },
    { key: "airWaybillNumber", start: 48, length: 11, class: "AN", designation: "C" },
    { key: "houseAirWaybillNumber", start: 59, length: 12, class: "AN", designation: "O" },
    { key: "requestRelatedBol", start: 71, length: 1, class: "AN", designation: "O" },
    { key: "requestBillAndEntryData", start: 72, length: 1, class: "AN", designation: "O" },
    { key: "limitOutputOption", start: 73, length: 1, class: "AN", designation: "O" },
    filler(74, 7),
  ],
};

// ── WR0-Record (Output): Entry Query Error ───────────────────────────────────

export const CARGO_MANIFEST_QUERY_ERROR_SPEC: RecordSpec<CargoManifestQueryErrorOutput> = {
  recordType: "WR0-Record (Entry Query Error, Output)",
  length: 80,
  fields: [
    constantField(1, "WR"),
    constantField(3, "0"),
    { key: "entryFilerCode", start: 4, length: 3, class: "AN", designation: "M" },
    rightJustifiedEntryNumberField("entryNumber", 7, "M"),
    filler(16, 14),
    { key: "errorMessageId", start: 30, length: 3, class: "AN", designation: "M" },
    { key: "narrativeMessage", start: 33, length: 40, class: "X", designation: "M" },
    filler(73, 8),
  ],
};

// ── WO10-Record (Output): Entry Status Processing Header ────────────────────

export const ENTRY_STATUS_HEADER_SPEC: RecordSpec<EntryStatusHeaderOutput> = {
  recordType: "WO10-Record (Entry Status Processing Header, Output)",
  length: 80,
  fields: [
    constantField(1, "WO10"),
    numericCodeField("districtPortOfEntry", 5, 4, "C"),
    { key: "entryFilerCode", start: 9, length: 3, class: "AN", designation: "M" },
    filler(12, 2),
    { key: "entryNumber", start: 14, length: 8, class: "AN", designation: "M" },
    filler(22, 1),
    numericCodeField("entryTypeCode", 23, 2, "M"),
    { key: "importerOfRecordNumber", start: 25, length: 12, class: "X", designation: "M" },
    { key: "carrierCode", start: 37, length: 4, class: "AN", designation: "C" },
    { key: "vesselName", start: 41, length: 20, class: "AN", designation: "C" },
    { key: "voyageFlightTripNumber", start: 61, length: 5, class: "X", designation: "C" },
    dateFieldNumericMMDDYY("estimatedDateOfArrival", 66, "C"),
    { key: "splitShipmentReleaseCode", start: 72, length: 1, class: "AN", designation: "O" },
    { key: "correctionResponseIndicator", start: 73, length: 1, class: "X", designation: "C" },
    filler(74, 7),
  ],
};

// ── WO60-Record (Output): Disposition/Status Result ─────────────────────────
//
// The source PDF's own field table states Document Type's position range as
// "65-67" but its Length/Class as "6AN" (6 chars) — internally inconsistent.
// Position math resolves it: 65-70 (6 chars) for Document Type + 71-80 (10
// chars) for Filler sums to exactly 80; "65-67" (3 chars) would leave the
// record 3 chars short. Implemented as 65-70 per that resolution.

export const ENTRY_DISPOSITION_RESULT_SPEC: RecordSpec<EntryDispositionResultOutput> = {
  recordType: "WO60-Record (Disposition/Status Result, Output)",
  length: 80,
  fields: [
    constantField(1, "WO60"),
    dateFieldNumericMMDDYY("dispositionActionDate", 5, "M"),
    numericCodeField("dispositionActionTime", 11, 4, "M"),
    { key: "dispositionActionCode", start: 15, length: 2, class: "AN", designation: "M" },
    { key: "narrativeMessage", start: 17, length: 40, class: "X", designation: "M" },
    dateFieldNumericMMDDYY("releaseDate", 57, "C"),
    numericCodeField("releaseOriginCode", 63, 2, "C"),
    { key: "documentType", start: 65, length: 6, class: "AN", designation: "C" },
    filler(71, 10),
  ],
};

// ── WR1-Record (Output): Manifest Processing Results / Conveyance ───────────
// A completely different field layout from the WR1-Record (Input) above
// despite sharing the same 2-char "WR" + Record Type "1" control identifier
// — see the module comment in types.ts.

export const MANIFEST_CONVEYANCE_RESULT_SPEC: RecordSpec<ManifestConveyanceResultOutput> = {
  recordType: "WR1-Record (Manifest Processing Results / Conveyance, Output)",
  length: 80,
  fields: [
    constantField(1, "WR"),
    constantField(3, "1"),
    numericCodeField("districtPortOfEntry", 4, 4, "C"),
    { key: "entryFilerCode", start: 8, length: 3, class: "AN", designation: "C" },
    rightJustifiedEntryNumberField("entryNumber", 11, "C"),
    numericCodeField("entryTypeCode", 20, 2, "C"),
    { key: "importerOfRecordNumber", start: 22, length: 12, class: "X", designation: "C" },
    { key: "brokerReferenceNumber", start: 34, length: 9, class: "X", designation: "C" },
    { key: "carrierCode", start: 43, length: 4, class: "AN", designation: "C" },
    { key: "importingVesselCodeOrConveyanceName", start: 47, length: 20, class: "AN", designation: "C" },
    { key: "voyageFlightTripNumber", start: 67, length: 5, class: "X", designation: "M" },
    dateFieldNumericMMDDYY("dateOfArrival", 72, "M"),
    filler(78, 3),
  ],
};

// ── WR2-Record (Output): Trip Number & FIRMS Cargo Location ─────────────────

export const TRIP_FIRMS_LOCATION_SPEC: RecordSpec<TripFirmsLocationOutput> = {
  recordType: "WR2-Record (Trip Number & FIRMS Cargo Location, Output)",
  length: 80,
  fields: [
    constantField(1, "WR"),
    constantField(3, "2"),
    { key: "tripNumber", start: 4, length: 25, class: "AN", designation: "M" },
    filler(29, 48),
    { key: "firmsCode", start: 77, length: 4, class: "AN", designation: "M" },
  ],
};

// ── WSA-Record (Output): In-Bond/Bill Query Error ───────────────────────────

export const IN_BOND_BILL_QUERY_ERROR_SPEC: RecordSpec<InBondBillQueryErrorOutput> = {
  recordType: "WSA-Record (In-Bond/Bill Query Error, Output)",
  length: 80,
  fields: [
    constantField(1, "WS"),
    constantField(3, "A"),
    { key: "inBondNumber", start: 4, length: 12, class: "AN", designation: "C" },
    { key: "issuerCode", start: 16, length: 4, class: "AN", designation: "C" },
    { key: "billNumber", start: 20, length: 12, class: "AN", designation: "C" },
    { key: "errorMessageId", start: 32, length: 3, class: "AN", designation: "M" },
    { key: "narrativeMessage", start: 35, length: 40, class: "X", designation: "M" },
    filler(75, 6),
  ],
};

// ── WSB-Record (Output): Air Waybill Query Error ─────────────────────────────

export const AIR_WAYBILL_QUERY_ERROR_SPEC: RecordSpec<AirWaybillQueryErrorOutput> = {
  recordType: "WSB-Record (Air Waybill Query Error, Output)",
  length: 80,
  fields: [
    constantField(1, "WS"),
    constantField(3, "B"),
    { key: "airWaybillNumber", start: 4, length: 11, class: "AN", designation: "M" },
    { key: "houseAirWaybillNumber", start: 15, length: 12, class: "AN", designation: "O" },
    { key: "errorMessageId", start: 27, length: 3, class: "AN", designation: "M" },
    { key: "narrativeMessage", start: 30, length: 40, class: "X", designation: "M" },
    filler(70, 11),
  ],
};

// ── WR3-Record (Output): Country of Origin & Tariff ──────────────────────────

export const COUNTRY_ORIGIN_TARIFF_RESULT_SPEC: RecordSpec<CountryOriginTariffResultOutput> = {
  recordType: "WR3-Record (Country of Origin & Tariff, Output)",
  length: 80,
  fields: [
    constantField(1, "WR"),
    constantField(3, "3"),
    numericCodeField("recordControlNumber", 4, 3, "C"),
    { key: "countryOfOrigin", start: 7, length: 2, class: "A", designation: "M" },
    { key: "tariffNumber", start: 9, length: 10, class: "AN", designation: "M" },
    filler(19, 62),
  ],
};

// ── WS4-Record (Output): In-Bond Status (Update) ─────────────────────────────

export const IN_BOND_STATUS_UPDATE_SPEC: RecordSpec<InBondStatusUpdateOutput> = {
  recordType: "WS4-Record (In-Bond Status Update, Output)",
  length: 80,
  fields: [
    constantField(1, "WS"),
    constantField(3, "4"),
    { key: "inBondStatus", start: 4, length: 2, class: "AN", designation: "C" },
    dateFieldNumericMMDDYY("inBondArrivalDate", 6, "C"),
    dateFieldNumericMMDDYY("inBondExportDate", 12, "C"),
    filler(18, 58),
    { key: "inBondEntryType", start: 76, length: 2, class: "AN", designation: "C" },
    filler(78, 3),
  ],
};

// ── WR4-Record (Output): In-Bond Bill Detail ─────────────────────────────────

export const IN_BOND_BILL_DETAIL_SPEC: RecordSpec<InBondBillDetailOutput> = {
  recordType: "WR4-Record (In-Bond Bill Detail, Output)",
  length: 80,
  fields: [
    constantField(1, "WR"),
    constantField(3, "4"),
    { key: "inBondNumber", start: 4, length: 12, class: "AN", designation: "C" },
    { key: "masterBillNumber", start: 16, length: 12, class: "AN", designation: "C" },
    { key: "houseBillNumber", start: 28, length: 12, class: "AN", designation: "C" },
    { key: "subHouseBillNumber", start: 40, length: 12, class: "AN", designation: "C" },
    { key: "manifestQuantity", start: 52, length: 8, class: "N", designation: "C" },
    { key: "unit", start: 60, length: 5, class: "X", designation: "C" },
    { key: "issuerCodeOfMasterBillNumber", start: 65, length: 4, class: "AN", designation: "C" },
    { key: "issuerCodeOfHouseBillNumber", start: 69, length: 4, class: "AN", designation: "C" },
    { key: "billOfLadingType", start: 73, length: 1, class: "X", designation: "C" },
    { key: "importerSecurityFilingIndicator", start: 74, length: 1, class: "X", designation: "C" },
    { key: "modeOfTransportationCode", start: 75, length: 1, class: "X", designation: "C" },
    filler(76, 5),
  ],
};

// ── WS5-Record (Output): In-Bond Status (Detail) ─────────────────────────────

export const IN_BOND_STATUS_DETAIL_SPEC: RecordSpec<InBondStatusDetailOutput> = {
  recordType: "WS5-Record (In-Bond Status Detail, Output)",
  length: 80,
  fields: [
    constantField(1, "WS"),
    constantField(3, "5"),
    { key: "inBondStatus", start: 4, length: 2, class: "AN", designation: "C" },
    dateFieldNumericMMDDYY("inBondArrivalDate", 6, "C"),
    dateFieldNumericMMDDYY("inBondExportDate", 12, "C"),
    filler(18, 58),
    { key: "inBondEntryType", start: 76, length: 2, class: "AN", designation: "C" },
    filler(78, 3),
  ],
};

// ── WSC-Record (Output): Air In-Bond/Manifest Status Detail ─────────────────

export const AIR_IN_BOND_MANIFEST_STATUS_SPEC: RecordSpec<AirInBondManifestStatusOutput> = {
  recordType: "WSC-Record (Air In-Bond/Manifest Status Detail, Output)",
  length: 80,
  fields: [
    constantField(1, "WS"),
    constantField(3, "C"),
    { key: "importingCarrierCode", start: 4, length: 3, class: "AN", designation: "M" },
    { key: "flightNumber", start: 7, length: 5, class: "AN", designation: "M" },
    dateFieldNumericMMDDYY("scheduledArrivalDate", 12, "M"),
    { key: "airWaybillNumber", start: 18, length: 11, class: "AN", designation: "M" },
    { key: "partIndicator", start: 29, length: 1, class: "A", designation: "C" },
    { key: "manifestQuantity", start: 30, length: 5, class: "N", designation: "M" },
    { key: "boardedQuantity", start: 35, length: 5, class: "N", designation: "C" },
    { key: "houseAirWaybillNumber", start: 40, length: 12, class: "AN", designation: "O" },
    { key: "housePartIndicator", start: 52, length: 1, class: "A", designation: "C" },
    { key: "houseManifestQuantity", start: 53, length: 5, class: "N", designation: "C" },
    { key: "houseBoardedQuantity", start: 58, length: 5, class: "N", designation: "C" },
    numericCodeField("inBondNumber", 63, 11, "C"),
    { key: "inBondStatus", start: 74, length: 2, class: "AN", designation: "C" },
    { key: "inBondEntryType", start: 76, length: 2, class: "AN", designation: "C" },
    filler(78, 2),
    { key: "wscRecordVersion", start: 80, length: 1, class: "AN", designation: "C" },
  ],
};

// ── WSD-Record (Output): Air Waybill Disposition Result ─────────────────────

export const AIR_WAYBILL_DISPOSITION_RESULT_SPEC: RecordSpec<AirWaybillDispositionResultOutput> = {
  recordType: "WSD-Record (Air Waybill Disposition Result, Output)",
  length: 80,
  fields: [
    constantField(1, "WS"),
    constantField(3, "D"),
    dateFieldNumericMMDDYY("dispositionActionDate", 4, "M"),
    numericCodeField("dispositionActionTime", 10, 6, "M"),
    { key: "dispositionCode", start: 16, length: 2, class: "AN", designation: "M" },
    { key: "narrativeMessage", start: 18, length: 40, class: "X", designation: "M" },
    { key: "inBondOrEntryNumber", start: 58, length: 12, class: "AN", designation: "C" },
    filler(70, 11),
  ],
};

// ── WR5-Record (Output): In-Bond/Bill Disposition Result ────────────────────

export const IN_BOND_BILL_DISPOSITION_RESULT_SPEC: RecordSpec<InBondBillDispositionResultOutput> = {
  recordType: "WR5-Record (In-Bond/Bill Disposition Result, Output)",
  length: 80,
  fields: [
    constantField(1, "WR"),
    constantField(3, "5"),
    dateFieldNumericMMDDYY("dispositionActionDate", 4, "M"),
    numericCodeField("dispositionActionTime", 10, 4, "M"),
    { key: "dispositionActionCode", start: 14, length: 3, class: "AN", designation: "M" },
    { key: "narrativeMessage", start: 17, length: 40, class: "X", designation: "M" },
    filler(57, 1),
    dateFieldNumericMMDDYY("releaseDate", 58, "C"),
    numericCodeField("releaseOriginCode", 64, 2, "C"),
    { key: "quantity", start: 66, length: 8, class: "N", designation: "C" },
    filler(74, 1),
    numericCodeField("sequence", 75, 3, "C"),
    filler(78, 3),
  ],
};

// ── WN0-Record (Output): Amended Bill Quantities ─────────────────────────────

export const AMENDED_BILL_QUANTITIES_SPEC: RecordSpec<AmendedBillQuantitiesOutput> = {
  recordType: "WN0-Record (Amended Bill Quantities, Output)",
  length: 80,
  fields: [
    constantField(1, "WN"),
    constantField(3, "0"),
    { key: "masterBillAmendedQuantity", start: 4, length: 8, class: "N", designation: "C" },
    { key: "houseBillAmendedQuantity", start: 12, length: 8, class: "N", designation: "C" },
    filler(20, 61),
  ],
};

// ── WN1-Record (Output): Port & Date Detail ──────────────────────────────────

export const PORT_DATE_DETAIL_SPEC: RecordSpec<PortDateDetailOutput> = {
  recordType: "WN1-Record (Port & Date Detail, Output)",
  length: 80,
  fields: [
    constantField(1, "WN"),
    constantField(3, "1"),
    { key: "inBondEntryNumber", start: 4, length: 12, class: "AN", designation: "C" },
    { key: "manifestedPortOfUnladingImport", start: 16, length: 4, class: "AN", designation: "M" },
    { key: "actualPortOfUnladingImport", start: 20, length: 4, class: "AN", designation: "C" },
    { key: "actualPortOfUnladingImportOceanVesselDiversion", start: 24, length: 4, class: "AN", designation: "C" },
    { key: "inBondOriginatingPort", start: 28, length: 4, class: "AN", designation: "C" },
    { key: "manifestedInBondDestinationPort", start: 32, length: 4, class: "AN", designation: "C" },
    { key: "actualInBondDestinationManualDiversion", start: 36, length: 4, class: "AN", designation: "C" },
    { key: "actualInBondDestinationEdiDiversion", start: 40, length: 4, class: "AN", designation: "C" },
    { key: "vesselDeparturePort", start: 44, length: 5, class: "AN", designation: "C" },
    dateFieldNumericMMDDYY("vesselDepartureDate", 49, "C"),
    { key: "containerLoadPort", start: 55, length: 17, class: "AN", designation: "C" },
    { key: "containerLoadDate", start: 72, length: 6, class: "AN", designation: "C" },
    filler(78, 3),
  ],
};

// ── WO20-Record (Output): Reference Data ─────────────────────────────────────
// See the module comment in types.ts on the source PDF's "(Output)"
// paragraph vs. "(Input)" table-header artifact.

export const REFERENCE_DATA_SPEC: RecordSpec<ReferenceDataOutput> = {
  recordType: "WO20-Record (Reference Data, Output)",
  length: 80,
  fields: [
    constantField(1, "WO20"),
    { key: "referenceIdentifierQualifier", start: 5, length: 3, class: "AN", designation: "M" },
    { key: "referenceIdentifier", start: 8, length: 50, class: "X", designation: "M" },
    filler(58, 23),
  ],
};

// ── WO30-Record (Output): Country of Origin & Tariff (Line) ─────────────────

export const COUNTRY_ORIGIN_TARIFF_LINE_SPEC: RecordSpec<CountryOriginTariffLineOutput> = {
  recordType: "WO30-Record (Country of Origin & Tariff Line, Output)",
  length: 80,
  fields: [
    constantField(1, "WO30"),
    numericCodeField("lineItemIdentifier", 5, 3, "M"),
    { key: "countryOfOrigin", start: 8, length: 2, class: "A", designation: "M" },
    { key: "tariffNumber", start: 10, length: 10, class: "AN", designation: "M" },
    filler(20, 61),
  ],
};

// ── WO40-Record (Output): Bill Detail ────────────────────────────────────────

export const BILL_DETAIL_SPEC: RecordSpec<BillDetailOutput> = {
  recordType: "WO40-Record (Bill Detail, Output)",
  length: 80,
  fields: [
    constantField(1, "WO40"),
    { key: "billTypeIndicator", start: 5, length: 1, class: "A", designation: "M" },
    { key: "issuerCode", start: 6, length: 4, class: "AN", designation: "C" },
    { key: "billNumber", start: 10, length: 50, class: "X", designation: "M" },
    { key: "quantity", start: 60, length: 8, class: "N", designation: "C" },
    { key: "unitOfMeasure", start: 68, length: 5, class: "X", designation: "C" },
    { key: "manifestedQuantity", start: 73, length: 8, class: "X", designation: "C" },
  ],
};

// ── WO42-Record (Output): In-Bond Detail ─────────────────────────────────────

export const IN_BOND_DETAIL_SPEC: RecordSpec<InBondDetailOutput> = {
  recordType: "WO42-Record (In-Bond Detail, Output)",
  length: 80,
  fields: [
    constantField(1, "WO42"),
    { key: "inBondNumber", start: 5, length: 12, class: "AN", designation: "M" },
    numericCodeField("inBondEntryType", 17, 2, "M"),
    numericCodeField("usPortOfInBondDeparture", 19, 4, "M"),
    numericCodeField("usPortOfInBondArrival", 23, 4, "M"),
    dateFieldNumericMMDDYY("inBondCreateDate", 27, "M"),
    dateFieldNumericMMDDYY("inBondArrivalDate", 33, "C"),
    { key: "inBondQuantity", start: 39, length: 8, class: "N", designation: "C" },
    filler(47, 34),
  ],
};

// ── WO50-Record (Output): Bill Match Disposition ─────────────────────────────

export const BILL_MATCH_DISPOSITION_SPEC: RecordSpec<BillMatchDispositionOutput> = {
  recordType: "WO50-Record (Bill Match Disposition, Output)",
  length: 80,
  fields: [
    constantField(1, "WO50"),
    dateFieldNumericMMDDYY("dispositionDate", 5, "M"),
    numericCodeField("dispositionTime", 11, 4, "M"),
    { key: "dispositionCode", start: 15, length: 2, class: "AN", designation: "M" },
    { key: "narrativeMessage", start: 17, length: 40, class: "X", designation: "M" },
    { key: "splitIndicator", start: 57, length: 1, class: "A", designation: "M" },
    { key: "carrierCode", start: 58, length: 4, class: "AN", designation: "C" },
    { key: "voyageFlightTripNumber", start: 62, length: 5, class: "X", designation: "C" },
    dateFieldNumericMMDDYY("dateOfArrival", 67, "C"),
    numericCodeField("districtPortOfArrival", 73, 4, "C"),
    filler(77, 4),
  ],
};

// ── WO70-Record (Output): PGA Status Action Detail ───────────────────────────
// Field layout independently verified byte-for-byte against the source PDF
// (page 58) — see the module comment in types.ts.

export const PGA_STATUS_ACTION_DETAIL_SPEC: RecordSpec<PgaStatusActionDetailOutput> = {
  recordType: "WO70-Record (PGA Status Action Detail, Output)",
  length: 80,
  fields: [
    constantField(1, "WO70"),
    { key: "governmentAgencyCode", start: 5, length: 3, class: "AN", designation: "M" },
    { key: "governmentAgencyProgramCode", start: 8, length: 3, class: "AN", designation: "C" },
    dateFieldNumericMMDDYY("statusActionDate", 11, "C"),
    numericCodeField("statusActionTime", 17, 4, "C"),
    { key: "pgaEntryLevelStatusCode", start: 21, length: 2, class: "AN", designation: "C" },
    { key: "pgaEntryLevelStatusMessage", start: 23, length: 28, class: "X", designation: "C" },
    { key: "entryLineLevelStatusCode", start: 51, length: 2, class: "AN", designation: "C" },
    { key: "pgaLineLevelStatusCode", start: 53, length: 2, class: "AN", designation: "C" },
    { key: "statusReasonCode", start: 55, length: 2, class: "AN", designation: "C" },
    numericCodeField("beginningCbpLine", 57, 3, "C"),
    numericCodeField("beginningTariffPosition", 60, 2, "C"),
    numericCodeField("beginningPgaLine", 62, 3, "C"),
    numericCodeField("endingCbpLine", 65, 3, "C"),
    numericCodeField("endingTariffPosition", 68, 2, "C"),
    numericCodeField("endingPgaLine", 70, 3, "C"),
    { key: "documentTypeCode", start: 73, length: 5, class: "AN", designation: "C" },
    { key: "pgaEntryHold", start: 78, length: 1, class: "X", designation: "C" },
    filler(79, 2),
  ],
};

// ── WO71-Record (Output): PGA Reference Identification Detail ───────────────
// See the module comment in types.ts on the extended test fixture's own
// "Filler" mislabeling of the second PGA Reference Identification Number
// Qualifier/Number pair at positions 61-80.

export const PGA_REFERENCE_IDENTIFICATION_DETAIL_SPEC: RecordSpec<PgaReferenceIdentificationDetailOutput> = {
  recordType: "WO71-Record (PGA Reference Identification Detail, Output)",
  length: 80,
  fields: [
    constantField(1, "WO71"),
    { key: "pgaReferenceIdentificationNumberQualifier", start: 5, length: 2, class: "AN", designation: "C" },
    { key: "pgaReferenceIdentificationNumber", start: 7, length: 12, class: "X", designation: "C" },
    dateFieldNumericMMDDYY("pgaReferenceIdentificationNumberReceiptDate", 19, "C"),
    numericCodeField("pgaReferenceIdentificationNumberReceiptTime", 25, 6, "C"),
    { key: "pgaLineSubReasonCode1", start: 31, length: 3, class: "AN", designation: "C" },
    { key: "pgaLineSubReasonCode2", start: 34, length: 3, class: "AN", designation: "C" },
    { key: "pgaLineSubReasonCode3", start: 37, length: 3, class: "AN", designation: "C" },
    { key: "pgaLineSubReasonCode4", start: 40, length: 3, class: "AN", designation: "C" },
    { key: "pgaLineSubReasonCode5", start: 43, length: 3, class: "AN", designation: "C" },
    { key: "pgaLineSubReasonCode6", start: 46, length: 3, class: "AN", designation: "C" },
    { key: "pgaLineSubReasonCode7", start: 49, length: 3, class: "AN", designation: "C" },
    { key: "pgaLineSubReasonCode8", start: 52, length: 3, class: "AN", designation: "C" },
    { key: "pgaLineSubReasonCode9", start: 55, length: 3, class: "AN", designation: "C" },
    { key: "pgaLineSubReasonCode10", start: 58, length: 3, class: "AN", designation: "C" },
    { key: "pgaReferenceIdentificationNumberQualifier2", start: 61, length: 2, class: "AN", designation: "C" },
    { key: "pgaReferenceIdentificationNumber2", start: 63, length: 18, class: "X", designation: "C" },
  ],
};

// ── WO72-Record (Output): PGA Narrative Comments to Trade ───────────────────

export const PGA_NARRATIVE_COMMENTS_SPEC: RecordSpec<PgaNarrativeCommentsOutput> = {
  recordType: "WO72-Record (PGA Narrative Comments to Trade, Output)",
  length: 80,
  fields: [
    constantField(1, "WO72"),
    { key: "commentsToTradeFromPga", start: 5, length: 76, class: "X", designation: "M" },
  ],
};
