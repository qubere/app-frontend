/**
 * Database-backed wrapper around the pure `evaluateReasonableCare` checklist:
 * loads a shipment's line items, documents, declared value and recordkeeping
 * trail, then runs the checklist. Kept out of `reasonableCare.ts` so that file
 * stays pure and DB-free for unit testing.
 */
import { db } from "@/lib/db";
import { evaluateReasonableCare, type ReasonableCareEvaluation } from "./reasonableCare";

export async function evaluateShipmentReasonableCare(
  accountId: string,
  shipmentId: string
): Promise<ReasonableCareEvaluation | null> {
  const shipment = await db.shipment.findFirst({
    where: { id: shipmentId, accountId },
    include: { lineItems: true, documents: true },
  });

  if (!shipment) return null;

  const auditLogCount = await db.auditLog.count({
    where: { accountId, entityId: shipmentId },
  });

  const totalValue = shipment.lineItems.reduce((sum, item) => sum + Number(item.totalValue), 0);

  return evaluateReasonableCare({
    lineItems: shipment.lineItems.map((l) => ({
      htsCode: l.htsCode,
      countryOfOrigin: l.countryOfOrigin,
    })),
    documents: shipment.documents.map((d) => ({ status: d.status })),
    totalValue: totalValue > 0 ? totalValue : null,
    auditLogCount,
  });
}
