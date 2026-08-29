// Bulk Compliance Screening -- JSON parser for TRANSACTION_COMPLIANCE batches.
// Accepts a top-level array of row objects, or `{ "records": [...] }`. Each
// object's own keys are resolved through the same column-alias table as
// CSV/XLSX (mapTransactionColumns), so a row's keys can use any accepted
// header spelling (e.g. "partyName" or "party name"). A structurally invalid
// document (not JSON, not an array/records wrapper) fails the whole batch --
// only a per-row shape problem is rejected on its own (prompt section 22).
import { mapTransactionColumns, rowToCanonicalRequest, type ColumnMappingTemplateFields } from "./columns";
import type { ComplianceBatchServiceFlags, ParsedBatchInput } from "./types";

export class ComplianceBatchJsonStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplianceBatchJsonStructureError";
  }
}

function extractRows(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)) {
    return (parsed as { records: unknown[] }).records;
  }
  throw new ComplianceBatchJsonStructureError(
    'The JSON file must be a top-level array of records, or an object with a "records" array.'
  );
}

export function parseTransactionComplianceJson(
  text: string,
  serviceFlags: ComplianceBatchServiceFlags,
  templateFields?: ColumnMappingTemplateFields
): ParsedBatchInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ComplianceBatchJsonStructureError("The file is not valid JSON.");
  }

  const rawRows = extractRows(parsed);

  const records: ParsedBatchInput["records"] = [];
  const sourceRowNumbers: number[] = [];
  const invalidRows: ParsedBatchInput["invalidRows"] = [];

  rawRows.forEach((raw, i) => {
    const rowNumber = i + 1;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      invalidRows.push({ rowNumber, errors: ["Each record must be a JSON object."] });
      return;
    }

    const entries = Object.entries(raw as Record<string, unknown>);
    const headers = entries.map(([key]) => key);
    const row = entries.map(([, value]) => (value === null || value === undefined ? "" : String(value)));
    const mapping = mapTransactionColumns(headers, templateFields);

    const { request, errors } = rowToCanonicalRequest(mapping, row, rowNumber, serviceFlags);
    if (request) {
      records.push(request);
      sourceRowNumbers.push(rowNumber);
    } else {
      invalidRows.push({ rowNumber, errors });
    }
  });

  return { records, sourceRowNumbers, invalidRows };
}
