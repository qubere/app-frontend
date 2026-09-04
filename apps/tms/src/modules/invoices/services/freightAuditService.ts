import { db } from "@qubere/db";
import { Decimal } from "decimal.js";
import type { AccountContext } from "@qubere/auth";

export interface FreightAuditLineResult {
  chargeType: string;
  expectedUsd: number;
  invoicedUsd: number;
  varianceUsd: number;
  variancePct: number;
  status: "MATCHED" | "WITHIN_TOLERANCE" | "VARIANCE";
}

export interface FreightAuditResult {
  shipmentId: string;
  carrierInvoiceId: string;
  agreedBuyRateUsd: number;
  carrierInvoicedUsd: number;
  varianceUsd: number;
  variancePct: number;
  auditStatus: "MATCHED" | "WITHIN_TOLERANCE" | "VARIANCE_FLAGGED" | "EXCEPTION";
  hasSignedPod: boolean;
  podHasException: boolean;
  currency: string;
  currencyConsistent: boolean;
  invoiceTotalMatchesLines: boolean;
  uncontractedChargeTypes: string[];
  lines: FreightAuditLineResult[];
  notes: string;
}

/**
 * Variance tolerance in % — variances within this band are auto-approved.
 * Default: 3% (e.g. minor fuel surcharge fluctuations).
 */
const AUTO_APPROVE_TOLERANCE_PCT = 3.0;

/**
 * Performs a real 3-way match:
 *   1. Loads the CarrierInvoice + CarrierInvoiceLine records
 *   2. Compares against ShipmentCost records for expected costs
 *   3. Computes variance per charge type and overall
 *   4. Updates CarrierInvoice.matchStatus in DB
 *   5. Returns a structured result for the Freight Audit Agent to act on
 */
export async function performFreightAudit(
  ctx: Pick<AccountContext, "accountId">,
  carrierInvoiceId: string
): Promise<FreightAuditResult> {
  const invoice = await db.carrierInvoice.findFirst({
    where: { id: carrierInvoiceId, accountId: ctx.accountId },
    include: { lines: true },
  });

  if (!invoice) {
    throw new Error(`CarrierInvoice ${carrierInvoiceId} not found for account ${ctx.accountId}`);
  }

  // Load expected costs for this shipment
  const expectedCosts = await db.shipmentCost.findMany({
    where: { shipmentId: invoice.shipmentId, accountId: ctx.accountId },
    select: { costType: true, amount: true, currency: true, description: true },
  });

  // Load POD specific to this shipment
  const pod = await db.proofOfDelivery.findFirst({
    where: { shipmentId: invoice.shipmentId, accountId: ctx.accountId },
    select: { id: true, exceptionNoted: true },
  });

  const hasPod = !!pod;

  const normalizeChargeType = (value: string) =>
    value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^CARRIER_/, "");

  const expectedCurrencies = new Set(expectedCosts.map((cost) => cost.currency.toUpperCase()));
  const currencyConsistent =
    expectedCurrencies.size === 0 ||
    (expectedCurrencies.size === 1 && expectedCurrencies.has(invoice.currency.toUpperCase()));

  // Build expected and invoiced maps by normalized charge type. Comparing
  // every invoice line to the full expected category double-counted duplicate
  // charge types and allowed uncontracted charges to appear as 0% variance.
  const expectedByType = new Map<string, Decimal>();
  for (const cost of expectedCosts) {
    const chargeType = normalizeChargeType(cost.costType);
    const existing = expectedByType.get(chargeType) ?? new Decimal(0);
    expectedByType.set(chargeType, existing.plus(new Decimal(cost.amount.toString())));
  }

  const invoicedByType = new Map<string, Decimal>();
  for (const line of invoice.lines) {
    const chargeType = normalizeChargeType(line.chargeType);
    const existing = invoicedByType.get(chargeType) ?? new Decimal(0);
    invoicedByType.set(chargeType, existing.plus(new Decimal(line.amount.toString())));
  }

  const invoiceLineTotal = [...invoicedByType.values()].reduce(
    (total, amount) => total.plus(amount),
    new Decimal(0)
  );
  const invoiceHeaderTotal = new Decimal(invoice.totalAmount.toString());
  const invoiceTotalMatchesLines = invoiceHeaderTotal.equals(invoiceLineTotal);
  const totalInvoiced = invoiceHeaderTotal;

  // Total expected
  const totalExpected = expectedCosts.reduce(
    (acc, c) => acc.plus(new Decimal(c.amount.toString())),
    new Decimal(0)
  );

  const chargeTypes = new Set([...expectedByType.keys(), ...invoicedByType.keys()]);
  const uncontractedChargeTypes: string[] = [];
  const lineResults: FreightAuditLineResult[] = [...chargeTypes].map((chargeType) => {
    const invoicedAmt = invoicedByType.get(chargeType) ?? new Decimal(0);
    const expectedAmt = expectedByType.get(chargeType) ?? new Decimal(0);

    const varianceAmt = invoicedAmt.minus(expectedAmt);
    const isUncontracted = expectedAmt.eq(0) && invoicedAmt.gt(0);
    if (isUncontracted) uncontractedChargeTypes.push(chargeType);
    const variancePct = expectedAmt.gt(0)
      ? varianceAmt.dividedBy(expectedAmt).times(100).toDecimalPlaces(2).toNumber()
      : invoicedAmt.eq(0)
        ? 0
        : 100;

    const absVariancePct = Math.abs(variancePct);
    const status: FreightAuditLineResult["status"] =
      isUncontracted
        ? "VARIANCE"
        : absVariancePct === 0
        ? "MATCHED"
        : absVariancePct <= AUTO_APPROVE_TOLERANCE_PCT
          ? "WITHIN_TOLERANCE"
          : "VARIANCE";

    return {
      chargeType,
      expectedUsd: expectedAmt.toNumber(),
      invoicedUsd: invoicedAmt.toNumber(),
      varianceUsd: varianceAmt.toNumber(),
      variancePct,
      status,
    };
  });

  // Overall variance
  const totalVariance = totalInvoiced.minus(totalExpected);
  const totalVariancePct = totalExpected.gt(0)
    ? totalVariance.dividedBy(totalExpected).times(100).toDecimalPlaces(2).toNumber()
    : totalInvoiced.eq(0)
      ? 0
      : 100;

  const hasVarianceLine = lineResults.some((l) => l.status === "VARIANCE");
  const overallStatus: FreightAuditResult["auditStatus"] = (() => {
    if (!currencyConsistent || !invoiceTotalMatchesLines || !hasPod || pod?.exceptionNoted) {
      return "EXCEPTION";
    }
    if (uncontractedChargeTypes.length > 0 || totalExpected.eq(0)) return "VARIANCE_FLAGGED";
    if (!hasVarianceLine && Math.abs(totalVariancePct) === 0) return "MATCHED";
    if (!hasVarianceLine && Math.abs(totalVariancePct) <= AUTO_APPROVE_TOLERANCE_PCT)
      return "WITHIN_TOLERANCE";
    return "VARIANCE_FLAGGED";
  })();

  // Notes for the work item / audit trail
  const notes = !hasPod
    ? "Proof of delivery is required before this invoice can be approved."
    : pod?.exceptionNoted
      ? "Proof of delivery contains an exception and requires review."
      : !currencyConsistent
        ? `Invoice currency ${invoice.currency} does not match the expected cost currency.`
        : !invoiceTotalMatchesLines
          ? `Invoice header total ${invoiceHeaderTotal.toFixed(2)} does not match line total ${invoiceLineTotal.toFixed(2)}.`
          : uncontractedChargeTypes.length > 0
            ? `Uncontracted charge type(s): ${uncontractedChargeTypes.join(", ")}.`
            : overallStatus === "MATCHED"
      ? "3-way match verified cleanly against expected costs and POD."
      : overallStatus === "WITHIN_TOLERANCE"
        ? `Carrier invoice is within ${AUTO_APPROVE_TOLERANCE_PCT}% tolerance (${totalVariancePct.toFixed(1)}%).`
        : `Carrier invoice has a $${Math.abs(totalVariance.toNumber()).toFixed(2)} (${Math.abs(totalVariancePct).toFixed(1)}%) variance requiring review.`;

  return {
    shipmentId: invoice.shipmentId,
    carrierInvoiceId,
    agreedBuyRateUsd: totalExpected.toNumber(),
    carrierInvoicedUsd: totalInvoiced.toNumber(),
    varianceUsd: totalVariance.toNumber(),
    variancePct: totalVariancePct,
    auditStatus: overallStatus,
    hasSignedPod: hasPod,
    podHasException: pod?.exceptionNoted ?? false,
    currency: invoice.currency,
    currencyConsistent,
    invoiceTotalMatchesLines,
    uncontractedChargeTypes,
    lines: lineResults,
    notes,
  };
}

/**
 * Finds all carrier invoices needing audit for a given shipment.
 * Used by the Freight Audit Agent to process all pending invoices.
 */
export async function getPendingAuditsForShipment(
  ctx: Pick<AccountContext, "accountId">,
  shipmentId: string
): Promise<string[]> {
  const invoices = await db.carrierInvoice.findMany({
    where: { shipmentId, accountId: ctx.accountId, matchStatus: "PENDING" },
    select: { id: true },
  });
  return invoices.map((inv) => inv.id);
}
