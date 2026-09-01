import { Decimal, roundToCents } from "@/lib/tariff/decimal";
import { calculateCustomsValuation } from "./valuationEngine";

export interface AllocationAssist {
  totalValue: Decimal.Value; remainingValue: Decimal.Value; allocationMethod: string; allocationBasis: string;
  estimatedVolume?: Decimal.Value | null; estimatedImportValue?: Decimal.Value | null;
}
export function calculateAssistAllocation(assist: AllocationAssist, entry: { units: Decimal.Value; fobValue: Decimal.Value; declaredCount?: number }) {
  const total = new Decimal(assist.totalValue);
  const remaining = new Decimal(assist.remainingValue);
  const units = new Decimal(entry.units);
  const fob = new Decimal(entry.fobValue);
  if (![total, remaining, units, fob].every(n => n.isFinite()) || total.lte(0) || remaining.lt(0) || remaining.gt(total) || units.lt(0) || fob.lt(0)) throw new Error("Invalid assist allocation inputs.");
  if (remaining.isZero()) return new Decimal(0);
  let amount: Decimal;
  if (assist.allocationMethod === "lump_sum") amount = remaining;
  else if (assist.allocationMethod === "equal_allocation") {
    const volume = new Decimal(assist.estimatedVolume ?? 0);
    if (!volume.isFinite() || volume.lte(0)) throw new Error("A positive estimated volume is required.");
    if (assist.allocationBasis === "entries" && !volume.isInteger()) throw new Error("Estimated entries must be a whole number.");
    amount = total.div(volume).times(assist.allocationBasis === "units" ? units : 1);
    if (assist.allocationBasis === "entries" && (entry.declaredCount ?? 0) >= volume.toNumber() - 1) amount = remaining;
  } else if (assist.allocationMethod === "value_proportional") {
    const estimate = new Decimal(assist.estimatedImportValue ?? 0);
    if (!estimate.isFinite() || estimate.lte(0)) throw new Error("A positive estimated import value is required.");
    amount = total.div(estimate).times(fob);
  } else throw new Error("Unknown allocation method.");
  let capped = Decimal.min(remaining, roundToCents(amount));
  // Absorb a final cent caused by repeated rounding without ever exceeding balance.
  if (capped.gt(0) && remaining.minus(capped).lte("0.01")) capped = remaining;
  return roundToCents(capped);
}
export function apportionAssistToLines(amount: Decimal.Value, lines: { id: string; value: Decimal.Value; quantity: number }[]) {
  const total = roundToCents(new Decimal(amount));
  if (total.lt(0) || !total.isFinite() || !lines.length) throw new Error("Positive allocation and affected lines are required.");
  const values = lines.map(l => new Decimal(l.value));
  if (values.some(v => !v.isFinite() || v.lt(0))) throw new Error("Invalid line value.");
  const weightTotal = Decimal.sum(...values);
  const weights = weightTotal.gt(0) ? values : lines.map(l => new Decimal(l.quantity));
  const denominator = Decimal.sum(...weights);
  if (denominator.lte(0)) throw new Error("Affected lines need a value or quantity.");
  let left = total;
  return lines.map((line, i) => {
    const allocation = i === lines.length - 1 ? left : Decimal.min(left, roundToCents(total.times(weights[i]).div(denominator)));
    left = left.minus(allocation);
    return { lineId: line.id, amount: allocation.toFixed(2) };
  });
}
/** Use the official engine; do not maintain a second customs-value formula. */
export function addAssistToCustomsValue(invoiceValue: Decimal.Value, amount: Decimal.Value, currency: string) {
  return calculateCustomsValuation({
    invoiceValue: new Decimal(invoiceValue).toFixed(2), currency,
    assists: [{ category: "registry", unitCost: new Decimal(amount).toFixed(2), quantity: 1, prorationMethod: "entire_shipment" }],
  }).customsValue;
}
