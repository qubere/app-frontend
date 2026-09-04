import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { z } from "zod";
import { evaluateRFQ } from "@/modules/rating/services/quoteService";

const rfqSchema = z.object({
  transportationOrderId: z.string().min(1),
  targetMarginPercent: z.number().min(0).max(100).optional(),
  requireFreshRates: z.boolean().optional(),
  forceQuoteEvenIfNoRates: z.boolean().optional(),
});

/**
 * POST /api/quotes/rfq
 *
 * Runs the Quote Agent against a TransportationOrder.
 * Returns FreightQuote + AgentDecision + LaneIntelligence.
 */
export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json();
  const parsed = rfqSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await evaluateRFQ(ctx, parsed.data);

  return NextResponse.json({
    quoteId: result.quote.id,
    sellAmount: result.quote.sellAmount,
    buyAmount: result.quote.buyAmount,
    margin: result.quote.margin,
    approvalState: result.quote.approvalState,
    carrierName: result.quote.carrierName,
    agentDecisionId: result.decision.id,
    triageState: result.decision.triageState,
    laneIntelligence: {
      confidence: result.laneIntelligence.confidence,
      rateCount: result.laneIntelligence.rateCount,
      freshRateCount: result.laneIntelligence.freshRateCount,
      averageRate: result.laneIntelligence.averageRate,
      recommendedBuyRate: result.laneIntelligence.recommendedBuyRate,
      rationale: result.laneIntelligence.recommendedBuyRateRationale,
    },
  });
});
