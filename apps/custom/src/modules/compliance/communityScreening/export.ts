// Community Screening -- export module. Builds a CSV/XLSX export of a run's
// party results for download. Read-only: never mutates run/result rows.
import ExcelJS from "exceljs";
import { CommunityScreeningService } from "./service";

const EXPORT_COLUMNS = [
  "Row #",
  "Party Name",
  "Country",
  "External Reference",
  "Restricted Party Status",
  "Restricted Party Finding Category",
  "Red Flag",
  "Embargo Status",
  "Overall Status",
  "Failure Reason",
  "Evaluated At",
] as const;

function buildExportRows(results: Array<{
  rowNumber: number;
  snapshotName: string;
  snapshotCountry: string | null;
  externalReference: string | null;
  restrictedPartyStatus: string | null;
  restrictedPartyFindingCategory: string | null;
  restrictedPartyRedFlagFound: boolean | null;
  embargoStatus: string | null;
  aggregateStatus: string;
  failureReason: string | null;
  evaluatedAt: Date | null;
}>) {
  return results.map((r) => [
    r.rowNumber,
    r.snapshotName,
    r.snapshotCountry ?? "",
    r.externalReference ?? "",
    r.restrictedPartyStatus ?? "",
    r.restrictedPartyFindingCategory ?? "",
    r.restrictedPartyRedFlagFound === null ? "" : r.restrictedPartyRedFlagFound ? "YES" : "NO",
    r.embargoStatus ?? "",
    r.aggregateStatus,
    r.failureReason ?? "",
    r.evaluatedAt ? new Date(r.evaluatedAt).toISOString() : "",
  ]);
}

function escapeCsvValue(value: unknown): string {
  const val = String(value ?? "");
  return val.includes(",") || val.includes('"') || val.includes("\n") ? `"${val.replace(/"/g, '""')}"` : val;
}

function buildCsv(rows: (string | number)[][]): string {
  const lines = [
    EXPORT_COLUMNS.join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ];
  return lines.join("\r\n");
}

async function buildXlsx(runId: string, rows: (string | number)[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(runId);

  const headerRow = sheet.addRow(EXPORT_COLUMNS as unknown as string[]);
  headerRow.font = { bold: true };

  for (const row of rows) {
    sheet.addRow(row);
  }

  return workbook.xlsx.writeBuffer();
}

export interface CommunityScreeningExportResult {
  fileName: string;
  contentType: string;
  body: string | ArrayBuffer;
}

export async function buildCommunityScreeningExport(
  accountId: string,
  runId: string,
  format: "csv" | "xlsx"
): Promise<CommunityScreeningExportResult | null> {
  const data = await CommunityScreeningService.getRunResults(accountId, runId, { pageSize: 100000 });
  if (!data) return null;

  const rows = buildExportRows(data.results);

  if (format === "csv") {
    return {
      fileName: `community-screening-${runId}.csv`,
      contentType: "text/csv; charset=utf-8",
      body: buildCsv(rows),
    };
  }

  const buffer = await buildXlsx(runId, rows);
  return {
    fileName: `community-screening-${runId}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    body: buffer,
  };
}
