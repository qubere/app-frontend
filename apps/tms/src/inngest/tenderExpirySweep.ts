import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";

export async function runTenderExpirySweep(): Promise<{ expiredCount: number }> {
  const now = new Date();

  const expiredTenders = await db.tender.findMany({
    where: {
      status: "SENT",
      expiresAt: { lt: now },
    },
  });

  let expiredCount = 0;

  for (const tender of expiredTenders) {
    const existingHistory = Array.isArray(tender.history) ? tender.history : [];
    const updatedHistory = [
      ...existingHistory,
      {
        status: "EXPIRED",
        timestamp: now.toISOString(),
        note: "Auto-expired by Inngest scheduled sweep",
      },
    ];

    await db.tender.update({
      where: { id: tender.id },
      data: {
        status: "EXPIRED",
        history: updatedHistory as any,
      },
    });

    await createAuditLog({
      accountId: tender.accountId,
      action: "TENDER_EXPIRED",
      entity: "Tender",
      entityId: tender.id,
      source: "SYSTEM",
      metadata: {
        expiredAt: now.toISOString(),
      },
    });

    expiredCount++;
  }

  return { expiredCount };
}
