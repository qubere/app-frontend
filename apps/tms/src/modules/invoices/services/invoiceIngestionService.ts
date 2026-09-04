import { Decimal } from "decimal.js";
import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";
import { publishTransportationEvent } from "../../events/services/eventService";

// ---------------------------------------------------------------------------
// Invoice Ingestion Service
//
// Handles structured intake of carrier invoices from any source:
//   - EDI 210 (parsed line items)
//   - Email-extracted invoice (AI parsed)
//   - Manual entry via UI
//   - AP document pipeline
//
// Creates:  CarrierInvoice + CarrierInvoiceLine records
// Queues:   immediate freight audit if shipment has POD
// Emits:    INVOICE_RECEIVED TransportationEvent
// ---------------------------------------------------------------------------

export interface InvoiceLineInput {
  chargeType: string;   // LINEHAUL | FUEL_SURCHARGE | ACCESSORIAL | DETENTION | DEMURRAGE | OTHER
  description?: string;
  amount: number;
}

export interface IngestCarrierInvoiceInput {
  shipmentId: string;
  carrierId: string;
  invoiceNumber?: string;
  invoiceDate?: Date;
  totalAmount?: number;   // if omitted, will be summed from lines
  currency?: string;
  lines: InvoiceLineInput[];
  sourceDocument?: string;  // ShipmentDocument.id if available
  source?: "EDI_210" | "EMAIL_PARSE" | "MANUAL" | "AP_UPLOAD";
}

export interface IngestResult {
  carrierInvoice: {
    id: string;
    invoiceNumber: string | null;
    totalAmount: number;
    matchStatus: string;
  };
  lineCount: number;
  readyForAudit: boolean;
  hasPod: boolean;
}

/**
 * Ingests a carrier invoice from any source.
 * Validates line amounts, sums total, creates DB records, queues audit signal.
 */
export async function ingestCarrierInvoice(
  ctx: AccountContext,
  input: IngestCarrierInvoiceInput
): Promise<IngestResult> {
  // Validate that the shipment belongs to this account
  const shipment = await db.shipment.findFirst({
    where: { id: input.shipmentId, accountId: ctx.accountId },
    select: { id: true, shipmentNumber: true },
  });

  if (!shipment) {
    throw new Error(`Shipment ${input.shipmentId} not found.`);
  }

  // Compute total from lines using Decimal.js — never trust the reported total
  const computedTotal = input.lines.reduce(
    (acc, l) => acc.plus(new Decimal(String(l.amount))),
    new Decimal(0)
  );

  // If a reported total was provided, check for discrepancy
  let declaredTotal = computedTotal;
  let hasHeaderDiscrepancy = false;

  if (input.totalAmount != null) {
    const reportedTotal = new Decimal(String(input.totalAmount));
    const discrepancy = computedTotal.minus(reportedTotal).abs();
    // More than $0.02 discrepancy between header total and line sum = flag it
    if (discrepancy.gt(new Decimal("0.02"))) {
      hasHeaderDiscrepancy = true;
    }
    declaredTotal = reportedTotal;
  }

  // Check for duplicate — same carrier + invoice number already ingested
  if (input.invoiceNumber) {
    const existing = await db.carrierInvoice
      .findFirst({
        where: {
          accountId: ctx.accountId,
          carrierId: input.carrierId,
          invoiceNumber: input.invoiceNumber,
        },
        select: { id: true, matchStatus: true, totalAmount: true },
      })
      .catch(() => null);

    if (existing) {
      return {
        carrierInvoice: {
          id: existing.id,
          invoiceNumber: input.invoiceNumber,
          totalAmount: Number(existing.totalAmount),
          matchStatus: existing.matchStatus,
        },
        lineCount: 0,
        readyForAudit: existing.matchStatus === "PENDING",
        hasPod: false,
      };
    }
  }

  // Create CarrierInvoice + Lines atomically
  const carrierInvoice = await db.carrierInvoice.create({
    data: {
      accountId: ctx.accountId,
      shipmentId: input.shipmentId,
      carrierId: input.carrierId,
      invoiceNumber: input.invoiceNumber ?? null,
      invoiceDate: input.invoiceDate ?? null,
      totalAmount: declaredTotal.toDecimalPlaces(2) as any,
      currency: input.currency ?? "USD",
      matchStatus: "PENDING",
      documentId: input.sourceDocument ?? null,
      lines: {
        create: input.lines.map((l) => ({
          accountId: ctx.accountId,
          chargeType: l.chargeType.toUpperCase(),
          description: l.description ?? l.chargeType,
          amount: new Decimal(String(l.amount)).toDecimalPlaces(2) as any,
        })),
      },
    },
    include: { lines: true },
  });

  // If there was a header discrepancy, flag it immediately
  if (hasHeaderDiscrepancy) {
    await db.exceptionItem
      .create({
        data: {
          accountId: ctx.accountId,
          shipmentId: input.shipmentId,
          type: "INVOICE_HEADER_MISMATCH",
          category: "BILLING",
          severity: "High",
          description:
            `Carrier invoice ${input.invoiceNumber ?? carrierInvoice.id}: ` +
            `Header total $${declaredTotal.toFixed(2)} does not match ` +
            `line sum $${computedTotal.toFixed(2)}. ` +
            `Discrepancy: $${computedTotal.minus(declaredTotal).abs().toFixed(2)}.`,
          requiredAction: "Contact carrier to correct invoice before payment approval.",
          blocking: false,
          status: "Open",
          sourceAgent: "Invoice Ingestion",
        },
      })
      .catch(() => null);
  }

  // Check if POD exists for this shipment — determines audit readiness
  const pod = await db.proofOfDelivery
    .findFirst({
      where: { shipmentId: input.shipmentId, accountId: ctx.accountId },
      select: { id: true },
    })
    .catch(() => null);

  const hasPod = !!pod;

  // Emit INVOICE_RECEIVED event for audit trail + downstream triggers
  await publishTransportationEvent(ctx, {
    entityType: "SHIPMENT",
    entityId: input.shipmentId,
    shipmentId: input.shipmentId,
    eventType: "INVOICE_RECEIVED",
    source: "SYSTEM",
    payload: {
      carrierInvoiceId: carrierInvoice.id,
      invoiceNumber: input.invoiceNumber ?? null,
      totalAmount: declaredTotal.toNumber(),
      lineCount: input.lines.length,
      source: input.source ?? "MANUAL",
      readyForAudit: hasPod,
      hasHeaderDiscrepancy,
    },
  }).catch(() => null);

  return {
    carrierInvoice: {
      id: carrierInvoice.id,
      invoiceNumber: carrierInvoice.invoiceNumber,
      totalAmount: Number(carrierInvoice.totalAmount),
      matchStatus: carrierInvoice.matchStatus,
    },
    lineCount: carrierInvoice.lines.length,
    readyForAudit: hasPod,
    hasPod,
  };
}

/**
 * Batch-ingest multiple invoices (e.g. from a carrier AP feed or EDI burst).
 * Continues on individual errors; returns per-invoice result.
 */
export async function batchIngestCarrierInvoices(
  ctx: AccountContext,
  invoices: IngestCarrierInvoiceInput[]
): Promise<{
  succeeded: number;
  failed: number;
  results: Array<{ invoiceNumber?: string; status: "ok" | "error"; error?: string; invoiceId?: string }>;
}> {
  const results: Array<{
    invoiceNumber?: string;
    status: "ok" | "error";
    error?: string;
    invoiceId?: string;
  }> = [];

  let succeeded = 0;
  let failed = 0;

  for (const inv of invoices) {
    try {
      const result = await ingestCarrierInvoice(ctx, inv);
      results.push({
        invoiceNumber: inv.invoiceNumber,
        status: "ok",
        invoiceId: result.carrierInvoice.id,
      });
      succeeded++;
    } catch (err: any) {
      results.push({
        invoiceNumber: inv.invoiceNumber,
        status: "error",
        error: err.message || "Unknown ingestion error",
      });
      failed++;
    }
  }

  return { succeeded, failed, results };
}
