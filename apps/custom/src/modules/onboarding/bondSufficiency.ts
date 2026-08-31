// CBP continuous bond sufficiency formula — pure, no DB access.
// Source: CBP guidance on continuous bond amounts (19 CFR 113).
//
// Required amount = 10% of aggregate duties/taxes/fees for the prior 12
// months, rounded UP to the next $10,000 for totals below $100,000, or
// the next $100,000 for totals at or above $100,000. Statutory minimum: $50,000.

import { Decimal } from "@/lib/tariff/decimal";

const FIFTY_K  = new Decimal(50_000);
const HUNDRED_K = new Decimal(100_000);
const TEN_K    = new Decimal(10_000);

function ceilToInterval(value: Decimal, interval: Decimal): Decimal {
  if (value.isZero()) return interval;
  const remainder = value.mod(interval);
  if (remainder.isZero()) return value;
  return value.minus(remainder).plus(interval);
}

export interface BondSufficiencyResult {
  requiredAmount: Decimal;
  rawAmount: Decimal;     // 10% before rounding, pre-floor
  basis: "HISTORICAL" | "PROJECTED";
  sufficient: boolean | null; // null when actual bond amount unknown
  actualAmount: Decimal | null;
  shortfall: Decimal | null;
}

export function requiredContinuousBondAmount(priorYearDutyTaxFee: Decimal): Decimal {
  const raw = priorYearDutyTaxFee.times("0.10");
  const rounded = raw.gte(HUNDRED_K)
    ? ceilToInterval(raw, HUNDRED_K)
    : ceilToInterval(raw, TEN_K);
  return rounded.lt(FIFTY_K) ? FIFTY_K : rounded;
}

export function computeBondSufficiency(
  priorYearDutyTaxFee: Decimal,
  basis: "HISTORICAL" | "PROJECTED",
  actualBondAmount: Decimal | null
): BondSufficiencyResult {
  const rawAmount = priorYearDutyTaxFee.times("0.10");
  const requiredAmount = requiredContinuousBondAmount(priorYearDutyTaxFee);

  if (actualBondAmount === null) {
    return { requiredAmount, rawAmount, basis, sufficient: null, actualAmount: null, shortfall: null };
  }

  const sufficient = actualBondAmount.gte(requiredAmount);
  const shortfall = sufficient ? null : requiredAmount.minus(actualBondAmount);
  return { requiredAmount, rawAmount, basis, sufficient, actualAmount: actualBondAmount, shortfall };
}
