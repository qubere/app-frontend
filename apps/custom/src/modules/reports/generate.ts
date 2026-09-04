import { db } from "@/lib/db";
import { storeGeneratedFile } from "@/lib/storage";
import { getCatalogEntry } from "./catalog";
import { REPORT_QUERIES } from "./queries";
import { generateCsv } from "./export/csv";
import { generateXlsx } from "./export/xlsx";
import { generateReportPdf } from "./export/pdf";
import { MAX_EXPORT_ROWS } from "./queryHelpers";
import { recordUsageEvent } from "@/lib/billing/telemetry";
import { logEvent } from "@/lib/logging/logger";

export class ReportGenerationError extends Error {
  constructor(
    public readonly code: "INVALID_REQUEST" | "QUERY_ERROR" | "GENERATION_ERROR" | "STORAGE_ERROR",
    message: string
  ) {
    super(message);
    this.name = "ReportGenerationError";
  }
}

function safeFileSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

/**
 * Executes a previously-created ReportRun end to end: query -> generate -> store -> mark COMPLETED/FAILED.
 * Intended to run inline within the request that created the run today; the run/artifact/status model is
 * shaped so this can be moved onto a durable worker (PipelineJob-style) without any API/schema change.
 */
export async function executeReportRun(runId: string): Promise<void> {
  const run = await db.reportRun.findUnique({ where: { id: runId } });
  if (!run) throw new ReportGenerationError("INVALID_REQUEST", "Report run not found.");

  const catalogEntry = getCatalogEntry(run.reportType);
  if (!catalogEntry) {
    await db.reportRun.update({
      where: { id: runId },
      data: { generationStatus: "FAILED", errorCode: "INVALID_REQUEST", errorMessage: "Unknown report type.", completedAt: new Date() },
    });
    return;
  }

  const queryFn = REPORT_QUERIES[run.reportType];
  if (!queryFn) {
    await db.reportRun.update({
      where: { id: runId },
      data: { generationStatus: "FAILED", errorCode: "INVALID_REQUEST", errorMessage: "Report type has no query service.", completedAt: new Date() },
    });
    return;
  }

  await db.reportRun.update({ where: { id: runId }, data: { generationStatus: "RUNNING", startedAt: new Date() } });

  const filters = (run.filterSnapshot as Record<string, unknown>) ?? {};

  try {
    const { rows, totalCount } = await queryFn(run.accountId, filters, MAX_EXPORT_ROWS);

    let body: Buffer;
    let mimeType: string;
    let extension: string;

    const criteria = catalogEntry.filters
      .filter((f) => filters[f.key] !== undefined && filters[f.key] !== "")
      .map((f) => ({ label: f.label, value: String(filters[f.key]) }));

    if (run.format === "XLSX") {
      body = await generateXlsx({
        reportName: catalogEntry.name,
        columns: catalogEntry.columns,
        rows,
        criteria,
        generatedBy: run.requestedByUserId,
        generatedAt: new Date(),
      });
      mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      extension = "xlsx";
    } else if (run.format === "CSV") {
      body = generateCsv(catalogEntry.columns, rows);
      mimeType = "text/csv";
      extension = "csv";
    } else if (run.format === "PDF") {
      if (!catalogEntry.formats.includes("PDF")) {
        throw new ReportGenerationError("INVALID_REQUEST", "PDF is not available for this report.");
      }
      body = generateReportPdf({
        reportName: catalogEntry.name,
        columns: catalogEntry.columns,
        rows,
        totalCount,
        criteria,
        generatedBy: run.requestedByUserId,
        generatedAt: new Date(),
      });
      mimeType = "application/pdf";
      extension = "pdf";
    } else {
      throw new ReportGenerationError("GENERATION_ERROR", `Format "${run.format}" is not supported.`);
    }

    const fileName = `${safeFileSegment(catalogEntry.id)}-${runId}.${extension}`;
    const objectPath = `compliance-reports/${safeFileSegment(run.accountId)}/${fileName}`;

    let stored;
    try {
      stored = await storeGeneratedFile({ objectPath, filename: fileName, contentType: mimeType, body });
    } catch (err) {
      throw new ReportGenerationError("STORAGE_ERROR", err instanceof Error ? err.message : "Failed to store report artifact.");
    }

    await db.$transaction([
      db.reportArtifact.create({
        data: {
          accountId: run.accountId,
          reportRunId: run.id,
          fileName,
          mimeType,
          format: run.format,
          storageKey: stored.url,
          sizeBytes: BigInt(body.byteLength),
          sha256: stored.checksum,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
      db.reportRun.update({
        where: { id: runId },
        data: {
          generationStatus: "COMPLETED",
          completedAt: new Date(),
          rowCount: totalCount,
        },
      }),
    ]);

    try {
      await recordUsageEvent({
        accountId: run.accountId,
        eventCode: "COMPLIANCE_REPORT_GENERATED",
        quantity: 1,
        unit: "report",
        sourceFunction: "executeReportRun",
        sourceAgent: "Compliance Reporting",
        automated: true,
        success: true,
        idempotencyKey: `billing:compliance-report:${runId}`,
        metadata: { reportType: run.reportType, format: run.format, rowCount: totalCount },
      });
    } catch (billingError) {
      console.error("Failed to record compliance report billing usage", billingError);
    }

    logEvent({
      action: "COMPLIANCE_REPORT_GENERATED",
      message: `Compliance report ${catalogEntry.id} (run ${runId}) generated successfully.`,
      accountId: run.accountId,
      userId: run.requestedByUserId,
      resourceType: "ReportRun",
      resourceId: runId,
      metadata: { reportType: run.reportType, format: run.format, rowCount: totalCount },
    });
  } catch (err) {
    const code = err instanceof ReportGenerationError ? err.code : "QUERY_ERROR";
    const errorMessage = err instanceof Error ? err.message : "Unknown error generating report.";
    await db.reportRun.update({
      where: { id: runId },
      data: {
        generationStatus: "FAILED",
        errorCode: code,
        errorMessage,
        completedAt: new Date(),
      },
    });

    logEvent({
      action: "COMPLIANCE_REPORT_GENERATION_FAILED",
      message: `Compliance report ${catalogEntry.id} (run ${runId}) failed to generate: ${errorMessage}`,
      accountId: run.accountId,
      userId: run.requestedByUserId,
      resourceType: "ReportRun",
      resourceId: runId,
      metadata: { reportType: run.reportType, format: run.format, errorCode: code },
    });
  }
}
