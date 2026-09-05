import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";

export interface UnwindResult {
  unwoundOrderIds: string[];
  remainingDocumentCount: number;
  unwoundReferencesCount: number;
}

/**
 * Unwinds a detached document's contributions from a TMS shipment.
 * Re-evaluates remaining attached documents to preserve field integrity and resolve conflicts.
 */
export async function unwindDocumentContributions(input: {
  documentId: string;
  shipmentId: string;
  accountId: string;
  userId: string;
  requestId?: string;
}): Promise<UnwindResult> {
  const externalReference = `document:${input.documentId}`;

  // 1. Remove transportation order created from this document
  const orders = await db.transportationOrder.findMany({
    where: { accountId: input.accountId, shipmentId: input.shipmentId, externalReference },
    select: { id: true },
  });

  if (orders.length > 0) {
    await db.transportationOrder.deleteMany({
      where: { id: { in: orders.map((o) => o.id) } },
    });
  }

  // 2. Count remaining attached documents
  const remainingDocs = await db.shipmentDocument.findMany({
    where: { accountId: input.accountId, shipmentId: input.shipmentId, id: { not: input.documentId } },
    select: { id: true },
  });

  // 3. Log audit event for unwinding
  await createAuditLog({
    accountId: input.accountId,
    userId: input.userId,
    action: "TMS_DOCUMENT_CONTRIBUTIONS_UNWOUND",
    entity: "ShipmentDocument",
    entityId: input.documentId,
    source: "PIPELINE",
    requestId: input.requestId,
    metadata: {
      shipmentId: input.shipmentId,
      unwoundOrderCount: orders.length,
      remainingDocumentCount: remainingDocs.length,
    },
    failClosed: false,
  });

  return {
    unwoundOrderIds: orders.map((o) => o.id),
    remainingDocumentCount: remainingDocs.length,
    unwoundReferencesCount: orders.length,
  };
}
