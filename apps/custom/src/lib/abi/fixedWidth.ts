/**
 * Generic, spec-agnostic fixed-width record codec.
 *
 * CBP's CATAIR chapters (starting with Batch & Block Control) transmit data as
 * flat 80-character-per-line records, each column a fixed position/length/class.
 * This module knows nothing about any specific CATAIR record — it only knows how
 * to encode/decode a line given a `RecordSpec` describing its columns. Later
 * chapters (e.g. Entry Summary AE/AX) build their own RecordSpecs on top of this.
 */

export type FieldClass = "S" | "A" | "N" | "SN" | "AN" | "D" | "X";
// S=filler(space only) A=alpha(A-Z) N=numeric(0-9, zero-padded, right-justified)
// SN=numeric "(S)N" (may be space-padded, right-justified) AN=alphanumeric(A-Z,0-9,space; left-justified, space-padded)
// D=date MMDDYY(6 numeric digits) X=free keyboard text (left-justified, space-padded)

export type Designation = "M" | "C" | "O";
// M=mandatory C=conditional O=optional

export interface FieldSpec<K extends string = string> {
  /** null = filler (or a constant, see below); excluded from the decoded object, not settable on encode. */
  key: K | null;
  /** 1-based inclusive start column. */
  start: number;
  length: number;
  class: FieldClass;
  designation: Designation;
  /**
   * A fixed literal value always written at this position on encode (e.g. the
   * "A" control identifier, or the "REF ID:" constant text) — not supplied by
   * the caller. Only valid when `key` is null.
   */
  constant?: string;
  /** Extension point for a later slice (e.g. Decimal-based implied-decimal money fields). */
  encodeValue?: (raw: unknown) => string;
  decodeValue?: (field: string) => unknown;
}

// Constrained to `object` rather than `Record<string, unknown>`: plain interfaces
// (no index signature) don't structurally satisfy a `Record<string, unknown>`
// generic constraint in TS, even though every concrete field type here is a
// closed interface — see ARecordInput etc. in types.ts.
export interface RecordSpec<T extends object = Record<string, unknown>> {
  /** Human-readable label used in error messages, e.g. "A-Record (Batch Control Header)". */
  recordType: string;
  length: number;
  fields: ReadonlyArray<FieldSpec<Extract<keyof T, string>>>;
}

export class AbiFixedWidthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AbiFixedWidthError";
  }
}

const ALPHA_RE = /^[A-Z]*$/;
const NUMERIC_RE = /^[0-9]*$/;
const ALPHANUMERIC_RE = /^[A-Z0-9 ]*$/;
// Class X ("Special Data"): A-Z, 0-9, space, and standard keyboard punctuation. We
// accept anything printable-ASCII rather than enumerating CBP's exact punctuation
// list, since the spec's own list is "characters found on a standard keyboard."
const PRINTABLE_ASCII_RE = /^[\x20-\x7E]*$/;

function isNumericClass(cls: FieldClass): boolean {
  return cls === "N" || cls === "SN";
}

function validateClass(cls: FieldClass, raw: string, fieldLabel: string, recordType: string): void {
  const trimmed = cls === "SN" || cls === "N" ? raw.trimStart() : raw;
  switch (cls) {
    case "S":
      if (raw.trim().length > 0) {
        throw new AbiFixedWidthError(
          `${recordType}: field "${fieldLabel}" is a filler (class S) but received non-space content "${raw}".`
        );
      }
      return;
    case "A":
      if (!ALPHA_RE.test(raw.trimEnd())) {
        throw new AbiFixedWidthError(
          `${recordType}: field "${fieldLabel}" (class A) must be uppercase A-Z only, got "${raw}".`
        );
      }
      return;
    case "N":
    case "SN":
      if (!NUMERIC_RE.test(trimmed)) {
        throw new AbiFixedWidthError(
          `${recordType}: field "${fieldLabel}" (class ${cls}) must be numeric, got "${raw}".`
        );
      }
      return;
    case "AN":
      if (!ALPHANUMERIC_RE.test(raw)) {
        throw new AbiFixedWidthError(
          `${recordType}: field "${fieldLabel}" (class AN) must be uppercase A-Z, 0-9, or space, got "${raw}".`
        );
      }
      return;
    case "D":
      if (!NUMERIC_RE.test(raw) && raw.trim().length > 0) {
        throw new AbiFixedWidthError(
          `${recordType}: field "${fieldLabel}" (class D) must be MMDDYY digits or blank, got "${raw}".`
        );
      }
      return;
    case "X":
      if (!PRINTABLE_ASCII_RE.test(raw)) {
        throw new AbiFixedWidthError(
          `${recordType}: field "${fieldLabel}" (class X) contains a non-keyboard character: "${raw}".`
        );
      }
      return;
  }
}

function defaultEncode(spec: FieldSpec, value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (str !== str.toUpperCase()) {
    throw new AbiFixedWidthError(
      `Field "${spec.key}" must be uppercase-only per the CATAIR submission notes, got "${str}".`
    );
  }
  if (str.length > spec.length) {
    throw new AbiFixedWidthError(
      `Field "${spec.key}" value "${str}" (${str.length} chars) exceeds its declared length of ${spec.length}.`
    );
  }
  if (isNumericClass(spec.class)) {
    return str.padStart(spec.length, "0");
  }
  return str.padEnd(spec.length, " ");
}

function defaultDecode(spec: FieldSpec, field: string): string | number {
  if (isNumericClass(spec.class)) {
    const trimmed = field.trim();
    return trimmed.length === 0 ? 0 : parseInt(trimmed, 10);
  }
  return field.trimEnd();
}

/**
 * Encode a record from a values object. Never truncates: any value that
 * overflows its field's declared length throws rather than being silently cut.
 */
export function encodeRecord<T extends object>(spec: RecordSpec<T>, values: Partial<T>): string {
  const chars = new Array<string>(spec.length).fill(" ");

  for (const field of spec.fields) {
    if (field.key === null) {
      if (field.constant === undefined) continue; // plain filler column stays space-filled
      if (field.constant.length !== field.length) {
        throw new AbiFixedWidthError(
          `${spec.recordType}: constant "${field.constant}" is ${field.constant.length} chars, expected exactly ${field.length}.`
        );
      }
      for (let i = 0; i < field.length; i++) {
        chars[field.start - 1 + i] = field.constant[i];
      }
      continue;
    }

    const raw = (values as Record<string, unknown>)[field.key];
    if (field.designation === "M" && (raw === undefined || raw === null || raw === "")) {
      throw new AbiFixedWidthError(
        `${spec.recordType}: mandatory field "${field.key}" is missing.`
      );
    }
    if (raw === undefined || raw === null || raw === "") continue; // conditional/optional, unset

    const encoded = field.encodeValue ? field.encodeValue(raw) : defaultEncode(field, raw);
    if (encoded.length !== field.length) {
      throw new AbiFixedWidthError(
        `${spec.recordType}: encoded value for field "${field.key}" is ${encoded.length} chars, expected exactly ${field.length}.`
      );
    }
    validateClass(field.class, encoded, String(field.key), spec.recordType);

    for (let i = 0; i < field.length; i++) {
      chars[field.start - 1 + i] = encoded[i];
    }
  }

  const line = chars.join("");
  if (line.length !== spec.length) {
    throw new AbiFixedWidthError(
      `${spec.recordType}: assembled record is ${line.length} chars, expected exactly ${spec.length}.`
    );
  }
  return line;
}

/**
 * Decode a fixed-width line into a values object per `spec`. Filler columns are
 * extracted (for length/shape validation) but omitted from the returned object.
 * Decoding is intentionally lenient about content (CBP's own output may contain
 * blanks in conditional fields) — use `encodeRecord` for strict input validation.
 */
export function decodeRecord<T extends object>(spec: RecordSpec<T>, line: string): T {
  if (line.length !== spec.length) {
    throw new AbiFixedWidthError(
      `${spec.recordType}: line is ${line.length} chars, expected exactly ${spec.length}.`
    );
  }

  const result = {} as Record<string, unknown>;
  for (const field of spec.fields) {
    const raw = line.slice(field.start - 1, field.start - 1 + field.length);
    if (field.key === null) continue;
    result[field.key] = field.decodeValue ? field.decodeValue(raw) : defaultDecode(field, raw);
  }
  return result as T;
}

/**
 * Split raw multi-line CATAIR text into individual fixed-length lines. Drops a
 * single trailing blank line (common with trailing newlines); throws naming the
 * offending 1-based line number if any non-blank line's length doesn't match.
 */
export function splitFixedWidthLines(raw: string, lineLength = 80): string[] {
  const lines = raw.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  lines.forEach((line, idx) => {
    if (line.length !== lineLength) {
      throw new AbiFixedWidthError(
        `Line ${idx + 1} is ${line.length} chars, expected exactly ${lineLength}: "${line}"`
      );
    }
  });
  return lines;
}

// ── Shared field-spec builders ──────────────────────────────────────────────
// CATAIR's class D (MMDDYY date) is identical across every chapter — shared
// here rather than redefined per chapter's recordSpecs.ts.

function encodeMMDDYY(raw: unknown): string {
  const date = raw as Date;
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  return `${mm}${dd}${yy}`;
}

function decodeMMDDYY(field: string): Date | undefined {
  if (field.trim().length === 0) return undefined;
  const mm = parseInt(field.slice(0, 2), 10);
  const dd = parseInt(field.slice(2, 4), 10);
  const yy = parseInt(field.slice(4, 6), 10);
  return new Date(2000 + yy, mm - 1, dd);
}

/** A 6-char class-D (MMDDYY) field bound to a `Date | undefined` value. */
export function dateField<K extends string>(
  key: K,
  start: number,
  designation: Designation
): FieldSpec<K> {
  return { key, start, length: 6, class: "D", designation, encodeValue: encodeMMDDYY, decodeValue: decodeMMDDYY };
}

// CATAIR's "MMDDYYHHMMSSXX" 14-char date/time format (12-hour clock + AM/PM
// suffix, e.g. Entry Summary Query's Accept Date/Time and Requested From/To
// Date/Time) is class AN, not class D, since it ends in letters. Shared here
// since multiple chapters reference "accept date/time"-style fields.

function encodeDateTime14(raw: unknown): string {
  const date = raw as Date;
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const hours24 = date.getHours();
  const period = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 || 12;
  const hh = String(hours12).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${mm}${dd}${yy}${hh}${min}${ss}${period}`;
}

function decodeDateTime14(field: string): Date | undefined {
  if (field.trim().length === 0) return undefined;
  const mm = parseInt(field.slice(0, 2), 10);
  const dd = parseInt(field.slice(2, 4), 10);
  const yy = parseInt(field.slice(4, 6), 10);
  const hh12 = parseInt(field.slice(6, 8), 10);
  const min = parseInt(field.slice(8, 10), 10);
  const ss = parseInt(field.slice(10, 12), 10);
  const period = field.slice(12, 14);
  const hours24 = (hh12 % 12) + (period === "PM" ? 12 : 0);
  return new Date(2000 + yy, mm - 1, dd, hours24, min, ss);
}

/** A 14-char class-AN "MMDDYYHHMMSSXX" date/time field (12-hour clock, AM/PM
 * suffix) bound to a `Date | undefined` value. */
export function dateTimeField<K extends string>(
  key: K,
  start: number,
  designation: Designation
): FieldSpec<K> {
  return {
    key,
    start,
    length: 14,
    class: "AN",
    designation,
    encodeValue: encodeDateTime14,
    decodeValue: decodeDateTime14,
  };
}

// CATAIR PGA Message Set's (Chapter 8) 8-char "MMDDCCYY" date format (month,
// day, 4-digit century+year) — distinct from every prior chapter's 6-char
// MMDDYY class-D date. Per the source PDF (e.g. PG06 Processing Start/End
// Date, PG14 LPCO Date, PG22 Date of Signature, PG25 Production Start/End
// Date, PG30 Requested/Scheduled Date), every one of these fields is
// documented as Class "N" — not "D" — so this is a plain numeric field whose
// value happens to parse as a date, not a class-D field. Shared here (not
// chapter-local) since it's a generic CATAIR wire convention, same rationale
// as `dateField`/`dateTimeField` above.

function encodeMMDDCCYY(raw: unknown): string {
  const date = raw as Date;
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const ccyy = String(date.getFullYear()).padStart(4, "0");
  return `${mm}${dd}${ccyy}`;
}

function decodeMMDDCCYY(field: string): Date | undefined {
  if (field.trim().length === 0) return undefined;
  const mm = parseInt(field.slice(0, 2), 10);
  const dd = parseInt(field.slice(2, 4), 10);
  const ccyy = parseInt(field.slice(4, 8), 10);
  return new Date(ccyy, mm - 1, dd);
}

/** An 8-char class-N "MMDDCCYY" (month, day, century+year) date field bound to
 * a `Date | undefined` value. Unlike `dateField` (6-char, class D, MMDDYY),
 * this format's 4-digit year and class-N designation are specific to the PGA
 * Message Set chapter (Chapter 8) — see the module-level comment above. */
export function dateFieldCCYY<K extends string>(
  key: K,
  start: number,
  designation: Designation
): FieldSpec<K> {
  return { key, start, length: 8, class: "N", designation, encodeValue: encodeMMDDCCYY, decodeValue: decodeMMDDCCYY };
}

// ACE Broker Download's (Chapter 9) Status Notification records (NS05's
// Estimated Date of Arrival, NS30's Action Date) use a 6-char "YYMMDD"
// (year, month, day) date format — a different field order from every other
// chapter's 6-char "MMDDYY" (class D, `dateField` above), even though both
// are 6 digits. Per the source PDF, both fields are documented as class "N"
// (matching PGA's `dateFieldCCYY` rationale for trusting the PDF's stated
// class over an assumed "D"). Shared here (not chapter-local) since a future
// chapter could plausibly reuse a CBP-assigned "YYMMDD" field too.

function encodeYYMMDD(raw: unknown): string {
  const date = raw as Date;
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

function decodeYYMMDD(field: string): Date | undefined {
  if (field.trim().length === 0) return undefined;
  const yy = parseInt(field.slice(0, 2), 10);
  const mm = parseInt(field.slice(2, 4), 10);
  const dd = parseInt(field.slice(4, 6), 10);
  return new Date(2000 + yy, mm - 1, dd);
}

/** A 6-char class-N "YYMMDD" (year, month, day) date field bound to a
 * `Date | undefined` value. Unlike `dateField` (6-char, class D, MMDDYY),
 * this format's field order and class-N designation are specific to ACE
 * Broker Download's Status Notification records (Chapter 9) — see the
 * module-level comment above. */
export function dateFieldYYMMDD<K extends string>(
  key: K,
  start: number,
  designation: Designation
): FieldSpec<K> {
  return { key, start, length: 6, class: "N", designation, encodeValue: encodeYYMMDD, decodeValue: decodeYYMMDD };
}

// ACE Cargo Manifest/In-bond/Entry Status Query's (Chapter 4b) output records
// (WO10's Estimated Date of Arrival, WO60's Disposition Action Date & Release
// Date, WR1-Output's Date of Arrival) use the same 6-char "MMDDYY" digit order
// as `dateField` above, but the source PDF documents every one of them as
// class "N" — not class "D". Same rationale as `dateFieldCCYY`/`dateFieldYYMMDD`
// for trusting the PDF's stated class over an assumed "D": class N's
// validation (strictly numeric, no blank-tolerant carve-out beyond an empty
// trimmed string) differs from class D's, so this reuses `dateField`'s
// MMDDYY encode/decode logic under a distinct class tag rather than aliasing
// `dateField` itself. Shared here (not chapter-local) since a future chapter
// could plausibly reuse a CBP-assigned class-N MMDDYY field too.

/** A 6-char class-N "MMDDYY" date field bound to a `Date | undefined` value.
 * Same digit order as `dateField` (6-char, class D, MMDDYY) but a different
 * declared wire class — see the module-level comment above. */
export function dateFieldNumericMMDDYY<K extends string>(
  key: K,
  start: number,
  designation: Designation
): FieldSpec<K> {
  return { key, start, length: 6, class: "N", designation, encodeValue: encodeMMDDYY, decodeValue: decodeMMDDYY };
}

// ACE Importer/Bond Query's (Application Identifier KI/KR) K1-Output's Bond
// Effective Date uses the same 6-char "MMDDYY" digit order as `dateField`
// above, but the source PDF documents it as class "AN" — not class "D" or
// class "N" — genuinely distinct from every other chapter's MMDDYY date field
// (confirmed directly against the source PDF,
// docs/plans/catair-source-docs/importer-bond-query-v7.pdf, page 11/QIB-10;
// the same chapter's other two MMDDYY dates, K2-Output's Bond Termination
// Date and Bond User Termination Date, are class D and use `dateField` as
// normal — this is a field-by-field distinction, not a chapter-wide one).
// Reuses `dateField`'s MMDDYY encode/decode logic under a distinct class tag,
// same rationale as `dateFieldNumericMMDDYY` for class N.

/** A 6-char class-AN "MMDDYY" date field bound to a `Date | undefined` value.
 * Same digit order as `dateField` (6-char, class D, MMDDYY) but a different
 * declared wire class — see the module-level comment above. */
export function dateFieldAlphanumericMMDDYY<K extends string>(
  key: K,
  start: number,
  designation: Designation
): FieldSpec<K> {
  return { key, start, length: 6, class: "AN", designation, encodeValue: encodeMMDDYY, decodeValue: decodeMMDDYY };
}

/**
 * A right-justified, zero-padded numeric-*looking* identifier (class N) whose
 * leading zeros are semantically significant — e.g. an Entry Type Code ("01"),
 * an Accounting Class Code ("056"), a Surety Code. Zero-pads and validates
 * digits-only on encode like a plain class-N field, but decodes to the raw
 * padded string rather than `defaultDecode`'s `parseInt` (which would silently
 * discard a leading zero, e.g. "037" -> 37 — a real bug for a value that's an
 * identifier, not a quantity). Use a plain `{ class: "N", ... }` field instead
 * when the value genuinely is a count/quantity that should decode as a number.
 */
export function numericCodeField<K extends string>(
  key: K,
  start: number,
  length: number,
  designation: Designation
): FieldSpec<K> {
  return {
    key,
    start,
    length,
    class: "N",
    designation,
    decodeValue: (field) => (field.trim().length === 0 ? undefined : field),
  };
}

/** A space-filler column (no key, no data). */
export function filler(start: number, length: number): FieldSpec<never> {
  return { key: null, start, length, class: "S", designation: "M" };
}

/** A fixed literal value always written at `start` (e.g. a control identifier). */
export function constantField(start: number, value: string): FieldSpec<never> {
  return { key: null, start, length: value.length, class: "A", designation: "M", constant: value };
}

/**
 * Shared "condition reference" prefix (pos 1-25): control identifier, reference
 * data type code, occurrence position, and the "REF ID:" literal. Every CATAIR
 * chapter's diagnostic reference record uses this exact layout for its first 25
 * columns (Batch & Block Control's X0-Record, Entry Summary's E0-Record, ...) —
 * only the control identifier and what follows position 25 differ per chapter.
 */
export function conditionReferencePrefix(
  controlIdentifier: string
): FieldSpec<"referenceDataTypeCode" | "occurrencePosition">[] {
  return [
    constantField(1, controlIdentifier),
    filler(3, 1),
    { key: "referenceDataTypeCode", start: 4, length: 6, class: "AN", designation: "M" },
    filler(10, 1),
    { key: "occurrencePosition", start: 11, length: 6, class: "N", designation: "M" },
    filler(17, 1),
    constantField(18, "REF ID:"),
    filler(25, 1),
  ];
}
