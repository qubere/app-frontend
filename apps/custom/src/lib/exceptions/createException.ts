import { db } from "@/lib/db";
import { deliverWebhookEvent } from "@/lib/webhooks/deliver";
import { Prisma } from "@prisma/client";
import type { ExceptionCategory, ExceptionType } from "./exceptionTaxonomy";

type ExceptionItemInput = Omit<Prisma.ExceptionItemUncheckedCreateInput, "category" | "type"> & {
  category?: ExceptionCategory | null;
  type: ExceptionType;
};

/**
 * Creates an ExceptionItem and automatically dispatches the `exception.created` webhook event.
 *
 * Idempotent by (shipmentId, filingId, documentId, type, description) among
 * still-open exceptions: callers that re-run the same check (autosave,
 * repeated pipeline passes, manual retries) must not pile up duplicate rows
 * for the same finding. If a matching open/in-progress exception already
 * exists, it's returned as-is instead of creating a new one -- no webhook
 * fires for a reused row, since nothing new actually happened.
 *
 * The findFirst below is only a fast path -- concurrent callers can both pass
 * it before either insert lands, so this alone doesn't make the function
 * idempotent under a race. Where a DB constraint actually backs the natural
 * key (e.g. the partial unique index on open DEADLINE_* exceptions from
 * migration 20260905130000), a race just means create() throws P2002, which
 * we catch here and resolve to the row the other caller just made instead of
 * failing the request.
 */
export async function createExceptionItem(data: ExceptionItemInput) {
  const uncheckedData = data as Prisma.ExceptionItemUncheckedCreateInput;
  const findExisting = () =>
    db.exceptionItem.findFirst({
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

  const existing = await findExisting();
  if (existing) return existing;

  let item;
  try {
    item = await db.exceptionItem.create({ data: data as Prisma.ExceptionItemUncheckedCreateInput });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await findExisting();
      if (winner) return winner;
    }
    throw err;
  }

  // Work Management: stamp the resolve SLA clock and auto-route to the client's
  // owner. Best-effort — never block exception creation on it.
  try {
    const { initializeExceptionWorkItem } = await import("@/modules/work/workItemLifecycle");
    await initializeExceptionWorkItem(item.id);
  } catch (err) {
    console.error("[createExceptionItem] work-item init failed:", err);
  }

  // Notify whoever the exception landed on (auto-routed above, or already set
  // by the caller) as soon as it exists -- previously the owner only heard
  // about it later, on manual reassignment or SLA breach.
  try {
    const routed = await db.exceptionItem.findUnique({
      where: { id: item.id },
      select: { assignedToUserId: true },
    });
    if (routed?.assignedToUserId) {
      const { notify } = await import("@/modules/notifications/notify");
      await notify({
        accountId: item.accountId,
        userId: routed.assignedToUserId,
        type: "EXCEPTION_CREATED",
        message: `New exception: "${item.description}"`,
        entityType: "ExceptionItem",
        entityId: item.id,
        dedupe: true,
      });
    }
  } catch (err) {
    console.error("[createExceptionItem] notification failed:", err);
  }

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
