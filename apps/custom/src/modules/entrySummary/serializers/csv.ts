/**
 * CSV serializer for the CBP Form 7501 Entry Summary draft (U8).
 *
 * Pure function: no DB, no I/O, no `new Date()`/`Math.random()`. Column
 * order, headers, and block inclusion are entirely driven by
 * `FilerProfileRecord.fieldMap` (a Prisma `Json` column with no fixed TS
 * shape) — this module defines and validates that shape as `CsvFieldMap`.
 *
 * Deviation from the issue text: `EntrySummaryDraft` (U1's pure in-memory
 * model) carries no shipment-number or version — only the U7-persisted
 * `EntrySummaryDraftRow` does, and even that carries `shipmentId` (a cuid),
 * not the human-readable `Shipment.shipmentNumber`. Per the issue's own
 * fallback instruction, filename-relevant identifiers are accepted as an
 * explicit `opts` parameter rather than derived from `draft`.
 */

import { Decimal, roundToCents } from "@/lib/tariff/decimal";
import { z } from "zod";
import {
  HEADER_BLOCK_IDS,
  LINE_BLOCK_IDS,
  type Block,
  type EntrySummaryDraft,
  type EntrySummaryLine,
  type HeaderBlockId,
  type LineBlockId,
} from "../model";
import type { EntrySummaryField } from "../provenance";
import type { FilerProfileRecord } from "../filerProfile";

const HEADER_BLOCK_SET: ReadonlySet<string> = new Set(HEADER_BLOCK_IDS);
const LINE_BLOCK_SET: ReadonlySet<string> = new Set(LINE_BLOCK_IDS);

// ---------------------------------------------------------------------------
// FilerProfile.fieldMap shape for CSV exports
// ---------------------------------------------------------------------------

export const CSV_DATE_FORMATS = ["MMDDYYYY", "MMDDYY", "YYYY-MM-DD"] as const;
export type CsvDateFormat = (typeof CSV_DATE_FORMATS)[number];

export interface CsvFieldMapColumn {
  blockId: Block;
  header: string;
}

export interface CsvFieldMap {
  columns: CsvFieldMapColumn[];
  /** Default: "MMDDYYYY". */
  dateFormat?: CsvDateFormat;
  /** Tokens: {filerCode} {shipmentNumber} {version}. Default: "{filerCode}_{shipmentNumber}_v{version}.csv". */
  filenamePattern?: string;
}

export class InvalidCsvFieldMapError extends Error {
  constructor(message: string) {
    super(`FilerProfile.fieldMap is not a valid CsvFieldMap: ${message}`);
    this.name = "InvalidCsvFieldMapError";
  }
}

export class UnknownBlockIdError extends Error {
  constructor(readonly blockId: string) {
    super(`fieldMap references unknown block id "${blockId}".`);
    this.name = "UnknownBlockIdError";
  }
}

const csvFieldMapSchema = z.object({
  columns: z
    .array(
      z.object({
        blockId: z.string(),
        header: z.string(),
      })
    )
    .default([]),
  dateFormat: z.enum(CSV_DATE_FORMATS).optional(),
  filenamePattern: z.string().optional(),
});

function parseCsvFieldMap(raw: unknown): CsvFieldMap {
  const parsed = csvFieldMapSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new InvalidCsvFieldMapError(parsed.error.message);
  }
  for (const col of parsed.data.columns) {
    if (!HEADER_BLOCK_SET.has(col.blockId) && !LINE_BLOCK_SET.has(col.blockId)) {
      throw new UnknownBlockIdError(col.blockId);
    }
  }
  return parsed.data as CsvFieldMap;
}

// ---------------------------------------------------------------------------
// Value lookup + rendering
// ---------------------------------------------------------------------------

function getRawValue(draft: EntrySummaryDraft, line: EntrySummaryLine, blockId: Block): unknown {
  if (HEADER_BLOCK_SET.has(blockId)) {
    const fields = draft.header.fields as unknown as Record<string, EntrySummaryField<unknown>>;
    return fields[blockId as HeaderBlockId].value;
  }
  if (LINE_BLOCK_SET.has(blockId)) {
    const fields = line.fields as unknown as Record<string, EntrySummaryField<unknown>>;
    return fields[blockId as LineBlockId].value;
  }
  throw new UnknownBlockIdError(blockId);
}

const DATE_BLOCK_RE = /_DATE$/;

/** Best-effort ISO ("YYYY-MM-DD..." prefix) -> requested format. Unparseable input passes through unchanged. */
function formatDateValue(raw: string, format: CsvDateFormat): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!m) return raw;
  const [, yyyy, mm, dd] = m;
  switch (format) {
    case "MMDDYYYY":
      return `${mm}${dd}${yyyy}`;
    case "MMDDYY":
      return `${mm}${dd}${yyyy.slice(2)}`;
    case "YYYY-MM-DD":
      return `${yyyy}-${mm}-${dd}`;
  }
}

function renderOtherFeeArray(value: unknown[]): string {
  return value
    .map((entry) => {
      if (entry && typeof entry === "object" && "code" in entry && "amount" in entry) {
        const fee = entry as { code: string; amount: Decimal };
        return `${fee.code}:${roundToCents(fee.amount).toFixed(2)}`;
      }
      return String(entry);
    })
    .join(";");
}

function renderCellValue(value: unknown, blockId: Block, dateFormat: CsvDateFormat): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Decimal) return roundToCents(value).toFixed(2);
  if (Array.isArray(value)) return renderOtherFeeArray(value);
  if (typeof value === "string") {
    if (DATE_BLOCK_RE.test(blockId) && value.trim().length > 0) {
      return formatDateValue(value, dateFormat);
    }
    return value;
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// RFC 4180 quoting + CSV-injection defense
// ---------------------------------------------------------------------------

/** Excel/Sheets formula-injection guard: a value opening with one of these is prefixed with an apostrophe. */
const INJECTION_PREFIX_RE = /^[=+\-@\t\r]/;
const NEEDS_QUOTING_RE = /[",\r\n]/;

export function csvEscapeCell(raw: string): string {
  let value = raw;
  if (INJECTION_PREFIX_RE.test(value)) {
    value = `'${value}`;
  }
  if (NEEDS_QUOTING_RE.test(value)) {
    value = `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Filename
// ---------------------------------------------------------------------------

export interface SerializeCsvOptions {
  shipmentNumber?: string;
  version?: number;
}

function buildFilename(pattern: string | undefined, filerCode: string, shipmentNumber: string, version: number): string {
  const tpl = pattern ?? "{filerCode}_{shipmentNumber}_v{version}.csv";
  return tpl
    .replace(/\{filerCode\}/g, filerCode)
    .replace(/\{shipmentNumber\}/g, shipmentNumber)
    .replace(/\{version\}/g, String(version));
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface SerializedFile {
  filename: string;
  contentType: string;
  body: string;
}

/**
 * Emits a CSV file: one header row (column names) followed by one data row
 * per draft line (a "line" includes Chapter 99 child lines, already ordered
 * immediately after their parent by the assembler). A column mapped to a
 * header block repeats that header value on every data row. Zero lines
 * produces the header row only, no trailing blank record.
 */
export function serializeCsv(draft: EntrySummaryDraft, profile: FilerProfileRecord, opts: SerializeCsvOptions = {}): SerializedFile {
  const fieldMap = parseCsvFieldMap(profile.fieldMap);
  const dateFormat = fieldMap.dateFormat ?? "MMDDYYYY";

  const records: string[][] = [];
  records.push(fieldMap.columns.map((c) => c.header));

  for (const line of draft.lines) {
    records.push(
      fieldMap.columns.map((col) => renderCellValue(getRawValue(draft, line, col.blockId), col.blockId, dateFormat))
    );
  }

  const body = records.map((row) => row.map(csvEscapeCell).join(",")).join("\r\n") + "\r\n";

  const filename = buildFilename(
    fieldMap.filenamePattern,
    profile.filerCode,
    opts.shipmentNumber ?? "UNKNOWN-SHIPMENT",
    opts.version ?? 1
  );

  return { filename, contentType: "text/csv", body };
}
