import {
  dateFieldNumericMMDDYY,
  dateFieldYYMMDD,
  filler,
  constantField,
  numericCodeField,
  type FieldSpec,
  type RecordSpec,
} from "@/lib/abi/fixedWidth";
import type {
  InBondHeaderInput,
  ConveyanceInfoInput,
  BillOfLadingHeaderInput,
  SecondaryNotifyPartiesInput,
  ReferenceIdentifierInput,
  InBondEventHeaderInput,
  InBondEventDetailInput,
  InBondResponseMessageOutput,
  StatusNotificationHeaderOutput,
  StatusNotificationDetailOutput,
  StatusNotificationContinuationOutput,
  StatusNotificationRemarksOutput,
} from "./types";

// RecordSpecs for the CATAIR In-Bond chapter (Chapter 9) — the 13 in-scope
// records. Position math cross-checked field-by-field against the extracted
// PDF spec tables (see tests/abi-in-bond-specs.test.ts's header scope note,
// which independently verified 6 of these 13 records byte-for-byte against
// the source PDF) to sum to exactly 80 per record before writing.
// Source: docs/plans/catair-source-docs/06b-in-bond-v51-2026-04.pdf
// (Amendment 51, April 2026)

// ── QP10-Record (Input): In-Bond Header ─────────────────────────────────────

export const IN_BOND_HEADER_SPEC: RecordSpec<InBondHeaderInput> = {
  recordType: "QP10-Record (In-Bond Header, Input)",
  length: 80,
  fields: [
    constantField(1, "10"),
    { key: "actionCode", start: 3, length: 1, class: "A", designation: "M" },
    numericCodeField("inBondEntryType", 4, 2, "C"),
    { key: "inBondNumber", start: 6, length: 12, class: "AN", designation: "M" },
    { key: "inBondCarrierCode", start: 18, length: 4, class: "AN", designation: "C" },
    numericCodeField("usPortOfDest", 22, 4, "C"),
    { key: "portOfForeignDest", start: 26, length: 5, class: "AN", designation: "C" },
    { key: "value", start: 31, length: 8, class: "N", designation: "M" },
    { key: "bondedCarrierID", start: 39, length: 12, class: "X", designation: "C" },
    { key: "ftzWarehouseInd", start: 51, length: 1, class: "A", designation: "C" },
    { key: "btaFdaIndicator", start: 52, length: 1, class: "A", designation: "C" },
    filler(53, 28),
  ],
};

// ── QP20-Record (Input): Conveyance Information ─────────────────────────────
// Estimated Date of Arrival is MMDDYY, class N (PDF p. INB-24 explicit) —
// use `dateFieldNumericMMDDYY`, NOT `dateFieldYYMMDD` (which WP20's `date`
// and NS30's `actionDate` use instead, same chapter, different fields).

export const CONVEYANCE_INFO_SPEC: RecordSpec<ConveyanceInfoInput> = {
  recordType: "QP20-Record (Conveyance Information, Input)",
  length: 80,
  fields: [
    constantField(1, "20"),
    { key: "importingCarrierCode", start: 3, length: 4, class: "AN", designation: "M" },
    numericCodeField("importMOT", 7, 2, "M"),
    { key: "countryCode", start: 9, length: 2, class: "A", designation: "C" },
    { key: "importingConveyance", start: 11, length: 23, class: "X", designation: "C" },
    { key: "voyageFlightTripNum", start: 34, length: 5, class: "X", designation: "C" },
    filler(39, 7),
    numericCodeField("portOfImportArrival", 46, 4, "M"),
    dateFieldNumericMMDDYY("estDateOfArrival", 50, "C"),
    { key: "ftzFirmsCode", start: 56, length: 4, class: "AN", designation: "C" },
    filler(60, 21),
  ],
};

// ── QP30-Record (Input): Bill of Lading Header ──────────────────────────────
// Issuer Code of House Bill/House Bill Number/Issuer Code of Sub-house
// Bill/Sub-house Bill Number (pos 25-56) are real, named "reserved for
// future use" fields per the PDF — modeled as typed fields, not filler.

export const BOL_HEADER_SPEC: RecordSpec<BillOfLadingHeaderInput> = {
  recordType: "QP30-Record (Bill of Lading Header, Input)",
  length: 80,
  fields: [
    constantField(1, "30"),
    { key: "actionCode", start: 3, length: 1, class: "A", designation: "M" },
    filler(4, 1),
    { key: "sequenceNumber", start: 5, length: 4, class: "AN", designation: "O" },
    { key: "issuerCodeMasterBOL", start: 9, length: 4, class: "AN", designation: "M" },
    { key: "masterBOLNumber", start: 13, length: 12, class: "AN", designation: "M" },
    { key: "issuerCodeHouseBill", start: 25, length: 4, class: "AN", designation: "C" },
    { key: "houseBillNumber", start: 29, length: 12, class: "AN", designation: "C" },
    { key: "issuerCodeSubHouse", start: 41, length: 4, class: "AN", designation: "C" },
    { key: "subHouseBillNumber", start: 45, length: 12, class: "AN", designation: "C" },
    { key: "prevInBondNumber", start: 57, length: 12, class: "AN", designation: "C" },
    // No stated decimal convention (Amendment 51 removed prior wording) —
    // plain N field, default encode/decode (whole-number, zero-padded).
    { key: "inBondQuantity", start: 69, length: 10, class: "N", designation: "C" },
    filler(79, 2),
  ],
};

// ── QP32-Record (Input): Secondary Notify Parties ───────────────────────────

export const SECONDARY_NOTIFY_PARTIES_SPEC: RecordSpec<SecondaryNotifyPartiesInput> = {
  recordType: "QP32-Record (Secondary Notify Parties, Input)",
  length: 80,
  fields: [
    constantField(1, "32"),
    { key: "snpCode1", start: 3, length: 9, class: "AN", designation: "M" },
    { key: "snpCode2", start: 12, length: 9, class: "AN", designation: "O" },
    { key: "snpCode3", start: 21, length: 9, class: "AN", designation: "O" },
    { key: "snpCode4", start: 30, length: 9, class: "AN", designation: "O" },
    filler(39, 42),
  ],
};

// ── QP33-Record (Input): Reference Identifier ───────────────────────────────

export const REFERENCE_IDENTIFIER_SPEC: RecordSpec<ReferenceIdentifierInput> = {
  recordType: "QP33-Record (Reference Identifier, Input)",
  length: 80,
  fields: [
    constantField(1, "33"),
    { key: "qualifier", start: 3, length: 3, class: "AN", designation: "M" },
    { key: "referenceIdentifier", start: 6, length: 30, class: "AN", designation: "M" },
    filler(36, 45),
  ],
};

// ── WP10-Record (Input): In-Bond Event Header ───────────────────────────────

export const IN_BOND_EVENT_HEADER_SPEC: RecordSpec<InBondEventHeaderInput> = {
  recordType: "WP10-Record (In-Bond Event Header, Input)",
  length: 80,
  fields: [
    constantField(1, "10"),
    { key: "actionCode", start: 3, length: 1, class: "AN", designation: "M" },
    { key: "inBondNumber", start: 4, length: 12, class: "AN", designation: "C" },
    { key: "issuerCodeMasterBOL", start: 16, length: 4, class: "AN", designation: "C" },
    { key: "masterBOLNumber", start: 20, length: 12, class: "AN", designation: "C" },
    { key: "issuerCodeHouseBOL", start: 32, length: 4, class: "AN", designation: "C" },
    { key: "houseBOLNumber", start: 36, length: 12, class: "AN", designation: "C" },
    { key: "firmsLocation", start: 48, length: 4, class: "AN", designation: "C" },
    filler(52, 12),
    { key: "containerNumber", start: 64, length: 14, class: "AN", designation: "C" },
    filler(78, 3),
  ],
};

// ── WP20-Record (Input): In-Bond Event Detail ───────────────────────────────
// Date is YYMMDD, class N (PDF p. INB-57 explicit) — use `dateFieldYYMMDD`,
// NOT `dateFieldNumericMMDDYY` (which QP20's `estDateOfArrival` uses
// instead, same chapter, different field/format). Time (HHMMSS) has no
// dedicated date/time primitive in fixedWidth.ts — modeled via
// `numericCodeField` to preserve leading zeros (e.g. midnight "000000"),
// same rationale as NS30's 4-char `actionTime` below.

export const IN_BOND_EVENT_DETAIL_SPEC: RecordSpec<InBondEventDetailInput> = {
  recordType: "WP20-Record (In-Bond Event Detail, Input)",
  length: 80,
  fields: [
    constantField(1, "20"),
    dateFieldYYMMDD("date", 3, "M"),
    numericCodeField("time", 9, 6, "M"),
    numericCodeField("portOfArrival", 15, 4, "C"),
    { key: "inBondCarrierCode", start: 19, length: 4, class: "X", designation: "C" },
    { key: "bondedCarrierID", start: 23, length: 12, class: "X", designation: "C" },
    { key: "cityName", start: 35, length: 19, class: "AN", designation: "C" },
    { key: "stateCode", start: 54, length: 2, class: "A", designation: "C" },
    numericCodeField("exportMOT", 56, 2, "O"),
    { key: "exportConveyance", start: 58, length: 23, class: "AN", designation: "O" },
  ],
};

// ── QT95-Record / WT95-Record (Output): Transaction Response Message ───────
// Identical 80-column layout for both (PDF pp. INB-53, INB-59) — only the
// transaction context differs (QT for a QP transaction, WT for a WP
// transaction), so both RecordSpecs are built from one shared field array
// rather than duplicating the field list. See types.ts's
// `InBondResponseMessageOutput` and parse.ts's separately-named decode
// functions for the two distinctly-named exports the codec still keeps
// (one per record identity, matching the pattern of every other chapter's
// per-record parse/build functions).

function responseMessageFields(): ReadonlyArray<FieldSpec<Extract<keyof InBondResponseMessageOutput, string>>> {
  return [
    constantField(1, "95"),
    numericCodeField("narrativeMsgType", 3, 2, "M"),
    { key: "narrativeMsgId", start: 5, length: 3, class: "AN", designation: "M" },
    filler(8, 1),
    { key: "narrativeMessage", start: 9, length: 39, class: "X", designation: "M" },
    filler(48, 33),
  ];
}

export const QT95_RESPONSE_SPEC: RecordSpec<InBondResponseMessageOutput> = {
  recordType: "QT95-Record (In-Bond Transaction Response Message, Output)",
  length: 80,
  fields: responseMessageFields(),
};

export const WT95_RESPONSE_SPEC: RecordSpec<InBondResponseMessageOutput> = {
  recordType: "WT95-Record (Arrival/Export/Transfer Response Message, Output)",
  length: 80,
  fields: responseMessageFields(),
};

// ── NS10-Record (Output): Status Notification Header In-Bond Information ───

export const STATUS_NOTIFICATION_HEADER_SPEC: RecordSpec<StatusNotificationHeaderOutput> = {
  recordType: "NS10-Record (Status Notification Header In-Bond Information, Output)",
  length: 80,
  fields: [
    constantField(1, "10"),
    numericCodeField("inBondEntryType", 3, 2, "M"),
    { key: "inBondNumber", start: 5, length: 12, class: "AN", designation: "M" },
    numericCodeField("usPortOfDest", 17, 4, "M"),
    // Class N (all-numeric) — contrast with QP10's `portOfForeignDest`
    // equivalent, which is Class AN. Position math consistent (5 chars);
    // the type difference is real, not a transcription error.
    numericCodeField("foreignDestination", 21, 5, "C"),
    filler(26, 55),
  ],
};

// ── NS30-Record (Output): Status Notification Detail ────────────────────────
// Action Date is YYMMDD, class N (PDF pp. INB-64/65 explicit) — same digit
// order as WP20's `date`. Action Time is 4-char HHMM (NOT 6-char HHMMSS like
// WP20's `time`) — modeled via `numericCodeField` for the same
// leading-zero-preservation reason as WP20's `time` above. Positions 21-52
// (Issuer Code of House Bill Number, House Bill Number, Issuer Code of
// Sub-house Bill Number, Sub-house Bill Number) are real, named "reserved
// for future use" fields per the PDF — modeled as typed fields, not filler.

export const STATUS_NOTIFICATION_DETAIL_SPEC: RecordSpec<StatusNotificationDetailOutput> = {
  recordType: "NS30-Record (Status Notification Detail, Output)",
  length: 80,
  fields: [
    constantField(1, "30"),
    { key: "dispositionCode", start: 3, length: 2, class: "AN", designation: "M" },
    { key: "issuerMasterBill", start: 5, length: 4, class: "AN", designation: "M" },
    { key: "masterBillNumber", start: 9, length: 12, class: "AN", designation: "M" },
    { key: "issuerHouseBill", start: 21, length: 4, class: "AN", designation: "C" },
    { key: "houseBillNumber", start: 25, length: 12, class: "AN", designation: "C" },
    { key: "issuerSubHouse", start: 37, length: 4, class: "AN", designation: "C" },
    { key: "subHouseBillNumber", start: 41, length: 12, class: "AN", designation: "C" },
    { key: "quantity", start: 53, length: 10, class: "N", designation: "M" },
    { key: "negativeIndicator", start: 63, length: 1, class: "A", designation: "C" },
    dateFieldYYMMDD("actionDate", 64, "M"),
    numericCodeField("actionTime", 70, 4, "M"),
    { key: "inBondCarrierCode", start: 74, length: 4, class: "X", designation: "M" },
    filler(78, 3),
  ],
};

// ── NS40-Record (Output): Status Notification Detail Continuation ──────────

export const STATUS_NOTIFICATION_CONTINUATION_SPEC: RecordSpec<StatusNotificationContinuationOutput> = {
  recordType: "NS40-Record (Status Notification Detail Continuation, Output)",
  length: 80,
  fields: [
    constantField(1, "40"),
    numericCodeField("entryType", 3, 2, "C"),
    { key: "entryNumber", start: 5, length: 15, class: "AN", designation: "C" },
    numericCodeField("distPortTxn", 20, 4, "M"),
    { key: "firmsCode", start: 24, length: 4, class: "AN", designation: "C" },
    { key: "containerNum", start: 28, length: 14, class: "AN", designation: "C" },
    filler(42, 39),
  ],
};

// ── NS50-Record (Output): Status Notification Remarks ───────────────────────

export const STATUS_NOTIFICATION_REMARKS_SPEC: RecordSpec<StatusNotificationRemarksOutput> = {
  recordType: "NS50-Record (Status Notification Remarks, Output)",
  length: 80,
  fields: [
    constantField(1, "50"),
    { key: "remarks", start: 3, length: 45, class: "X", designation: "M" },
    filler(48, 33),
  ],
};
