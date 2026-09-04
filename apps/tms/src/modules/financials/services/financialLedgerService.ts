import { db } from "@qubere/db";
import { Decimal } from "decimal.js";
import type { AccountContext } from "@qubere/auth";

export interface ShipmentFinancialLedger {
  shipmentId: string;
  // Revenue side
  clientSellRateUsd: number;
  // Cost side
  expectedBuyCostUsd: number;
  actualBuyCostUsd: number;
  // Derived
  grossProfitUsd: number;
  grossMarginPct: number;
  costVariancePct: number;
  // Status
  arInvoiceStatus: "NONE" | "DRAFT" | "ISSUED" | "PAID";
  apRemittanceStatus: "PENDING_AUDIT" | "APPROVED_FOR_PAYMENT" | "PAID";
  hasMatchedCarrierInvoice: boolean;
  hasProofOfDelivery: boolean;
  financialsLocked: boolean;
  // Provenance
  chargeCount: number;
  costCount: number;
  invoiceLineCount: number;
}

/**
 * Computes real shipment financials from:
 *   sellAmount   = sum(ShipmentCharge.netAmount)
 *   expectedBuy  = sum(ShipmentCost.amount)
 *   actualBuy    = sum(CarrierInvoiceLine.amount) on MATCHED invoices
 *
 * All arithmetic uses Decimal.js — no float math on money.
 * Writes derived fields back to Shipment for fast dashboard reads.
 */
export async function computeShipmentFinancials(
  ctx: AccountContext,
  shipmentId: string,
  opts: { persist?: boolean } = { persist: true }
): Promise<ShipmentFinancialLedger> {
  const [charges, costs, matchedInvoices, proofOfDelivery] = await Promise.all([
    db.shipmentCharge.findMany({
      where: { shipmentId, accountId: ctx.accountId },
      select: { netAmount: true },
    }),
    db.shipmentCost.findMany({
      where: { shipmentId, accountId: ctx.accountId },
      select: { amount: true },
    }),
    db.carrierInvoice.findMany({
      where: {
        shipmentId,
        accountId: ctx.accountId,
        matchStatus: "MATCHED",
      },
      include: { lines: { select: { amount: true } } },
    }),
    db.proofOfDelivery.findFirst({
      where: { shipmentId, accountId: ctx.accountId },
      select: { id: true },
    }),
  ]);

  // Sum sell-side charges (what we bill the client)
  const sellAmount = charges
    .reduce((acc, c) => acc.plus(new Decimal(c.netAmount.toString())), new Decimal(0));

  // Sum expected buy cost (what we expected to pay the carrier)
  const expectedBuyCost = costs
    .reduce((acc, c) => acc.plus(new Decimal(c.amount.toString())), new Decimal(0));

  // Sum actual buy cost from matched carrier invoices only
  const invoiceLines = matchedInvoices.flatMap((inv) => inv.lines);
  const actualBuyCost = invoiceLines.length > 0
    ? invoiceLines.reduce(
        (acc, l) => acc.plus(new Decimal(l.amount.toString())),
        new Decimal(0)
      )
    : expectedBuyCost; // Fall back to expected if no invoice yet

  // Derived metrics — use Decimal throughout, convert to number at boundary
  const grossProfit = sellAmount.minus(actualBuyCost);
  const grossMarginPct =
    sellAmount.gt(0)
      ? grossProfit.dividedBy(sellAmount).times(100).toDecimalPlaces(2)
      : new Decimal(0);

  const costVariancePct =
    expectedBuyCost.gt(0) && invoiceLines.length > 0
      ? actualBuyCost
          .minus(expectedBuyCost)
          .dividedBy(expectedBuyCost)
          .times(100)
          .toDecimalPlaces(2)
      : new Decimal(0);

  const hasPod = !!proofOfDelivery;
  const hasMatchedInvoice = matchedInvoices.length > 0;
  const financialsLocked = hasPod && hasMatchedInvoice;

  // Determine AR invoice status by finding a ShipmentCharge with an invoiceLineId
  const chargeWithInvoice = await db.shipmentCharge
    .findFirst({
      where: { shipmentId, invoiceLineId: { not: null } },
      select: { invoiceLine: { select: { invoice: { select: { status: true } } } } },
    })
    .catch(() => null);

  const arInvoiceStatus: ShipmentFinancialLedger["arInvoiceStatus"] = (() => {
    const arInvoice = chargeWithInvoice?.invoiceLine?.invoice;
    if (!arInvoice) return "NONE";
    const s = String(arInvoice.status);
    if (s === "PAID") return "PAID";
    if (s === "ISSUED" || s === "SENT") return "ISSUED";
    return "DRAFT";
  })();

  const apRemittanceStatus: ShipmentFinancialLedger["apRemittanceStatus"] =
    financialsLocked ? "APPROVED_FOR_PAYMENT" : "PENDING_AUDIT";

  const result: ShipmentFinancialLedger = {
    shipmentId,
    clientSellRateUsd: sellAmount.toNumber(),
    expectedBuyCostUsd: expectedBuyCost.toNumber(),
    actualBuyCostUsd: actualBuyCost.toNumber(),
    grossProfitUsd: grossProfit.toNumber(),
    grossMarginPct: grossMarginPct.toNumber(),
    costVariancePct: costVariancePct.toNumber(),
    arInvoiceStatus,
    apRemittanceStatus,
    hasMatchedCarrierInvoice: hasMatchedInvoice,
    hasProofOfDelivery: hasPod,
    financialsLocked,
    chargeCount: charges.length,
    costCount: costs.length,
    invoiceLineCount: invoiceLines.length,
  };

  // Write derived cache back to Shipment for fast aggregation queries
  if (opts.persist !== false) {
    await db.shipment
      .update({
        where: { id: shipmentId },
        data: {
          sellAmount: sellAmount,
          expectedBuyCost: expectedBuyCost,
          actualBuyCost: actualBuyCost,
          grossProfit: grossProfit,
          grossMarginPct: grossMarginPct,
          costVariancePct: costVariancePct,
        },
      })
      .catch(() => {
        // Non-fatal: cache write failure doesn't break the computation
      });
  }

  return result;
}
