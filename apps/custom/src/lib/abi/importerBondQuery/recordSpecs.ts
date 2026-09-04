import {
  dateField,
  dateFieldAlphanumericMMDDYY,
  filler,
  constantField,
  type FieldSpec,
  type RecordSpec,
} from "@/lib/abi/fixedWidth";
import { Decimal, roundToCents } from "@/lib/tariff/decimal";
import type {
  ImporterBondQueryInput,
  K1Output,
  K2Output,
  K3Output,
  K4Output,
  K5Output,
  K6Output,
  K7Output,
  K8Output,
} from "./types";

// RecordSpecs for the CATAIR Importer/Bond Query chapter.
// Source: docs/plans/catair-source-docs/importer-bond-query-v7.pdf
// (July 15, 2025, Draft Version 7 — Pages QIB-8 through QIB-20)
//
// K1's "Bond Number" field is printed in the PDF's own position column as
// "71-89" but its class is "9AN or 9S" (9-char width) — internally
// contradictory, since 71-89 would be 19 chars and would overlap the next
// field ("Bond Amount Record Location Indicator" at 80-80). Trusting the
// class width over the printed label (the only reading under which the
// record sums to exactly 80 with no overlap), Bond Number is 71-79.

/** A whole-dollar (no implied decimals) numeric amount field, bound to
 * `Decimal` — this chapter's Bond Amount fields (K1 pos 52-60, K2 pos 58-67)
 * are explicitly whole US dollars, matching eBond's established precedent
 * for this exact kind of field. */
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

/** Record K's repeating "Importer Number + Address Request Code" pairs — up
 * to 6 slots in ONE record (not a repeated record), same one-record-many-
 * slots shape as Drawback's Records 52/72 tracking-ID links
 * (`trackingIdLinkFields` in drawback/recordSpecs.ts), just 2 fields per slot
 * instead of 1. Slot n occupies columns [3+(n-1)*13, 3+(n-1)*13+12] — 12
 * chars of Importer Number followed by 1 char of Address Request Code. */
function importerNumberPairFields(): FieldSpec<Extract<keyof ImporterBondQueryInput, string>>[] {
  const fields: FieldSpec<Extract<keyof ImporterBondQueryInput, string>>[] = [
    constantField(1, "K"),
    filler(2, 1),
  ];
  for (let n = 1; n <= 6; n++) {
    const start = 3 + (n - 1) * 13;
    fields.push({
      key: `importerNumber${n}` as keyof ImporterBondQueryInput & string,
      start,
      length: 12,
      class: "X",
      designation: n === 1 ? "M" : "C",
    });
    fields.push({
      key: `addressRequestCode${n}` as keyof ImporterBondQueryInput & string,
      start: start + 12,
      length: 1,
      class: "AN",
      designation: n === 1 ? "M" : "C",
    });
  }
  return fields;
}

// ── Record K: Importer/Bond Query Input ──────────────────────────────────────

export const RECORD_K_SPEC: RecordSpec<ImporterBondQueryInput> = {
  recordType: "Record K (Importer/Bond Query Input)",
  length: 80,
  fields: importerNumberPairFields(),
};

// ── Record K1: Bond Type/Activity/Amount/Effective-Date (Output, Mandatory) ─

export const RECORD_K1_SPEC: RecordSpec<K1Output> = {
  recordType: "Record K1 (Importer/Bond Query Output — Bond Type/Activity)",
  length: 80,
  fields: [
    constantField(1, "K"),
    constantField(2, "1"),
    { key: "importerNumber", start: 3, length: 12, class: "X", designation: "M" },
    { key: "queryResultsCode", start: 15, length: 1, class: "N", designation: "M" },
    { key: "importerName", start: 16, length: 32, class: "AN", designation: "C" },
    { key: "suretyCode", start: 48, length: 3, class: "AN", designation: "C" },
    { key: "bondTypeActivityCode", start: 51, length: 1, class: "AN", designation: "C" },
    wholeDollarField("bondAmount", 52, 9, "C"),
    { key: "districtPortWhereBondFiled", start: 61, length: 4, class: "AN", designation: "C" },
    dateFieldAlphanumericMMDDYY("bondEffectiveDate", 65, "C"),
    { key: "bondNumber", start: 71, length: 9, class: "AN", designation: "C" },
    { key: "bondAmountRecordLocationIndicator", start: 80, length: 1, class: "AN", designation: "C" },
  ],
};

// ── Record K2: Name Qualifier/Termination Date/Bond Amount (Output, Conditional) ─

export const RECORD_K2_SPEC: RecordSpec<K2Output> = {
  recordType: "Record K2 (Importer/Bond Query Output — Name/Date/Status)",
  length: 80,
  fields: [
    constantField(1, "K"),
    constantField(2, "2"),
    { key: "nameQualifier", start: 3, length: 3, class: "A", designation: "C" },
    { key: "importerNameLine2", start: 6, length: 32, class: "X", designation: "C" },
    filler(38, 1),
    dateField("bondTerminationDate", 39, "C"),
    filler(45, 1),
    { key: "periodicMonthlyStatementStatus", start: 46, length: 1, class: "AN", designation: "C" },
    filler(47, 1),
    { key: "bondSufficiencyIndicator", start: 48, length: 1, class: "AN", designation: "C" },
    filler(49, 1),
    { key: "bondUserStatusIndicator", start: 50, length: 1, class: "AN", designation: "C" },
    filler(51, 1),
    dateField("bondUserTerminationDate", 52, "C"),
    wholeDollarField("bondAmount", 58, 10, "C"),
    filler(68, 13),
  ],
};

// ── Record K3: Mailing Address Lines 1-2 (Output, Conditional) ──────────────

export const RECORD_K3_SPEC: RecordSpec<K3Output> = {
  recordType: "Record K3 (Importer/Bond Query Output — Mailing Address Lines 1-2)",
  length: 80,
  fields: [
    constantField(1, "K"),
    constantField(2, "3"),
    { key: "addressLine1", start: 3, length: 32, class: "X", designation: "C" },
    { key: "addressLine2", start: 35, length: 32, class: "X", designation: "C" },
    filler(67, 14),
  ],
};

// ── Record K4: Mailing City/State/Postal (Output, Conditional) ──────────────

export const RECORD_K4_SPEC: RecordSpec<K4Output> = {
  recordType: "Record K4 (Importer/Bond Query Output — Mailing City/State/Postal)",
  length: 80,
  fields: [
    constantField(1, "K"),
    constantField(2, "4"),
    filler(3, 32),
    { key: "city", start: 35, length: 21, class: "X", designation: "M" },
    { key: "stateCode", start: 56, length: 2, class: "A", designation: "M" },
    { key: "postalCode", start: 58, length: 9, class: "AN", designation: "M" },
    filler(67, 14),
  ],
};

// ── Record K5: Physical Address Lines 1-2 (Output, Conditional) ─────────────
// Same layout as Record K3.

export const RECORD_K5_SPEC: RecordSpec<K5Output> = {
  recordType: "Record K5 (Importer/Bond Query Output — Physical Address Lines 1-2)",
  length: 80,
  fields: [
    constantField(1, "K"),
    constantField(2, "5"),
    { key: "addressLine1", start: 3, length: 32, class: "X", designation: "C" },
    { key: "addressLine2", start: 35, length: 32, class: "X", designation: "C" },
    filler(67, 14),
  ],
};

// ── Record K6: Physical City/State/Postal (Output, Conditional) ─────────────
// Same layout as Record K4.

export const RECORD_K6_SPEC: RecordSpec<K6Output> = {
  recordType: "Record K6 (Importer/Bond Query Output — Physical City/State/Postal)",
  length: 80,
  fields: [
    constantField(1, "K"),
    constantField(2, "6"),
    filler(3, 32),
    { key: "city", start: 35, length: 21, class: "X", designation: "M" },
    { key: "stateCode", start: 56, length: 2, class: "A", designation: "M" },
    { key: "postalCode", start: 58, length: 9, class: "AN", designation: "M" },
    filler(67, 14),
  ],
};

// ── Record K7: Full Legal Name + Center ID (Output, Conditional) ────────────

export const RECORD_K7_SPEC: RecordSpec<K7Output> = {
  recordType: "Record K7 (Importer/Bond Query Output — Full Legal Name & Center ID)",
  length: 80,
  fields: [
    constantField(1, "K"),
    constantField(2, "7"),
    { key: "fullLegalImporterName", start: 3, length: 30, class: "X", designation: "M" },
    filler(33, 1),
    { key: "centerIdentifier", start: 34, length: 6, class: "AN", designation: "M" },
    filler(40, 1),
    { key: "centerIdDescription", start: 41, length: 30, class: "AN", designation: "M" },
    filler(71, 10),
  ],
};

// ── Record K8: Additional-Info Overflow (Output, Conditional, Repeatable) ───

export const RECORD_K8_SPEC: RecordSpec<K8Output> = {
  recordType: "Record K8 (Importer/Bond Query Output — Additional Information Overflow)",
  length: 80,
  fields: [
    constantField(1, "K"),
    constantField(2, "8"),
    { key: "additionalInformationQualifierCode", start: 3, length: 3, class: "AN", designation: "M" },
    { key: "additionalInformation", start: 6, length: 70, class: "X", designation: "M" },
    filler(76, 5),
  ],
};
