/**
 * CSV import for the customs code list masters: parsing, column mapping, and
 * row validation for the combined Header + Item + Translation upload.
 *
 * One CSV row is one (header, item, translation-language) leaf of the
 * Header 1-*-Item 1-*-Translation tree, denormalized flat -- the standard
 * shape for importing a hierarchy through a single flat file. Header and
 * Item columns simply repeat across every row that shares the same header/
 * item; the importer (codeListImportService.ts) groups rows back into that
 * tree before writing anything.
 *
 * The RFC 4180 reader (`parseCsv`) and `.csv` extension check are shared with
 * the party importer -- the parsing grammar doesn't vary by what the rows
 * describe, so it isn't duplicated here.
 */

import { parseCsv, type ParsedCsv } from "@/modules/party/partyCsv";

export { parseCsv, hasCsvExtension, CsvParseError, type ParsedCsv } from "@/modules/party/partyCsv";

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

export type CodeListImportField =
  | "countryIso2"
  | "procedureCode"
  | "listType"
  | "version"
  | "effectiveFrom"
  | "effectiveTo"
  | "headerIsActive"
  | "code"
  | "attributes"
  | "isDeprecated"
  | "languageCode"
  | "displayName"
  | "description";

interface ColumnDefinition {
  field: CodeListImportField;
  aliases: readonly string[];
  label: string;
  required: boolean;
}

const COLUMN_DEFINITIONS: readonly ColumnDefinition[] = [
  { field: "countryIso2", label: "Country ISO2", required: true, aliases: ["country iso2", "countryiso2", "country", "country code"] },
  { field: "procedureCode", label: "Procedure Code", required: true, aliases: ["procedure code", "procedurecode"] },
  { field: "listType", label: "List Type", required: true, aliases: ["list type", "listtype"] },
  { field: "version", label: "Version", required: true, aliases: ["version"] },
  { field: "effectiveFrom", label: "Effective From", required: true, aliases: ["effective from", "effectivefrom"] },
  { field: "effectiveTo", label: "Effective To", required: false, aliases: ["effective to", "effectiveto"] },
  { field: "headerIsActive", label: "Header Is Active", required: false, aliases: ["header is active", "headerisactive", "header active"] },
  { field: "code", label: "Code", required: true, aliases: ["code"] },
  { field: "attributes", label: "Attributes", required: false, aliases: ["attributes"] },
  { field: "isDeprecated", label: "Is Deprecated", required: false, aliases: ["is deprecated", "isdeprecated", "deprecated"] },
  { field: "languageCode", label: "Language Code", required: true, aliases: ["language code", "languagecode", "locale", "language"] },
  { field: "displayName", label: "Display Name", required: true, aliases: ["display name", "displayname", "name"] },
  { field: "description", label: "Description", required: false, aliases: ["description"] },
];

function canonicalHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

const FIELD_BY_ALIAS: ReadonlyMap<string, CodeListImportField> = new Map(
  COLUMN_DEFINITIONS.flatMap((definition) => definition.aliases.map((alias) => [alias, definition.field] as const))
);

export interface ColumnMapping {
  fields: ReadonlyMap<CodeListImportField, number>;
  unmappedHeaders: readonly string[];
  duplicateHeaders: readonly string[];
  missingRequiredFields: readonly string[];
}

export function mapColumns(headers: readonly string[]): ColumnMapping {
  const fields = new Map<CodeListImportField, number>();
  const unmappedHeaders: string[] = [];
  const duplicateHeaders: string[] = [];

  headers.forEach((header, index) => {
    const canonical = canonicalHeader(header);
    if (canonical === "") return;

    const field = FIELD_BY_ALIAS.get(canonical);
    if (field === undefined) {
      unmappedHeaders.push(header);
      return;
    }
    if (fields.has(field)) {
      duplicateHeaders.push(header);
      return;
    }
    fields.set(field, index);
  });

  const missingRequiredFields = COLUMN_DEFINITIONS.filter((d) => d.required && !fields.has(d.field)).map((d) => d.label);

  return { fields, unmappedHeaders, duplicateHeaders, missingRequiredFields };
}

// ---------------------------------------------------------------------------
// Row validation
// ---------------------------------------------------------------------------

export interface ImportRowError {
  column: string | null;
  message: string;
}

export interface ImportCodeListRow {
  countryIso2: string;
  procedureCode: string;
  listType: string;
  version: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  headerIsActive: boolean;
  code: string;
  attributes: Record<string, unknown>;
  isDeprecated: boolean;
  languageCode: string;
  displayName: string;
  description: string | null;
}

export interface ImportRowResult {
  /** 1-based row number in the uploaded file, counting the header as row 1. */
  rowNumber: number;
  status: "VALID" | "INVALID";
  data: ImportCodeListRow | null;
  errors: readonly ImportRowError[];
}

export interface ImportValidationResult {
  mapping: ColumnMapping;
  rows: readonly ImportRowResult[];
  validCount: number;
  invalidCount: number;
  /** Problems with the file as a whole; when non-empty, no row was validated. */
  fileErrors: readonly ImportRowError[];
}

function trimToNull(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** Accepts true/false/1/0/yes/no (case-insensitive); blank uses `fallback`. */
function parseBoolean(value: string | undefined, fallback: boolean): { value: boolean; error: string | null } {
  const trimmed = (value ?? "").trim().toLowerCase();
  if (trimmed === "") return { value: fallback, error: null };
  if (["true", "1", "yes", "y"].includes(trimmed)) return { value: true, error: null };
  if (["false", "0", "no", "n"].includes(trimmed)) return { value: false, error: null };
  return { value: fallback, error: `Expected true/false, got "${value}".` };
}

function parseDate(value: string | undefined): { value: Date | null; error: string | null } {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") return { value: null, error: null };
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return { value: null, error: `"${value}" is not a valid date.` };
  return { value: date, error: null };
}

export function validateImport(parsed: ParsedCsv): ImportValidationResult {
  const mapping = mapColumns(parsed.headers);
  const fileErrors: ImportRowError[] = [];

  if (mapping.missingRequiredFields.length > 0) {
    fileErrors.push({
      column: null,
      message: `Missing required column(s): ${mapping.missingRequiredFields.join(", ")}.`,
    });
  }
  if (mapping.duplicateHeaders.length > 0) {
    fileErrors.push({
      column: null,
      message: `Duplicate column(s) map to the same field: ${mapping.duplicateHeaders.join(", ")}.`,
    });
  }
  if (fileErrors.length > 0) {
    return { mapping, rows: [], validCount: 0, invalidCount: 0, fileErrors };
  }

  const cell = (row: readonly string[], field: CodeListImportField): string | undefined => {
    const index = mapping.fields.get(field);
    return index === undefined ? undefined : row[index];
  };

  const rows: ImportRowResult[] = parsed.rows.map((row, i) => {
    const rowNumber = i + 2; // header is row 1
    const errors: ImportRowError[] = [];

    const countryIso2 = (cell(row, "countryIso2") ?? "").trim().toUpperCase();
    if (countryIso2.length !== 2) errors.push({ column: "Country ISO2", message: "Must be a 2-letter country code." });

    const procedureCode = (cell(row, "procedureCode") ?? "").trim();
    if (procedureCode === "") errors.push({ column: "Procedure Code", message: "Required." });

    const listType = (cell(row, "listType") ?? "").trim();
    if (listType === "") errors.push({ column: "List Type", message: "Required." });

    const version = (cell(row, "version") ?? "").trim();
    if (version === "") errors.push({ column: "Version", message: "Required." });

    const effectiveFromParsed = parseDate(cell(row, "effectiveFrom"));
    if (effectiveFromParsed.error) errors.push({ column: "Effective From", message: effectiveFromParsed.error });
    else if (effectiveFromParsed.value === null) errors.push({ column: "Effective From", message: "Required." });

    const effectiveToParsed = parseDate(cell(row, "effectiveTo"));
    if (effectiveToParsed.error) errors.push({ column: "Effective To", message: effectiveToParsed.error });
    if (effectiveFromParsed.value && effectiveToParsed.value && effectiveToParsed.value <= effectiveFromParsed.value) {
      errors.push({ column: "Effective To", message: "Must be after Effective From." });
    }

    const headerIsActiveParsed = parseBoolean(cell(row, "headerIsActive"), true);
    if (headerIsActiveParsed.error) errors.push({ column: "Header Is Active", message: headerIsActiveParsed.error });

    const code = (cell(row, "code") ?? "").trim();
    if (code === "") errors.push({ column: "Code", message: "Required." });

    let attributes: Record<string, unknown> = {};
    const attributesRaw = trimToNull(cell(row, "attributes"));
    if (attributesRaw !== null) {
      try {
        const parsedJson = JSON.parse(attributesRaw);
        if (parsedJson === null || typeof parsedJson !== "object" || Array.isArray(parsedJson)) {
          errors.push({ column: "Attributes", message: "Must be a JSON object, e.g. {\"taxRate\":0.21}." });
        } else {
          attributes = parsedJson as Record<string, unknown>;
        }
      } catch {
        errors.push({ column: "Attributes", message: "Must be valid JSON." });
      }
    }

    const isDeprecatedParsed = parseBoolean(cell(row, "isDeprecated"), false);
    if (isDeprecatedParsed.error) errors.push({ column: "Is Deprecated", message: isDeprecatedParsed.error });

    const languageCode = (cell(row, "languageCode") ?? "").trim();
    if (languageCode === "") errors.push({ column: "Language Code", message: "Required." });

    const displayName = (cell(row, "displayName") ?? "").trim();
    if (displayName === "") errors.push({ column: "Display Name", message: "Required." });

    const description = trimToNull(cell(row, "description"));

    if (errors.length > 0) {
      return { rowNumber, status: "INVALID", data: null, errors };
    }

    return {
      rowNumber,
      status: "VALID",
      data: {
        countryIso2,
        procedureCode,
        listType,
        version,
        effectiveFrom: effectiveFromParsed.value as Date,
        effectiveTo: effectiveToParsed.value,
        headerIsActive: headerIsActiveParsed.value,
        code,
        attributes,
        isDeprecated: isDeprecatedParsed.value,
        languageCode,
        displayName,
        description,
      },
      errors: [],
    };
  });

  const validCount = rows.filter((r) => r.status === "VALID").length;
  return { mapping, rows, validCount, invalidCount: rows.length - validCount, fileErrors: [] };
}

export function parseOrThrow(content: string): ParsedCsv {
  return parseCsv(content);
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export function importTemplateCsv(): string {
  const headers = [
    "countryIso2",
    "procedureCode",
    "listType",
    "version",
    "effectiveFrom",
    "effectiveTo",
    "headerIsActive",
    "code",
    "attributes",
    "isDeprecated",
    "languageCode",
    "displayName",
    "description",
  ];
  const exampleRows = [
    ["NL", "4000", "PACKAGE_TYPES", "v2026.1", "2026-01-01", "", "true", "BX", "{}", "false", "en", "Box", "Standard box"],
    ["NL", "4000", "PACKAGE_TYPES", "v2026.1", "2026-01-01", "", "true", "BX", "{}", "false", "nl", "Doos", "Standaard doos"],
    // Demonstrates a JSON attributes value with a comma: it must be CSV-quoted
    // (the whole field wrapped in "..."), with its own inner double quotes
    // doubled ("") -- ordinary RFC 4180 CSV quoting, not JSON escaping.
    ["NL", "4000", "PACKAGE_TYPES", "v2026.1", "2026-01-01", "", "true", "PL", '{"weightKg":25,"stackable":true}', "false", "en", "Pallet", "Standard pallet"],
  ];
  /** RFC 4180: quote a field if it contains a comma, quote, or newline; double any inner quotes. */
  const csvField = (value: string): string =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = [headers.join(","), ...exampleRows.map((row) => row.map(csvField).join(","))];
  return lines.join("\n") + "\n";
}
