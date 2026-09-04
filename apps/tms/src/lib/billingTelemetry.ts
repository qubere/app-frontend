import { db } from "@qubere/db";
import { recordUsageEvent } from "@qubere/billing/telemetry";

type TmsBillingEventCode =
  | "TMS_TENDER_DISPATCHED"
  | "TMS_POD_CONFIRMED"
  | "TMS_LOAD_DELIVERED"
  | "TMS_FREIGHT_AUDIT_APPROVED";

/** Emits TMS work into the shared customer AR ledger. Carrier invoices remain
 * in the TMS AP sub-ledger and are never converted into customer invoices. */
export async function emitTmsBillingEvent(input: {
  accountId: string;
  shipmentId: string;
  eventCode: TmsBillingEventCode;
  idempotencyKey: string;
  sourceFunction: string;
  sourceAgent?: string;
  success?: boolean;
  metadata?: Record<string, unknown>;
}) {
  const shipment = await db.shipment.findFirst({
    where: { id: input.shipmentId, accountId: input.accountId, deletedAt: null },
    select: { clientId: true, importerOfRecordId: true },
  });
  if (!shipment) throw new Error("TMS billing shipment not found in this account");

  return recordUsageEvent({
    accountId: input.accountId,
    shipmentId: input.shipmentId,
    clientId: shipment.clientId ?? undefined,
    importerId: shipment.importerOfRecordId ?? undefined,
    eventCode: input.eventCode,
    productLine: "TMS",
    idempotencyKey: input.idempotencyKey,
    sourceFunction: input.sourceFunction,
    sourceAgent: input.sourceAgent,
    success: input.success ?? true,
    automated: true,
    metadata: input.metadata,
  });
}
