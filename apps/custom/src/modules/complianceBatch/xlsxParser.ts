// Bulk Compliance Screening -- XLSX parser for TRANSACTION_COMPLIANCE batches.
// Mirrors communityScreening/upload/xlsx.ts's cell-normalization approach and
// csvParser.ts's row-level fail-alone semantics: only the first worksheet is
// read, and a structurally bad row is rejected on its own rather than failing
// the whole file.
import ExcelJS from "exceljs";
import { mapTransactionColumns, rowToCanonicalRequest, type ColumnMappingTemplateFields } from "./columns";
import type { ComplianceBatchServiceFlags, ParsedBatchInput } from "./types";

function cellToString(cell: ExcelJS.CellValue): string {
  if (cell == null) return "";
  if (cell instanceof Date) return cell.toISOString().split("T")[0];
  if (typeof cell === "object" && "result" in cell) return String((cell as { result: unknown }).result ?? "");
  if (typeof cell === "object" && "richText" in cell) {
    return (cell as { richText: Array<{ text: string }> }).richText.map((r) => r.text).join("");
  }
  return String(cell);
}

export async function parseTransactionComplianceXlsx(
  buffer: Buffer,
  serviceFlags: ComplianceBatchServiceFlags,
  templateFields?: ColumnMappingTemplateFields
): Promise<ParsedBatchInput> {
  const workbook = new ExcelJS.Workbook();
  // @ts-expect-error @types/node v20 adds a generic to Buffer that predates exceljs types
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The uploaded spreadsheet contains no worksheets");

  const allRows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells = (row.values as Array<ExcelJS.CellValue>).slice(1);
    allRows.push(cells.map(cellToString));
  });

  const [headers, ...rows] = allRows;
  if (!headers) return { records: [], sourceRowNumbers: [], invalidRows: [] };

  const mapping = mapTransactionColumns(headers, templateFields);

  const records: ParsedBatchInput["records"] = [];
  const sourceRowNumbers: number[] = [];
  const invalidRows: ParsedBatchInput["invalidRows"] = [];

  rows.forEach((row, i) => {
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
