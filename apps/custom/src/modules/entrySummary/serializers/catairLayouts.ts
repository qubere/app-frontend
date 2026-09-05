/**
 * Reference CATAIR-style flat-file layout for filer-handoff Entry Summary
 * exports (U9), registered under the name "catair-ae-2024.1".
 *
 * This is NOT CBP's direct-transmission ABI Entry Summary AE wire format
 * (that lives at `@/lib/abi/entrySummary/*`, a different subsystem/concern —
 * a customer-filer handoff file only needs to be internally consistent and
 * broker-tool-readable, not byte-compatible with CBP's own AE record set).
 * It reuses the generic fixed-width codec at `@/lib/abi/fixedWidth.ts`
 * directly for padding/justification/validation.
 *
 * Deviation: the issue describes the layout as pure JSON config on
 * `FilerProfile.fieldMap`. `fixedWidth.ts`'s `FieldSpec.encodeValue` /
 * `decodeValue` are functions (needed for date and implied-decimal-money
 * fields) and cannot round-trip through a Prisma `Json` column. So the
 * *layout itself* (this file) is a small TS module registered by name;
 * `FilerProfile.fieldMap` on a CATAIR_AE profile only carries a
 * `{ layout: "catair-ae-2024.1" }` reference (see `CatairFieldMap` in
 * catair.ts), keeping the layout swappable per filer without hardcoding a
 * name inside the serializer itself.
 *
 * Covers a reasonable subset: header identification/port/importer, line
 * B27-B34 fields, and a trailer with record count + control sum (B35).
 */

import { Decimal } from "@/lib/tariff/decimal";
import {
  constantField,
  dateField,
  filler,
  numericCodeField,
  type FieldClass,
  type RecordSpec,
} from "@/lib/abi/fixedWidth";
import { FieldOverflowError } from "./catairErrors";

function isNumericClass(cls: FieldClass): boolean {
  return cls === "N" || cls === "SN";
}

/**
 * A right-justified, zero-padded implied-2-decimal money field bound to a
 * `Decimal`. `AbiFixedWidthError`'s own generic overflow message names the
 * field key already; this additionally throws the more structured
 * `FieldOverflowError` (block id / value / max length) the issue asks for,
 * before ever handing a too-long string back to `encodeRecord`.
 */
function impliedDecimal2Field<K extends string>(key: K, start: number, length: number, designation: "M" | "C" | "O") {
  return {
    key,
    start,
    length,
    class: "N" as const,
    designation,
    encodeValue: (raw: unknown) => {
      const d = raw as Decimal;
      if (d.isNegative()) {
        throw new FieldOverflowError(key, d.toString(), length);
      }
      const cents = d.times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0);
      if (cents.length > length) {
        throw new FieldOverflowError(key, d.toString(), length);
      }
      return cents.padStart(length, "0");
    },
    decodeValue: (field: string) => new Decimal(field).dividedBy(100),
  };
}

// ---------------------------------------------------------------------------
// H-Record (header identification / port / importer)
// ---------------------------------------------------------------------------

export interface CatairHeaderRecord {
  sequenceNumber: number;
  filerCode: string;
  entryNumber: string;
  entryType: string;
  portCode: string;
  importerNumber?: string;
  summaryDate?: Date;
  entryDate: Date;
}

export const CATAIR_HEADER_SPEC: RecordSpec<CatairHeaderRecord> = {
  recordType: "H01-Record (Entry Summary Header)",
  length: 80,
  fields: [
    constantField(1, "H01"),
    { key: "sequenceNumber", start: 4, length: 4, class: "N", designation: "M" },
    { key: "filerCode", start: 8, length: 3, class: "AN", designation: "M" },
    { key: "entryNumber", start: 11, length: 11, class: "AN", designation: "M" },
    { key: "entryType", start: 22, length: 2, class: "AN", designation: "M" },
    numericCodeField("portCode", 24, 4, "M"),
    { key: "importerNumber", start: 28, length: 15, class: "AN", designation: "C" },
    dateField("summaryDate", 43, "C"),
    dateField("entryDate", 49, "M"),
    filler(55, 26),
  ],
};

// ---------------------------------------------------------------------------
// L-Record (per line, B27-B34 subset)
// ---------------------------------------------------------------------------

export interface CatairLineRecord {
  sequenceNumber: number;
  lineNumber: number;
  htsNumber: string;
  countryOfOrigin?: string;
  description: string;
  enteredValue: Decimal;
  dutyTax?: Decimal;
}

export const CATAIR_LINE_SPEC: RecordSpec<CatairLineRecord> = {
  recordType: "L01-Record (Entry Summary Line)",
  length: 80,
  fields: [
    constantField(1, "L01"),
    { key: "sequenceNumber", start: 4, length: 4, class: "N", designation: "M" },
    { key: "lineNumber", start: 8, length: 3, class: "N", designation: "M" },
    { key: "htsNumber", start: 11, length: 10, class: "AN", designation: "M" },
    { key: "countryOfOrigin", start: 21, length: 2, class: "A", designation: "C" },
    { key: "description", start: 23, length: 35, class: "X", designation: "M" },
    impliedDecimal2Field("enteredValue", 58, 12, "M"),
    impliedDecimal2Field("dutyTax", 70, 10, "C"),
    filler(80, 1),
  ],
};

// ---------------------------------------------------------------------------
// T-Record (trailer / control)
// ---------------------------------------------------------------------------

export interface CatairTrailerRecord {
  sequenceNumber: number;
  recordCount: number;
  controlSum: Decimal;
}

export const CATAIR_TRAILER_SPEC: RecordSpec<CatairTrailerRecord> = {
  recordType: "T01-Record (Entry Summary Trailer)",
  length: 80,
  fields: [
    constantField(1, "T01"),
    { key: "sequenceNumber", start: 4, length: 4, class: "N", designation: "M" },
    { key: "recordCount", start: 8, length: 6, class: "N", designation: "M" },
    impliedDecimal2Field("controlSum", 14, 12, "M"),
    filler(26, 55),
  ],
};

export interface CatairLayout {
  name: string;
  header: RecordSpec<CatairHeaderRecord>;
  line: RecordSpec<CatairLineRecord>;
  trailer: RecordSpec<CatairTrailerRecord>;
}

export const CATAIR_AE_2024_1: CatairLayout = {
  name: "catair-ae-2024.1",
  header: CATAIR_HEADER_SPEC,
  line: CATAIR_LINE_SPEC,
  trailer: CATAIR_TRAILER_SPEC,
};

const LAYOUT_REGISTRY: Record<string, CatairLayout> = {
  [CATAIR_AE_2024_1.name]: CATAIR_AE_2024_1,
};

export class UnknownCatairLayoutError extends Error {
  constructor(readonly layout: string) {
    super(`Unknown CATAIR layout "${layout}". Known layouts: ${Object.keys(LAYOUT_REGISTRY).join(", ")}.`);
    this.name = "UnknownCatairLayoutError";
  }
}

export function getCatairLayout(name: string): CatairLayout {
  const layout = LAYOUT_REGISTRY[name];
  if (!layout) throw new UnknownCatairLayoutError(name);
  return layout;
}

export { isNumericClass };
