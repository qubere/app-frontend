import { decodeRecord } from "@/lib/abi/fixedWidth";
import {
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

export type CargoManifestQueryLineType =
  | "WR0"
  | "WO10"
  | "WO20"
  | "WO30"
  | "WO40"
  | "WO42"
  | "WO50"
  | "WO60"
  | "WO70"
  | "WO71"
  | "WO72"
  | "WR1"
  | "WR2"
  | "WR3"
  | "WR4"
  | "WR5"
  | "WS4"
  | "WS5"
  | "WSA"
  | "WSB"
  | "WSC"
  | "WSD"
  | "WN0"
  | "WN1"
  | "UNKNOWN";

const KNOWN_WO_CODES: ReadonlySet<string> = new Set([
  "WO10",
  "WO20",
  "WO30",
  "WO40",
  "WO42",
  "WO50",
  "WO60",
  "WO70",
  "WO71",
  "WO72",
]);
const KNOWN_WR_CODES: ReadonlySet<string> = new Set(["WR0", "WR1", "WR2", "WR3", "WR4", "WR5"]);
const KNOWN_WS_CODES: ReadonlySet<string> = new Set(["WSA", "WSB", "WSC", "WSD", "WS4", "WS5"]);
const KNOWN_WN_CODES: ReadonlySet<string> = new Set(["WN0", "WN1"]);

/**
 * Classifies a line from a C1 (query response) stream by its control
 * identifier. Only meaningful for the response side: the WR1-Record
 * (Output, Manifest Processing Results/Conveyance) and the WR1-Record
 * (Input, Cargo Manifest Query Request) share the identical "WR1" control
 * identifier + Record Type on the wire (see the module comment in
 * types.ts), so nothing in the line's own bytes can tell them apart — this
 * classifier resolves the ambiguity contextually instead, by only ever being
 * used to walk a *response* stream, where "WR1" can only mean the Output
 * variant (a WR1-Input line never appears in a C1 response; it's built via
 * `buildCargoManifestQueryRequest`, not parsed by this module).
 *
 * "UNKNOWN" now only covers batch/block envelope lines (Record B, Y, etc.) —
 * every CQ/C1 record documented in the source PDF is modeled.
 */
export function classifyCargoManifestQueryLine(line: string): CargoManifestQueryLineType {
  const four = line.slice(0, 4);
  if (KNOWN_WO_CODES.has(four)) return four as CargoManifestQueryLineType;
  const three = line.slice(0, 3);
  if (
    KNOWN_WR_CODES.has(three) ||
    KNOWN_WS_CODES.has(three) ||
    KNOWN_WN_CODES.has(three)
  ) {
    return three as CargoManifestQueryLineType;
  }
  return "UNKNOWN";
}

export function parseCargoManifestQueryError(line: string): CargoManifestQueryErrorOutput {
  return decodeRecord(CARGO_MANIFEST_QUERY_ERROR_SPEC, line);
}

export function parseEntryStatusHeader(line: string): EntryStatusHeaderOutput {
  return decodeRecord(ENTRY_STATUS_HEADER_SPEC, line);
}

export function parseEntryDispositionResult(line: string): EntryDispositionResultOutput {
  return decodeRecord(ENTRY_DISPOSITION_RESULT_SPEC, line);
}

export function parseManifestConveyanceResult(line: string): ManifestConveyanceResultOutput {
  return decodeRecord(MANIFEST_CONVEYANCE_RESULT_SPEC, line);
}

export function parseTripFirmsLocation(line: string): TripFirmsLocationOutput {
  return decodeRecord(TRIP_FIRMS_LOCATION_SPEC, line);
}

export function parseInBondBillQueryError(line: string): InBondBillQueryErrorOutput {
  return decodeRecord(IN_BOND_BILL_QUERY_ERROR_SPEC, line);
}

export function parseAirWaybillQueryError(line: string): AirWaybillQueryErrorOutput {
  return decodeRecord(AIR_WAYBILL_QUERY_ERROR_SPEC, line);
}

export function parseCountryOriginTariffResult(line: string): CountryOriginTariffResultOutput {
  return decodeRecord(COUNTRY_ORIGIN_TARIFF_RESULT_SPEC, line);
}

export function parseInBondStatusUpdate(line: string): InBondStatusUpdateOutput {
  return decodeRecord(IN_BOND_STATUS_UPDATE_SPEC, line);
}

export function parseInBondBillDetail(line: string): InBondBillDetailOutput {
  return decodeRecord(IN_BOND_BILL_DETAIL_SPEC, line);
}

export function parseInBondStatusDetail(line: string): InBondStatusDetailOutput {
  return decodeRecord(IN_BOND_STATUS_DETAIL_SPEC, line);
}

export function parseAirInBondManifestStatus(line: string): AirInBondManifestStatusOutput {
  return decodeRecord(AIR_IN_BOND_MANIFEST_STATUS_SPEC, line);
}

export function parseAirWaybillDispositionResult(line: string): AirWaybillDispositionResultOutput {
  return decodeRecord(AIR_WAYBILL_DISPOSITION_RESULT_SPEC, line);
}

export function parseInBondBillDispositionResult(line: string): InBondBillDispositionResultOutput {
  return decodeRecord(IN_BOND_BILL_DISPOSITION_RESULT_SPEC, line);
}

export function parseAmendedBillQuantities(line: string): AmendedBillQuantitiesOutput {
  return decodeRecord(AMENDED_BILL_QUANTITIES_SPEC, line);
}

export function parsePortDateDetail(line: string): PortDateDetailOutput {
  return decodeRecord(PORT_DATE_DETAIL_SPEC, line);
}

export function parseReferenceData(line: string): ReferenceDataOutput {
  return decodeRecord(REFERENCE_DATA_SPEC, line);
}

export function parseCountryOriginTariffLine(line: string): CountryOriginTariffLineOutput {
  return decodeRecord(COUNTRY_ORIGIN_TARIFF_LINE_SPEC, line);
}

export function parseBillDetail(line: string): BillDetailOutput {
  return decodeRecord(BILL_DETAIL_SPEC, line);
}

export function parseInBondDetail(line: string): InBondDetailOutput {
  return decodeRecord(IN_BOND_DETAIL_SPEC, line);
}

export function parseBillMatchDisposition(line: string): BillMatchDispositionOutput {
  return decodeRecord(BILL_MATCH_DISPOSITION_SPEC, line);
}

export function parsePgaStatusActionDetail(line: string): PgaStatusActionDetailOutput {
  return decodeRecord(PGA_STATUS_ACTION_DETAIL_SPEC, line);
}

export function parsePgaReferenceIdentificationDetail(line: string): PgaReferenceIdentificationDetailOutput {
  return decodeRecord(PGA_REFERENCE_IDENTIFICATION_DETAIL_SPEC, line);
}

export function parsePgaNarrativeComments(line: string): PgaNarrativeCommentsOutput {
  return decodeRecord(PGA_NARRATIVE_COMMENTS_SPEC, line);
}

/**
 * One entry's full query response: the mandatory WO10 header, 0+ WO60
 * disposition events, and the conditional WR1/WR2 conveyance and
 * trip/FIRMS-location records — or, on failure, one of the WR0/WSA/WSB
 * error records instead (WR0 for entry queries, WSA for in-bond/bill
 * queries, WSB for air waybill queries — see each record's own module
 * comment in types.ts). Per the source PDF, WR1-Output/WR2/WS4 are each
 * returned at most once per successful query; every other extended record
 * below repeats as documented on its own type in types.ts.
 */
export interface CargoManifestQueryResult {
  error?: CargoManifestQueryErrorOutput;
  inBondBillError?: InBondBillQueryErrorOutput;
  airWaybillError?: AirWaybillQueryErrorOutput;
  header?: EntryStatusHeaderOutput;
  dispositions: EntryDispositionResultOutput[];
  conveyance?: ManifestConveyanceResultOutput;
  tripFirmsLocation?: TripFirmsLocationOutput;
  countryOriginTariffResults: CountryOriginTariffResultOutput[];
  inBondStatusUpdate?: InBondStatusUpdateOutput;
  inBondBillDetails: InBondBillDetailOutput[];
  inBondStatusDetails: InBondStatusDetailOutput[];
  airInBondManifestStatuses: AirInBondManifestStatusOutput[];
  airWaybillDispositionResults: AirWaybillDispositionResultOutput[];
  inBondBillDispositionResults: InBondBillDispositionResultOutput[];
  amendedBillQuantities: AmendedBillQuantitiesOutput[];
  portDateDetails: PortDateDetailOutput[];
  referenceData: ReferenceDataOutput[];
  countryOriginTariffLines: CountryOriginTariffLineOutput[];
  billDetails: BillDetailOutput[];
  inBondDetails: InBondDetailOutput[];
  billMatchDispositions: BillMatchDispositionOutput[];
  pgaStatusActionDetails: PgaStatusActionDetailOutput[];
  pgaReferenceIdentificationDetails: PgaReferenceIdentificationDetailOutput[];
  pgaNarrativeComments: PgaNarrativeCommentsOutput[];
  /** Lines that don't classify as a known CQ/C1 record — a batch/block
   * envelope line (Record B, Y, etc.). Preserved in original order rather
   * than silently dropped. */
  unrecognizedLines: string[];
}

/** Walks a raw C1 (query response) stream, decoding each recognized record
 * type and grouping every repeatable record into its own array. */
export function parseCargoManifestQueryResponse(lines: string[]): CargoManifestQueryResult {
  const result: CargoManifestQueryResult = {
    dispositions: [],
    countryOriginTariffResults: [],
    inBondBillDetails: [],
    inBondStatusDetails: [],
    airInBondManifestStatuses: [],
    airWaybillDispositionResults: [],
    inBondBillDispositionResults: [],
    amendedBillQuantities: [],
    portDateDetails: [],
    referenceData: [],
    countryOriginTariffLines: [],
    billDetails: [],
    inBondDetails: [],
    billMatchDispositions: [],
    pgaStatusActionDetails: [],
    pgaReferenceIdentificationDetails: [],
    pgaNarrativeComments: [],
    unrecognizedLines: [],
  };

  for (const line of lines) {
    const type = classifyCargoManifestQueryLine(line);
    switch (type) {
      case "WR0":
        result.error = parseCargoManifestQueryError(line);
        break;
      case "WSA":
        result.inBondBillError = parseInBondBillQueryError(line);
        break;
      case "WSB":
        result.airWaybillError = parseAirWaybillQueryError(line);
        break;
      case "WO10":
        result.header = parseEntryStatusHeader(line);
        break;
      case "WO60":
        result.dispositions.push(parseEntryDispositionResult(line));
        break;
      case "WR1":
        result.conveyance = parseManifestConveyanceResult(line);
        break;
      case "WR2":
        result.tripFirmsLocation = parseTripFirmsLocation(line);
        break;
      case "WR3":
        result.countryOriginTariffResults.push(parseCountryOriginTariffResult(line));
        break;
      case "WS4":
        result.inBondStatusUpdate = parseInBondStatusUpdate(line);
        break;
      case "WR4":
        result.inBondBillDetails.push(parseInBondBillDetail(line));
        break;
      case "WS5":
        result.inBondStatusDetails.push(parseInBondStatusDetail(line));
        break;
      case "WSC":
        result.airInBondManifestStatuses.push(parseAirInBondManifestStatus(line));
        break;
      case "WSD":
        result.airWaybillDispositionResults.push(parseAirWaybillDispositionResult(line));
        break;
      case "WR5":
        result.inBondBillDispositionResults.push(parseInBondBillDispositionResult(line));
        break;
      case "WN0":
        result.amendedBillQuantities.push(parseAmendedBillQuantities(line));
        break;
      case "WN1":
        result.portDateDetails.push(parsePortDateDetail(line));
        break;
      case "WO20":
        result.referenceData.push(parseReferenceData(line));
        break;
      case "WO30":
        result.countryOriginTariffLines.push(parseCountryOriginTariffLine(line));
        break;
      case "WO40":
        result.billDetails.push(parseBillDetail(line));
        break;
      case "WO42":
        result.inBondDetails.push(parseInBondDetail(line));
        break;
      case "WO50":
        result.billMatchDispositions.push(parseBillMatchDisposition(line));
        break;
      case "WO70":
        result.pgaStatusActionDetails.push(parsePgaStatusActionDetail(line));
        break;
      case "WO71":
        result.pgaReferenceIdentificationDetails.push(parsePgaReferenceIdentificationDetail(line));
        break;
      case "WO72":
        result.pgaNarrativeComments.push(parsePgaNarrativeComments(line));
        break;
      default:
        result.unrecognizedLines.push(line);
    }
  }

  return result;
}
