// Bulk Compliance Screening -- output artifact generation. INPUT artifacts
// are captured at upload time in service.ts; this module generates the
// derived VALIDATION_ERRORS (parse-time), and RESULTS/PROCESSING_SUMMARY
// (finalize-time) artifacts so the existing artifact-download endpoint has
// something to serve beyond the original upload.
import { db } from "@/lib/db";
import { storeGeneratedFile } from "@/lib/storage";
import type { BatchRowValidationError } from "./types";
import type { BatchRecord, ComplianceBatch } from "@prisma/client";

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

/** Persists a VALIDATION_ERRORS CSV artifact for rows rejected at parse time. Best-effort: never blocks batch creation. */
export async function generateValidationErrorsArtifact(
  accountId: string,
  batchId: string,
  invalidRows: BatchRowValidationError[]
): Promise<void> {
  if (invalidRows.length === 0) return;

  try {
    const csv = toCsv(
      ["rowNumber", "errors"],
      invalidRows.map((row) => [row.rowNumber, row.errors.join("; ")])
    );
    const body = Buffer.from(csv, "utf-8");
    const stored = await storeGeneratedFile({
      objectPath: `compliance-batches/${accountId}/${batchId}/validation-errors.csv`,
      filename: "validation-errors.csv",
      contentType: "text/csv",
      body,
    });

    await db.batchArtifact.create({
      data: {
        accountId,
        batchId,
        artifactType: "VALIDATION_ERRORS",
        storageKey: stored.url,
        originalFileName: "validation-errors.csv",
        mimeType: "text/csv",
        sizeBytes: body.byteLength,
        sha256: stored.checksum,
      },
    });
  } catch {
    // Best-effort -- a failed export artifact must never block the upload itself.
  }
}

/** Persists RESULTS (per-record CSV) and PROCESSING_SUMMARY (JSON) artifacts once a batch reaches a terminal state. */
export async function generateCompletionArtifacts(batch: ComplianceBatch, records: BatchRecord[]): Promise<void> {
  try {
    const resultsCsv = toCsv(
      [
        "recordNumber",
        "transactionId",
        "processingStatus",
        "complianceStatus",
        "rpsResultId",
        "licenseDeterminationResultId",
        "embargoStatus",
        "classificationStatus",
        "classificationHtsCode",
        "rpsComplianceExecutionId",
        "licenseComplianceExecutionId",
        "embargoComplianceExecutionId",
        "classificationComplianceExecutionId",
        "errorCode",
        "errorMessage",
      ],
      records.map((r) => [
        r.recordNumber,
        r.transactionId,
        r.processingStatus,
        r.complianceStatus,
        r.rpsResultId,
        r.licenseDeterminationResultId,
        r.embargoStatus,
        r.classificationStatus,
        r.classificationHtsCode,
        r.rpsComplianceExecutionId,
        r.licenseComplianceExecutionId,
        r.embargoComplianceExecutionId,
        r.classificationComplianceExecutionId,
        r.errorCode,
        r.errorMessage,
      ])
    );
    const resultsBody = Buffer.from(resultsCsv, "utf-8");
    const storedResults = await storeGeneratedFile({
      objectPath: `compliance-batches/${batch.accountId}/${batch.id}/results.csv`,
      filename: "results.csv",
      contentType: "text/csv",
      body: resultsBody,
    });

    const summary = {
      batchId: batch.id,
      batchType: batch.batchType,
      processingStatus: batch.processingStatus,
      complianceStatus: batch.complianceStatus,
      totalRecords: batch.totalRecords,
      validRecords: batch.validRecords,
      processedRecords: batch.processedRecords,
      passedRecords: batch.passedRecords,
      failedRecords: batch.failedRecords,
      reviewRecords: batch.reviewRecords,
      incompleteRecords: batch.incompleteRecords,
      errorRecords: batch.errorRecords,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
    };
    const summaryBody = Buffer.from(JSON.stringify(summary, null, 2), "utf-8");
    const storedSummary = await storeGeneratedFile({
      objectPath: `compliance-batches/${batch.accountId}/${batch.id}/processing-summary.json`,
      filename: "processing-summary.json",
      contentType: "application/json",
      body: summaryBody,
    });

    await db.batchArtifact.createMany({
      data: [
        {
          accountId: batch.accountId,
          batchId: batch.id,
          artifactType: "RESULTS",
          storageKey: storedResults.url,
          originalFileName: "results.csv",
          mimeType: "text/csv",
          sizeBytes: resultsBody.byteLength,
          sha256: storedResults.checksum,
        },
        {
          accountId: batch.accountId,
          batchId: batch.id,
          artifactType: "PROCESSING_SUMMARY",
          storageKey: storedSummary.url,
          originalFileName: "processing-summary.json",
          mimeType: "application/json",
          sizeBytes: summaryBody.byteLength,
          sha256: storedSummary.checksum,
        },
      ],
    });
  } catch {
    // Best-effort -- a failed export artifact must never block finalization itself.
  }
}
