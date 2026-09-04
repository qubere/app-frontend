import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import { performFreightAudit } from "./services/freightAuditService";

export interface ReconcileCarrierInvoiceInput {
  accountId: string;
  carrierInvoiceId: string;
  /** @deprecated Tolerance is configured by the authoritative audit service. */
  tolerancePercentage?: number;
}

/**
 * Compatibility entry point for callers that predate FreightAuditAgent.
 * All matching math is delegated to the single authoritative audit engine so
 * route and agent calls cannot disagree about tolerances or evidence.
 */
export async function reconcileCarrierInvoice(input: ReconcileCarrierInvoiceInput) {
  const ctx = { accountId: input.accountId };
  const result = await performFreightAudit(ctx, input.carrierInvoiceId);
  const isMatch =
    result.auditStatus === "MATCHED" || result.auditStatus === "WITHIN_TOLERANCE";
  const matchStatus = isMatch
    ? "MATCHED"
    : result.auditStatus === "VARIANCE_FLAGGED"
      ? "DISPUTED"
      : "EXCEPTION";

  const invoice = await db.carrierInvoice.update({
    where: { id: input.carrierInvoiceId },
    data: { matchStatus },
  });

  let exception: { id: string } | null = null;
  if (!isMatch) {
    const code = `INVOICE_AUDIT:${input.carrierInvoiceId}`;
    exception = await db.exceptionItem.findFirst({
      where: {
        accountId: input.accountId,
        code,
        status: { in: ["Open", "OPEN", "InProgress", "IN_PROGRESS"] },
      },
      select: { id: true },
    });

    if (!exception) {
      exception = await db.exceptionItem.create({
        data: {
          accountId: input.accountId,
          shipmentId: result.shipmentId,
          code,
          category: "BILLING",
          type: "INVOICE_AUDIT_EXCEPTION",
          severity: "High",
          description: result.notes,
          status: "Open",
        },
        select: { id: true },
      });
    }
  }

  await createAuditLog({
    accountId: input.accountId,
    action: isMatch ? "CARRIER_INVOICE_MATCHED" : "CARRIER_INVOICE_DISPUTED",
    entity: "CarrierInvoice",
    entityId: input.carrierInvoiceId,
    source: "SYSTEM",
    metadata: {
      auditStatus: result.auditStatus,
      expectedAmount: result.agreedBuyRateUsd,
      invoicedAmount: result.carrierInvoicedUsd,
      variance: result.varianceUsd,
      exceptionId: exception?.id ?? null,
    },
  });

  return { matchStatus, invoice, exception, audit: result };
}
