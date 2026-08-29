import { parseCsv } from "@/modules/party/partyCsv";
import { mapTransactionColumns, rowToCanonicalRequest, type ColumnMappingTemplateFields } from "./columns";
import type { ComplianceBatchServiceFlags, ParsedBatchInput } from "./types";

/** Parses a TRANSACTION_COMPLIANCE CSV. A structurally bad row is rejected on its own (CONTINUE_VALID_RECORDS, prompt section 22) -- one bad row never fails the whole file. */
export function parseTransactionComplianceCsv(
  text: string,
  serviceFlags: ComplianceBatchServiceFlags,
  templateFields?: ColumnMappingTemplateFields
): ParsedBatchInput {
  const parsed = parseCsv(text);
  const mapping = mapTransactionColumns(parsed.headers, templateFields);

  const records: ParsedBatchInput["records"] = [];
  const sourceRowNumbers: number[] = [];
  const invalidRows: ParsedBatchInput["invalidRows"] = [];

  parsed.rows.forEach((row, i) => {
    const rowNumber = i + 1;
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
