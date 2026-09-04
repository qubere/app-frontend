import { encodeRecord, AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import { isValidEntryNumberCheckDigit } from "@/lib/abi/entryNumber";
import {
  CARGO_MANIFEST_QUERY_REQUEST_SPEC,
  CARGO_MANIFEST_QUERY_ERROR_SPEC,
  ENTRY_STATUS_HEADER_SPEC,
  ENTRY_DISPOSITION_RESULT_SPEC,
  MANIFEST_CONVEYANCE_RESULT_SPEC,
  TRIP_FIRMS_LOCATION_SPEC,
  IN_BOND_BILL_QUERY_ERROR_SPEC,
  AIR_WAYBILL_QUERY_ERROR_SPEC,
  COUNTRY_ORIGIN_TARIFF_RESULT_SPEC,
  IN_BOND_STATUS_UPDATE_SPEC,
  IN_BOND_BILL_DETAIL_SPEC,
  IN_BOND_STATUS_DETAIL_SPEC,
  AIR_IN_BOND_MANIFEST_STATUS_SPEC,
  AIR_WAYBILL_DISPOSITION_RESULT_SPEC,
  IN_BOND_BILL_DISPOSITION_RESULT_SPEC,
  AMENDED_BILL_QUANTITIES_SPEC,
  PORT_DATE_DETAIL_SPEC,
  REFERENCE_DATA_SPEC,
  COUNTRY_ORIGIN_TARIFF_LINE_SPEC,
  BILL_DETAIL_SPEC,
  IN_BOND_DETAIL_SPEC,
  BILL_MATCH_DISPOSITION_SPEC,
  PGA_STATUS_ACTION_DETAIL_SPEC,
  PGA_REFERENCE_IDENTIFICATION_DETAIL_SPEC,
  PGA_NARRATIVE_COMMENTS_SPEC,
} from "./recordSpecs";
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

/**
 * Per the WR1-Record (Input)'s own Note 1, only one type of query may be
 * initiated per WR1 record: entry (filer code + entry number, both
 * required together), in-bond (in-bond number alone, no associated bill
 * numbers), an ocean/rail/truck bill (Issuer Code/SCAC + Bill Number,
 * required together), or an air waybill (optionally + house air waybill).
 */
function assertSingleQueryType(input: CargoManifestQueryRequestInput): void {
  const hasEntry = Boolean(input.entryFilerCode || input.entryNumber);
  const hasInBond = Boolean(input.inBondNumber);
  const hasBill = Boolean(input.issuerCode || input.billNumber);
  const hasAirWaybill = Boolean(input.airWaybillNumber || input.houseAirWaybillNumber);

  if (hasEntry && (!input.entryFilerCode || !input.entryNumber)) {
    throw new AbiFixedWidthError(
      "WR1-Record (Input): querying by entry requires both Entry Filer Code and Entry Number."
    );
  }
  if (hasBill && (!input.issuerCode || !input.billNumber)) {
    throw new AbiFixedWidthError(
      "WR1-Record (Input): querying an ocean/rail/truck bill requires both the Issuer Code (SCAC) and Bill of Lading Number."
    );
  }
  if (input.houseAirWaybillNumber && !input.airWaybillNumber) {
    throw new AbiFixedWidthError(
      "WR1-Record (Input): House Air Waybill Number may only be sent with an Air Waybill Number."
    );
  }

  const queryTypeCount = [hasEntry, hasInBond, hasBill, hasAirWaybill].filter(Boolean).length;
  if (queryTypeCount === 0) {
    throw new AbiFixedWidthError(
      "WR1-Record (Input): must specify exactly one query type — entry, in-bond, bill of lading, or air waybill."
    );
  }
  if (queryTypeCount > 1) {
    throw new AbiFixedWidthError(
      "WR1-Record (Input): only one type of query may be initiated per WR1 record (entry, in-bond, bill of lading, or air waybill)."
    );
  }
  if (hasEntry && !isValidEntryNumberCheckDigit(input.entryFilerCode as string, input.entryNumber as string)) {
    throw new AbiFixedWidthError(
      `WR1-Record (Input): Entry Number "${input.entryNumber}" has an invalid check digit for Entry Filer Code "${input.entryFilerCode}" (Appendix E).`
    );
  }
}

export function buildCargoManifestQueryRequest(input: CargoManifestQueryRequestInput): string {
  assertSingleQueryType(input);
  return encodeRecord(CARGO_MANIFEST_QUERY_REQUEST_SPEC, input);
}

export function buildCargoManifestQueryError(input: CargoManifestQueryErrorOutput): string {
  return encodeRecord(CARGO_MANIFEST_QUERY_ERROR_SPEC, input);
}

export function buildEntryStatusHeader(input: EntryStatusHeaderOutput): string {
  return encodeRecord(ENTRY_STATUS_HEADER_SPEC, input);
}

export function buildEntryDispositionResult(input: EntryDispositionResultOutput): string {
  return encodeRecord(ENTRY_DISPOSITION_RESULT_SPEC, input);
}

export function buildManifestConveyanceResult(input: ManifestConveyanceResultOutput): string {
  return encodeRecord(MANIFEST_CONVEYANCE_RESULT_SPEC, input);
}

export function buildTripFirmsLocation(input: TripFirmsLocationOutput): string {
  return encodeRecord(TRIP_FIRMS_LOCATION_SPEC, input);
}

export function buildInBondBillQueryError(input: InBondBillQueryErrorOutput): string {
  return encodeRecord(IN_BOND_BILL_QUERY_ERROR_SPEC, input);
}

export function buildAirWaybillQueryError(input: AirWaybillQueryErrorOutput): string {
  return encodeRecord(AIR_WAYBILL_QUERY_ERROR_SPEC, input);
}

export function buildCountryOriginTariffResult(input: CountryOriginTariffResultOutput): string {
  return encodeRecord(COUNTRY_ORIGIN_TARIFF_RESULT_SPEC, input);
}

export function buildInBondStatusUpdate(input: InBondStatusUpdateOutput): string {
  return encodeRecord(IN_BOND_STATUS_UPDATE_SPEC, input);
}

export function buildInBondBillDetail(input: InBondBillDetailOutput): string {
  return encodeRecord(IN_BOND_BILL_DETAIL_SPEC, input);
}

export function buildInBondStatusDetail(input: InBondStatusDetailOutput): string {
  return encodeRecord(IN_BOND_STATUS_DETAIL_SPEC, input);
}

export function buildAirInBondManifestStatus(input: AirInBondManifestStatusOutput): string {
  return encodeRecord(AIR_IN_BOND_MANIFEST_STATUS_SPEC, input);
}

export function buildAirWaybillDispositionResult(input: AirWaybillDispositionResultOutput): string {
  return encodeRecord(AIR_WAYBILL_DISPOSITION_RESULT_SPEC, input);
}

export function buildInBondBillDispositionResult(input: InBondBillDispositionResultOutput): string {
  return encodeRecord(IN_BOND_BILL_DISPOSITION_RESULT_SPEC, input);
}

export function buildAmendedBillQuantities(input: AmendedBillQuantitiesOutput): string {
  return encodeRecord(AMENDED_BILL_QUANTITIES_SPEC, input);
}

export function buildPortDateDetail(input: PortDateDetailOutput): string {
  return encodeRecord(PORT_DATE_DETAIL_SPEC, input);
}

export function buildReferenceData(input: ReferenceDataOutput): string {
  return encodeRecord(REFERENCE_DATA_SPEC, input);
}

export function buildCountryOriginTariffLine(input: CountryOriginTariffLineOutput): string {
  return encodeRecord(COUNTRY_ORIGIN_TARIFF_LINE_SPEC, input);
}

export function buildBillDetail(input: BillDetailOutput): string {
  return encodeRecord(BILL_DETAIL_SPEC, input);
}

export function buildInBondDetail(input: InBondDetailOutput): string {
  return encodeRecord(IN_BOND_DETAIL_SPEC, input);
}

export function buildBillMatchDisposition(input: BillMatchDispositionOutput): string {
  return encodeRecord(BILL_MATCH_DISPOSITION_SPEC, input);
}

export function buildPgaStatusActionDetail(input: PgaStatusActionDetailOutput): string {
  return encodeRecord(PGA_STATUS_ACTION_DETAIL_SPEC, input);
}

export function buildPgaReferenceIdentificationDetail(input: PgaReferenceIdentificationDetailOutput): string {
  return encodeRecord(PGA_REFERENCE_IDENTIFICATION_DETAIL_SPEC, input);
}

export function buildPgaNarrativeComments(input: PgaNarrativeCommentsOutput): string {
  return encodeRecord(PGA_NARRATIVE_COMMENTS_SPEC, input);
}
