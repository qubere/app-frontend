// Bulk Compliance Screening -- retention/expiry sweep. Terminal batches
// (COMPLETED/FAILED/CANCELLED) past the retention window are marked EXPIRED;
// this only flips a status flag (drives UI/reporting) and never deletes
// records/artifacts -- storage-level deletion is a separate, deliberately
// unimplemented concern (see gap notes).
import { db, runWithAccountId } from "@/lib/db";
import { createAuditLog, AuditAction } from "@/lib/audit";

export const BATCH_RETENTION_DAYS = 90;

const SWEEP_BATCH_SIZE = 200;
const TERMINAL_NOT_YET_EXPIRED = ["COMPLETED", "FAILED", "CANCELLED"] as const;

export interface BatchRetentionSweepResult {
  scanned: number;
  expired: number;
}

/** Marks terminal batches older than BATCH_RETENTION_DAYS (by completedAt, falling back to createdAt) as EXPIRED. */
export async function sweepExpiredBatches(): Promise<BatchRetentionSweepResult> {
  const cutoff = new Date(Date.now() - BATCH_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await db.complianceBatch.findMany({
    where: {
      processingStatus: { in: [...TERMINAL_NOT_YET_EXPIRED] },
      OR: [
        { completedAt: { lt: cutoff } },
        { completedAt: null, createdAt: { lt: cutoff } },
      ],
    },
    take: SWEEP_BATCH_SIZE,
    select: { id: true, accountId: true },
  });

  let expired = 0;
  for (const batch of candidates) {
    await runWithAccountId(batch.accountId, async () => {
      const claim = await db.complianceBatch.updateMany({
        where: { id: batch.id, processingStatus: { in: [...TERMINAL_NOT_YET_EXPIRED] } },
        data: { processingStatus: "EXPIRED" },
      });
      if (claim.count !== 1) return;

      expired += 1;
      await createAuditLog({
        accountId: batch.accountId,
        action: AuditAction.COMPLIANCE_BATCH_EXPIRED,
        entity: "ComplianceBatch",
        entityId: batch.id,
        source: "SYSTEM",
        metadata: { retentionDays: BATCH_RETENTION_DAYS },
      });
    });
  }

  return { scanned: candidates.length, expired };
}
