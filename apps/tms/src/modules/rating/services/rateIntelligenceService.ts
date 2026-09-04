import { Decimal } from "decimal.js";
import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";

// ---------------------------------------------------------------------------
// Rate Intelligence Service
//
// Answers the three questions that matter in commercial freight:
//   1. What does the market charge for this lane? (benchmark)
//   2. Are our contracted rates competitive? (spread)
//   3. Is this rate still valid / fresh? (staleness)
//
// This feeds the Quote Agent so every quote is grounded in real lane data.
// ---------------------------------------------------------------------------

export interface LaneKey {
  mode: string;
  equipment: string;
  originUnlocode?: string;
  originCountry?: string;
  destinationUnlocode?: string;
  destinationCountry?: string;
}

export interface LaneIntelligence {
  laneKey: LaneKey;
  // Rate statistics across carriers on this lane
  rateCount: number;
  lowestRate: number;
  highestRate: number;
  averageRate: number;
  medianRate: number;
  // Staleness
  freshRateCount: number;    // rates updated within 30 days
  staleRateCount: number;    // rates older than 30 days
  lastUpdatedAt: Date | null;
  // Confidence signal
  confidence: number;        // 0-100: higher when more/fresher rates exist
  // Recommended buy rate
  recommendedBuyRate: number;
  recommendedBuyRateRationale: string;
}

export interface RateCompetitivenessResult {
  carrierRateId: string;
  carrierName: string | null;
  baseRate: number;
  totalWithSurcharges: number;
  laneAverageRate: number;
  spreadVsMarket: number;       // positive = carrier is cheaper, negative = more expensive
  spreadPct: number;
  isCompetitive: boolean;       // within 15% of market average
  staleDays: number;
  isFresh: boolean;             // updated within 30 days
}

const STALE_THRESHOLD_DAYS = 30;
const COMPETITIVE_SPREAD_PCT = 15;

function endpointMatches(
  endpoint: unknown,
  expected: { unlocode?: string; country?: string }
): boolean {
  if (!endpoint || typeof endpoint !== "object") return false;
  const value = endpoint as Record<string, unknown>;
  const normalize = (input: unknown) =>
    typeof input === "string" ? input.trim().toUpperCase() : null;
  const expectedUnlocode = normalize(expected.unlocode);
  const expectedCountry = normalize(expected.country);
  const actualUnlocode = normalize(value.unlocode);
  const actualCountry = normalize(value.country);

  if (expectedUnlocode) return actualUnlocode === expectedUnlocode;
  if (expectedCountry) return actualCountry === expectedCountry;
  return false;
}

function rateMatchesLane(rate: { origin?: unknown; destination?: unknown }, lane: LaneKey) {
  return endpointMatches(rate.origin, {
    unlocode: lane.originUnlocode,
    country: lane.originCountry,
  }) && endpointMatches(rate.destination, {
    unlocode: lane.destinationUnlocode,
    country: lane.destinationCountry,
  });
}

/**
 * Compute lane intelligence for a given mode/equipment/origin/destination.
 * Used by the Quote Agent to select the best rate and set the sell price.
 */
export async function getLaneIntelligence(
  ctx: AccountContext,
  lane: LaneKey,
  existingRates?: any[]
): Promise<LaneIntelligence> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_THRESHOLD_DAYS * 86400 * 1000);

  // Fetch matching rates if not provided
  const candidateRates = existingRates ?? await db.carrierRate.findMany({
    where: {
      accountId: ctx.accountId,
      mode: lane.mode.toUpperCase(),
      equipment: lane.equipment,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    select: {
      id: true,
      carrierName: true,
      baseRate: true,
      surcharges: true,
      updatedAt: true,
      effectiveTo: true,
      origin: true,
      destination: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  }).catch(() => []);
  const rates = candidateRates.filter((rate) => rateMatchesLane(rate, lane));

  if (rates.length === 0) {
    // No rates on file — return a low-confidence signal
    return {
      laneKey: lane,
      rateCount: 0,
      lowestRate: 0,
      highestRate: 0,
      averageRate: 0,
      medianRate: 0,
      freshRateCount: 0,
      staleRateCount: 0,
      lastUpdatedAt: null,
      confidence: 10,
      recommendedBuyRate: 0,
      recommendedBuyRateRationale: "No rates on file for this lane. Manual quoting required.",
    };
  }

  // Compute all-in rates (base + surcharges total)
  const allInRates = rates.map((r) => {
    const base = new Decimal(r.baseRate.toString());
    const surchargeTotal = r.surcharges && typeof r.surcharges === "object"
      ? Object.values(r.surcharges as Record<string, number>).reduce(
          (acc, v) => acc.plus(new Decimal(String(v ?? 0))),
          new Decimal(0)
        )
      : new Decimal(0);
    return { rate: base.plus(surchargeTotal), updatedAt: r.updatedAt };
  });

  const rateValues = allInRates.map((r) => r.rate.toNumber()).sort((a, b) => a - b);
  const freshRates = allInRates.filter((r) => r.updatedAt >= staleThreshold);
  const staleRates = allInRates.filter((r) => r.updatedAt < staleThreshold);

  const sum = rateValues.reduce((a, b) => a + b, 0);
  const averageRate = sum / rateValues.length;
  const medianRate = rateValues.length % 2 === 0
    ? (rateValues[rateValues.length / 2 - 1] + rateValues[rateValues.length / 2]) / 2
    : rateValues[Math.floor(rateValues.length / 2)];

  // Confidence: more fresh rates = higher confidence, max 95
  const freshnessFactor = Math.min(1, freshRates.length / Math.max(1, rates.length));
  const volumeFactor = Math.min(1, rates.length / 5); // 5+ rates = full volume confidence
  const confidence = Math.round(20 + 75 * freshnessFactor * volumeFactor);

  // Recommended buy rate: median of fresh rates if available, else median of all
  const freshValues = freshRates.map((r) => r.rate.toNumber()).sort((a, b) => a - b);
  const recommendedBuyRate = freshValues.length > 0
    ? freshValues[Math.floor(freshValues.length / 2)]
    : medianRate;

  const rationale = freshValues.length > 0
    ? `Median of ${freshValues.length} fresh rate(s) updated within ${STALE_THRESHOLD_DAYS} days.`
    : `Median of ${rateValues.length} rate(s) — all older than ${STALE_THRESHOLD_DAYS} days. Consider refreshing rates.`;

  return {
    laneKey: lane,
    rateCount: rates.length,
    lowestRate: rateValues[0],
    highestRate: rateValues[rateValues.length - 1],
    averageRate,
    medianRate,
    freshRateCount: freshRates.length,
    staleRateCount: staleRates.length,
    lastUpdatedAt: rates[0]?.updatedAt ?? null,
    confidence,
    recommendedBuyRate,
    recommendedBuyRateRationale: rationale,
  };
}

/**
 * Evaluate a specific carrier rate's competitiveness vs the lane market.
 */
export async function evaluateRateCompetitiveness(
  ctx: AccountContext,
  carrierRateId: string,
  lane: LaneKey
): Promise<RateCompetitivenessResult | null> {
  const rate = await db.carrierRate.findFirst({
    where: { id: carrierRateId, accountId: ctx.accountId },
  });

  if (!rate) return null;

  const intel = await getLaneIntelligence(ctx, lane);
  const now = new Date();
  const staleDays = Math.floor(
    (now.getTime() - rate.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const base = new Decimal(rate.baseRate.toString());
  const surchargeTotal = rate.surcharges && typeof rate.surcharges === "object"
    ? Object.values(rate.surcharges as Record<string, number>).reduce(
        (acc, v) => acc.plus(new Decimal(String(v ?? 0))),
        new Decimal(0)
      )
    : new Decimal(0);

  const totalWithSurcharges = base.plus(surchargeTotal).toNumber();
  const spreadVsMarket = intel.averageRate - totalWithSurcharges;
  const spreadPct = intel.averageRate > 0
    ? Math.abs(spreadVsMarket / intel.averageRate) * 100
    : 0;

  return {
    carrierRateId: rate.id,
    carrierName: rate.carrierName,
    baseRate: Number(rate.baseRate),
    totalWithSurcharges,
    laneAverageRate: intel.averageRate,
    spreadVsMarket,
    spreadPct,
    isCompetitive: spreadPct <= COMPETITIVE_SPREAD_PCT,
    staleDays,
    isFresh: staleDays <= STALE_THRESHOLD_DAYS,
  };
}

/**
 * Compute a recommended sell price given a buy cost and target margin from policy.
 * Uses Decimal.js for all arithmetic.
 */
export function computeSellPrice(
  buyAmount: Decimal,
  targetMarginPct: Decimal
): { sellAmount: Decimal; grossProfit: Decimal; actualMarginPct: Decimal } {
  if (targetMarginPct.lt(0) || targetMarginPct.gte(100)) {
    throw new Error("Target gross margin must be between 0% and 100%.");
  }
  // Gross margin is profit / sell, so sell = buy / (1 - margin).
  const sellAmount = buyAmount
    .div(new Decimal(1).minus(targetMarginPct.div(100)))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const grossProfit = sellAmount.minus(buyAmount);
  const actualMarginPct = sellAmount.eq(0)
    ? new Decimal(0)
    : grossProfit.div(sellAmount).times(100).toDecimalPlaces(2);

  return { sellAmount, grossProfit, actualMarginPct };
}
