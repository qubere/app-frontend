/**
 * CATAIR-style fixed-width flat-file serializer (U9) for filer handoff.
 *
 * Pure aside from the two injected ports (`sequence`, and the layout lookup
 * which is a pure in-process registry): no DB, no I/O, no `new Date()` /
 * `Math.random()`. Reuses `@/lib/abi/fixedWidth.ts`'s generic codec for all
 * padding/justification/validation — see catairLayouts.ts for the reference
 * "catair-ae-2024.1" layout and why it is a registered TS module rather than
 * JSON on `FilerProfile.fieldMap`.
 *
 * Deviation found while reading fixedWidth.ts (per the issue's own
 * instruction to verify before assuming): `defaultEncode` for alpha/AN
 * classes does NOT auto-uppercase — it *throws* `AbiFixedWidthError` if the
 * input isn't already uppercase. So "alpha fields ... uppercased" does NOT
 * come for free; this module uppercases (and ASCII-transliterates) string
 * values itself, in the value-builders below, before they ever reach
 * `encodeRecord`.
 */

import { z } from "zod";
import { Decimal } from "@/lib/tariff/decimal";
import { encodeRecord, type FieldClass, type RecordSpec } from "@/lib/abi/fixedWidth";
import type { EntrySummaryDraft, EntrySummaryLine } from "../model";
import type { FilerProfileRecord } from "../filerProfile";
import { getCatairLayout, type CatairHeaderRecord, type CatairLayout, type CatairLineRecord, type CatairTrailerRecord } from "./catairLayouts";
import { toCatairAlpha } from "./transliterate";

export { FieldOverflowError, UnsupportedCharacterError } from "./catairErrors";
export { transliterateToAscii, toCatairAlpha } from "./transliterate";
export { getCatairLayout, CATAIR_AE_2024_1, UnknownCatairLayoutError } from "./catairLayouts";
export type { CatairLayout } from "./catairLayouts";

// ---------------------------------------------------------------------------
// FilerProfile.fieldMap shape for CATAIR exports — a layout reference only
// (see catairLayouts.ts's module doc for why the layout itself isn't JSON).
// ---------------------------------------------------------------------------

export interface CatairFieldMap {
  layout: string;
}

export class InvalidCatairFieldMapError extends Error {
  constructor(message: string) {
    super(`FilerProfile.fieldMap is not a valid CatairFieldMap: ${message}`);
    this.name = "InvalidCatairFieldMapError";
  }
}

const catairFieldMapSchema = z.object({ layout: z.string().min(1) });

function parseCatairFieldMap(raw: unknown): CatairFieldMap {
  const parsed = catairFieldMapSchema.safeParse(raw ?? {});
  if (!parsed.success) throw new InvalidCatairFieldMapError(parsed.error.message);
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Null policy: an unset OPTIONAL/CONDITIONAL numeric field encodes as zeros;
// an unset OPTIONAL/CONDITIONAL alpha field encodes as spaces (fixedWidth's
// own default — leaving the key absent already produces that). A MANDATORY
// field left null is never silently defaulted here — fixedWidth.ts itself
// throws "mandatory field is missing", which is the correct compliance
// behavior (Phase A's validation engine should have caught this already).
// ---------------------------------------------------------------------------

function isNumericClass(cls: FieldClass): boolean {
  return cls === "N" || cls === "SN";
}

function applyNullPolicy<T extends object>(values: Partial<T>, spec: RecordSpec<T>): Partial<T> {
  const out: Record<string, unknown> = { ...(values as Record<string, unknown>) };
  for (const field of spec.fields) {
    if (field.key === null) continue;
    const raw = out[field.key];
    if ((raw === null || raw === undefined) && field.designation !== "M" && isNumericClass(field.class)) {
      out[field.key] = new Decimal(0);
    }
  }
  return out as Partial<T>;
}

/**
 * Parses a draft date-block string (stored as plain "YYYY-MM-DD") into a
 * `Date` built from LOCAL date parts. Deliberately not `new Date(isoString)`
 * — that parses as UTC midnight, and `fixedWidth.ts`'s MMDDYY encoder reads
 * back the month/day/year in LOCAL time, so any negative-UTC-offset
 * timezone would silently shift the encoded date back a day.
 */
function parseDraftDate(value: string | null | undefined): Date | undefined {
  if (value == null || value.trim().length === 0) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) {
    throw new Error(`Cannot parse "${value}" as a "YYYY-MM-DD" date for CATAIR export.`);
  }
  const [, yyyy, mm, dd] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Cannot parse "${value}" as a date for CATAIR export.`);
  }
  return d;
}

function stripToAlnum(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "");
}

// ---------------------------------------------------------------------------
// Value builders: draft -> layout record values (uppercased/transliterated
// where the target field class demands it).
// ---------------------------------------------------------------------------

function buildHeaderValues(draft: EntrySummaryDraft, profile: FilerProfileRecord, seq: number): Partial<CatairHeaderRecord> {
  const h = draft.header.fields;
  return {
    sequenceNumber: seq,
    filerCode: toCatairAlpha(profile.filerCode),
    entryNumber: h.B01_FILER_ENTRY_NUMBER.value != null ? toCatairAlpha(h.B01_FILER_ENTRY_NUMBER.value) : undefined,
    entryType: h.B02_ENTRY_TYPE.value != null ? toCatairAlpha(h.B02_ENTRY_TYPE.value) : undefined,
    portCode: h.B06_PORT_CODE.value ?? undefined,
    importerNumber: h.B23_IMPORTER_NUMBER.value != null ? toCatairAlpha(stripToAlnum(h.B23_IMPORTER_NUMBER.value)) : undefined,
    summaryDate: parseDraftDate(h.B03_SUMMARY_DATE.value),
    entryDate: parseDraftDate(h.B07_ENTRY_DATE.value),
  } as Partial<CatairHeaderRecord>;
}

function buildLineValues(line: EntrySummaryLine, seq: number): Partial<CatairLineRecord> {
  const f = line.fields;
  return {
    sequenceNumber: seq,
    lineNumber: f.B27_LINE_NUMBER.value ?? line.lineNumber,
    htsNumber: f.B29A_HTSUS_NUMBER.value != null ? toCatairAlpha(stripToAlnum(f.B29A_HTSUS_NUMBER.value)) : undefined,
    countryOfOrigin: f.B10_COUNTRY_OF_ORIGIN.value != null ? toCatairAlpha(f.B10_COUNTRY_OF_ORIGIN.value) : undefined,
    description: f.B28_DESCRIPTION.value != null ? toCatairAlpha(f.B28_DESCRIPTION.value) : undefined,
    enteredValue: f.B32A_ENTERED_VALUE.value ?? undefined,
    dutyTax: f.B34_DUTY_TAX.value ?? undefined,
  } as Partial<CatairLineRecord>;
}

function buildTrailerValues(seq: number, recordCount: number, controlSum: Decimal): Partial<CatairTrailerRecord> {
  return { sequenceNumber: seq, recordCount, controlSum };
}

// ---------------------------------------------------------------------------
// Filename
// ---------------------------------------------------------------------------

function buildFilename(filerCode: string, shipmentNumber: string, version: number): string {
  return `${filerCode}_${shipmentNumber}_v${version}.catair.txt`;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface SerializeCatairOptions {
  /** Monotonic-from-1 record sequence number port — never Math.random/an internal counter with hidden state. */
  sequence: () => number;
  shipmentNumber?: string;
  version?: number;
}

export interface SerializedFile {
  filename: string;
  contentType: string;
  body: string;
}

function encodeOne<T extends object>(spec: RecordSpec<T>, values: Partial<T>): string {
  return encodeRecord(spec, applyNullPolicy(values, spec));
}

/**
 * Emits one header record, one record per draft line (in draft order —
 * Chapter 99 children already sit immediately after their parent), and one
 * trailer record whose control sum matches B35 (Total Entered Value) to the
 * cent. Every record is exactly `layout.<section>.length` characters; no
 * value is ever truncated (an overflow throws `FieldOverflowError` /
 * `AbiFixedWidthError` instead).
 */
export function serializeCatair(draft: EntrySummaryDraft, profile: FilerProfileRecord, opts: SerializeCatairOptions): SerializedFile {
  const fieldMap = parseCatairFieldMap(profile.fieldMap);
  const layout: CatairLayout = getCatairLayout(fieldMap.layout);

  const lines: string[] = [];

  const headerSeq = opts.sequence();
  lines.push(encodeOne(layout.header, buildHeaderValues(draft, profile, headerSeq)));

  for (const line of draft.lines) {
    const seq = opts.sequence();
    lines.push(encodeOne(layout.line, buildLineValues(line, seq)));
  }

  const totalEnteredValue =
    draft.header.fields.B35_TOTAL_ENTERED_VALUE.value ??
    draft.lines.reduce((acc, line) => acc.plus(line.fields.B32A_ENTERED_VALUE.value ?? new Decimal(0)), new Decimal(0));

  const trailerSeq = opts.sequence();
  const recordCount = lines.length + 1; // header + lines already pushed, plus this trailer
  lines.push(encodeOne(layout.trailer, buildTrailerValues(trailerSeq, recordCount, totalEnteredValue)));

  const body = lines.join("\n") + "\n";

  const filename = buildFilename(profile.filerCode, opts.shipmentNumber ?? "UNKNOWN-SHIPMENT", opts.version ?? 1);

  return { filename, contentType: "text/plain", body };
}

// Re-export so callers/tests can build a monotonic-from-1 sequence port without hand-rolling one.
export function createSequence(start = 1): () => number {
  let next = start;
  return () => next++;
}
