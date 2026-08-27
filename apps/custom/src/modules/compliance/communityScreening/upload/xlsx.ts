// Mirrors parseXlsxFile from billing/rate-cards/import/actions.ts: first
// worksheet, cell-value normalization (dates, formula results, rich text).
import ExcelJS from "exceljs";
import { mapCommunityScreeningColumns, rowToPartyInput } from "./columns";
import type { CommunityScreeningPartyInput } from "../types";

function cellToString(cell: ExcelJS.CellValue): string {
  if (cell == null) return "";
  if (cell instanceof Date) return cell.toISOString().split("T")[0];
  if (typeof cell === "object" && "result" in cell) return String((cell as { result: unknown }).result ?? "");
  if (typeof cell === "object" && "richText" in cell) {
    return (cell as { richText: Array<{ text: string }> }).richText.map((r) => r.text).join("");
  }
  return String(cell);
}

export async function parseCommunityScreeningXlsx(buffer: Buffer): Promise<CommunityScreeningPartyInput[]> {
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
  if (!headers) return [];

  const mapping = mapCommunityScreeningColumns(headers);
  return rows.map((row) => rowToPartyInput(mapping, row));
}
