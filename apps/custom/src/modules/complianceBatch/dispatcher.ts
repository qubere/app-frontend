// Async processing for Bulk Compliance Screening batches. Mirrors
// CommunityScreeningDispatcher's optimistic per-row claim -- no long-lived
// reclaim/lease semantics needed since a claimed record either finishes
// (terminal processingStatus) or the whole dispatch tick is retried on the
// next cron invocation.
import { db } from "@/lib/db";
import { processBatchRecord } from "./processing";
import { aggregateBatchComplianceStatus } from "./aggregation";
import { generateCompletionArtifacts } from "./artifacts";

const BATCH_DISPATCH_SIZE = 200;

export interface ComplianceBatchDispatchResult {
  claimedCount: number;
  errorCount: number;
}

export class ComplianceBatchDispatcher {
  static async dispatchPending(): Promise<ComplianceBatchDispatchResult> {
    // Move any READY batch into PROCESSING so its records become eligible.
    await db.complianceBatch.updateMany({
      where: { processingStatus: "READY" },
      data: { processingStatus: "PROCESSING", startedAt: new Date() },
    });

    const candidates = await db.batchRecord.findMany({
      where: { processingStatus: "PENDING", batch: { processingStatus: "PROCESSING" } },
      take: BATCH_DISPATCH_SIZE,
    });

    let claimedCount = 0;
    let errorCount = 0;
    const touchedBatchIds = new Set<string>();

    for (const record of candidates) {
      const claim = await db.batchRecord.updateMany({
        where: { id: record.id, processingStatus: "PENDING" },
        data: { processingStatus: "PROCESSING", startedAt: new Date() },
      });
      if (claim.count !== 1) continue;

      claimedCount += 1;
      touchedBatchIds.add(record.batchId);

      try {
        await processBatchRecord(record.accountId, record);
      } catch (err) {
        errorCount += 1;
        await db.batchRecord.update({
          where: { id: record.id },
          data: {
            processingStatus: "ERROR",
            complianceStatus: "ERROR",
            errorCode: "PROCESSING_ERROR",
            errorMessage: err instanceof Error ? err.message : String(err),
            completedAt: new Date(),
          },
        });
      }
    }

    for (const batchId of touchedBatchIds) {
      await ComplianceBatchDispatcher.finalizeBatchIfComplete(batchId);
    }

    return { claimedCount, errorCount };
  }

  /** Recomputes a batch's counters/status from its records. Marks it terminal only once no record is left PENDING/PROCESSING. */
  static async finalizeBatchIfComplete(batchId: string): Promise<void> {
    const records = await db.batchRecord.findMany({ where: { batchId } });

    const stillWorking = records.some((r) => r.processingStatus === "PENDING" || r.processingStatus === "PROCESSING");
    if (stillWorking) return;

    const complianceStatuses = records.map((r) => r.complianceStatus);
    const counters = {
      processedRecords: records.filter((r) => r.processingStatus === "COMPLETED").length,
      passedRecords: complianceStatuses.filter((s) => s === "PASSED").length,
      failedRecords: complianceStatuses.filter((s) => s === "FAILED").length,
      reviewRecords: complianceStatuses.filter((s) => s === "REVIEW_REQUIRED").length,
      incompleteRecords: complianceStatuses.filter((s) => s === "INCOMPLETE").length,
      errorRecords:
        records.filter((r) => r.processingStatus === "ERROR").length +
        complianceStatuses.filter((s) => s === "ERROR").length,
    };

    const batch = await db.complianceBatch.update({
      where: { id: batchId },
      data: {
        processingStatus: "COMPLETED",
        complianceStatus: aggregateBatchComplianceStatus(complianceStatuses),
        completedAt: new Date(),
        ...counters,
      },
    });

    await generateCompletionArtifacts(batch, records);
  }
}
