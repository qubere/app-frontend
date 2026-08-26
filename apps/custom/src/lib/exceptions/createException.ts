import { db } from "@/lib/db";
import { deliverWebhookEvent } from "@/lib/webhooks/deliver";
import type { Prisma } from "@prisma/client";

/**
 * Creates an ExceptionItem and automatically dispatches the `exception.created` webhook event.
 *
 * Idempotent by (shipmentId, filingId, documentId, type, description) among
 * still-open exceptions: callers that re-run the same check (autosave,
 * repeated pipeline passes, manual retries) must not pile up duplicate rows
 * for the same finding. If a matching open/in-progress exception already
 * exists, it's returned as-is instead of creating a new one -- no webhook
 * fires for a reused row, since nothing new actually happened.
 */
export async function createExceptionItem(
  data: Prisma.ExceptionItemUncheckedCreateInput | Prisma.ExceptionItemCreateInput
) {
  const uncheckedData = data as Prisma.ExceptionItemUncheckedCreateInput;
  const existing = await db.exceptionItem.findFirst({
    where: {
      accountId: uncheckedData.accountId,
      shipmentId: uncheckedData.shipmentId ?? null,
      filingId: uncheckedData.filingId ?? null,
      documentId: uncheckedData.documentId ?? null,
      type: uncheckedData.type,
      description: uncheckedData.description,
      status: { in: ["Open", "InProgress"] },
    },
  });
  if (existing) return existing;

  const item = await db.exceptionItem.create({ data });
  deliverWebhookEvent(item.accountId, "exception.created", {
    exceptionId: item.id,
    shipmentId: item.shipmentId ?? null,
    filingId: item.filingId ?? null,
    documentId: item.documentId ?? null,
    category: item.category,
    type: item.type,
    severity: item.severity,
    code: item.code ?? null,
    description: item.description,
  }).catch((err) => console.error("[webhook] Failed to dispatch exception.created:", err));
  return item;
}
