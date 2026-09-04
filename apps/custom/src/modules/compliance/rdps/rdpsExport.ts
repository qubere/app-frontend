// Continuous Party Monitoring (RDPS) -- CSV export of a run's tenant-scoped
// outcomes. Read-only: never mutates outcome/run rows.
import { listOutcomesForRun, listAlerts, getReportsSummary } from "./rdpsQueryService";

const EXPORT_COLUMNS = [
  "Party ID",
  "Party Name",
  "Previous Status",
  "New Status",
  "Worsening",
  "Had Active Pre-Approval",
  "Candidate Reasons",
  "Error",
  "Created At",
] as const;

function escapeCsvValue(value: unknown): string {
  const val = String(value ?? "");
  return val.includes(",") || val.includes('"') || val.includes("\n") ? `"${val.replace(/"/g, '""')}"` : val;
}

function buildCsv(rows: (string | number)[][]): string {
  const lines = [EXPORT_COLUMNS.join(","), ...rows.map((row) => row.map(escapeCsvValue).join(","))];
  return lines.join("\r\n");
}

export interface RdpsExportResult {
  fileName: string;
  contentType: string;
  body: string;
}

export async function buildRdpsRunExport(accountId: string, runId: string): Promise<RdpsExportResult> {
  const { outcomes } = await listOutcomesForRun(accountId, runId, { pageSize: 100000 });

  const rows = outcomes.map((o) => [
    o.partyId,
    o.partyDisplayName,
    o.previousStatus ?? "",
    o.newStatus,
    o.isWorsening ? "YES" : "NO",
    o.hadActivePreApproval ? "YES" : "NO",
    o.candidateReasons.join("; "),
    o.errorMessage ?? "",
    o.createdAt.toISOString(),
  ]);

  return {
    fileName: `rdps-run-${runId}.csv`,
    contentType: "text/csv; charset=utf-8",
    body: buildCsv(rows),
  };
}

const REPORT_COLUMNS = [
  "Party ID",
  "Party Name",
  "Previous Status",
  "New Status",
  "Disposition Status",
  "Run Type",
  "Detected At",
] as const;

function buildReportCsv(rows: (string | number)[][]): string {
  const lines = [REPORT_COLUMNS.join(","), ...rows.map((row) => row.map(escapeCsvValue).join(","))];
  return lines.join("\r\n");
}

/**
 * Reports export: the tenant's current summary stats followed by the full
 * list of open (undispositioned) worsening alerts as of the export moment.
 */
export async function buildRdpsReportsExport(accountId: string): Promise<RdpsExportResult> {
  const [summary, { alerts }] = await Promise.all([
    getReportsSummary(accountId),
    listAlerts(accountId, { dispositioned: false, pageSize: 100000 }),
  ]);

  const summaryLines = [
    ["Metric", "Value"],
    ["Total Monitored Parties", summary.totalMonitoredParties],
    ["Open Alerts", summary.openAlerts],
    ["Worsening (Last 30 Days)", summary.worseningLast30Days],
    ["Screened (Last 30 Days)", summary.screenedLast30Days],
  ]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");

  const alertRows = alerts.map((a) => [
    a.partyId,
    a.partyDisplayName,
    a.previousStatus ?? "",
    a.newStatus,
    a.exceptionItem?.status ?? "",
    a.run?.runType ?? "",
    a.createdAt.toISOString(),
  ]);

  const body = [summaryLines, "", buildReportCsv(alertRows)].join("\r\n");

  return {
    fileName: `rdps-reports-${accountId}.csv`,
    contentType: "text/csv; charset=utf-8",
    body,
  };
}
