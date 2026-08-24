import { z } from "zod";
import type { AssistantTool } from "@qubere/assistant";
import type { AccountContext } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import { TmsAccountContextBuilder } from "../../memory/memory.context-builder";

export const recommendCarrierSchema = z.object({
  shipmentId: z.string(),
  preferredMaxTransitDays: z.number().int().optional().nullable(),
  requireInsurance: z.boolean().default(true),
});

export type RecommendCarrierInput = z.infer<typeof recommendCarrierSchema>;

export const recommendCarrierTool: AssistantTool = {
  access: {
    permission: "transportation_orders.write",
    write: true,
    confirmationRequired: true,
  },
  declaration: {
    name: "recommend_carrier",
    description:
      "Evaluates available FreightQuotes for a shipment, considering rate, transit time, and carrier insurance status, producing an AgentDecision recommendation with comparison proof.",
    parameters: {
      type: "OBJECT",
      properties: {
        shipmentId: { type: "STRING", description: "Target shipment ID to evaluate quotes for" },
      },
      required: ["shipmentId"],
    },
  },
  schema: recommendCarrierSchema as any,
  execute: async (ctx: AccountContext, args: Record<string, unknown>) => {
    const input = recommendCarrierSchema.parse(args);

    // 1. Fetch available quotes for the shipment
    const quotes = await db.freightQuote.findMany({
      where: {
        accountId: ctx.accountId,
        shipmentId: input.shipmentId,
        status: { in: ["PROPOSED", "SENT", "ACCEPTED"] },
        OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
      },
    });

    if (quotes.length === 0) {
      throw new Error(`No FreightQuote records found for shipment ${input.shipmentId}.`);
    }

    // 2. Fetch carrier records for quote evaluation
    const carrierIds = quotes.map((q) => q.carrierId).filter((id): id is string => Boolean(id));
    const carriers = await db.carrier.findMany({
      where: {
        accountId: ctx.accountId,
        id: { in: carrierIds },
        status: "ACTIVE",
      },
    });

    const carrierMap = new Map(carriers.map((c) => [c.id, c]));
    const accountMemory = await TmsAccountContextBuilder.build({
      accountId: ctx.accountId,
      task: "CARRIER_SELECTION",
      query: quotes.flatMap((quote) => [quote.carrierId, quote.carrierName, quote.mode, quote.equipment]).filter(Boolean).join(" "),
      scope: { shipmentId: input.shipmentId },
    });

    const currencies = new Set(quotes.map((quote) => quote.currency));
    if (currencies.size > 1) {
      throw new Error("Carrier quotes use multiple currencies and require an explicit FX normalization source.");
    }

    const comparableAmounts = quotes
      .filter((quote) => quote.carrierId && carrierMap.has(quote.carrierId))
      .map((quote) => Number(quote.buyAmount));
    const minAmount = Math.min(...comparableAmounts);
    const maxAmount = Math.max(...comparableAmounts);
    const transitValues = quotes
      .map((quote) => quote.transitDays)
      .filter((days): days is number => days != null);
    const minTransit = transitValues.length > 0 ? Math.min(...transitValues) : null;
    const maxTransit = transitValues.length > 0 ? Math.max(...transitValues) : null;

    // Filter and score options using normalized factors. Raw dollar amounts
    // cannot be subtracted from an arbitrary eligibility score.
    const evaluatedOptions = quotes.map((quote) => {
      const carrier = quote.carrierId ? carrierMap.get(quote.carrierId) : undefined;
      const hasInsurance = carrier?.insuranceOnFile ?? false;
      const meetsTransitPreference =
        input.preferredMaxTransitDays == null ||
        (quote.transitDays != null && quote.transitDays <= input.preferredMaxTransitDays);
      const isEligible =
        carrier != null &&
        (input.requireInsurance ? hasInsurance : true) &&
        meetsTransitPreference;
      const numericAmount = Number(quote.buyAmount);
      const rateScore = maxAmount === minAmount
        ? 100
        : 100 - ((numericAmount - minAmount) / (maxAmount - minAmount)) * 100;
      const transitScore =
        quote.transitDays == null || minTransit == null || maxTransit == null
          ? 0
          : maxTransit === minTransit
            ? 100
            : 100 - ((quote.transitDays - minTransit) / (maxTransit - minTransit)) * 100;
      const memoryAdjustment = quote.carrierId
        ? TmsAccountContextBuilder.carrierPreferenceAdjustment(accountMemory, {
            carrierId: quote.carrierId,
            carrierName: carrier?.legalName ?? quote.carrierName,
            scac: carrier?.scac,
          })
        : 0;
      const score = isEligible
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(rateScore * 0.65 + transitScore * 0.35 + memoryAdjustment)
            )
          )
        : 0;

      return {
        quote,
        carrier,
        hasInsurance,
        isEligible,
        numericAmount,
        score,
        memoryAdjustment,
      };
    });

    const eligibleOptions = evaluatedOptions.filter((o) => o.isEligible);
    const winner = eligibleOptions.sort(
      (a, b) => b.score - a.score || a.quote.id.localeCompare(b.quote.id)
    )[0];

    if (!winner) {
      const agentDecision = await db.agentDecision.create({
        data: {
          accountId: ctx.accountId,
          shipmentId: input.shipmentId,
          agentName: "CarrierRecommendationAgent",
          decisionSummary: "No eligible carrier quote satisfies the configured requirements.",
          status: "Review Required",
          triageState: "NEEDS_REVIEW",
          confidence: 0,
          rulesApplied: ["RATE_COMPARISON_V2", "CARRIER_ELIGIBILITY_CHECK"],
          evidenceItems: evaluatedOptions.map((option) => ({
            field: "carrierEligibility",
            extractedValue: option.carrier?.legalName ?? "Missing carrier identity",
            sourceSpan: `Quote ${option.quote.id}; insurance=${option.hasInsurance}; transitDays=${option.quote.transitDays ?? "unknown"}`,
          })) as any,
          proposedDescription: "Manual carrier sourcing or missing carrier data is required.",
        },
      });
      return {
        recommendedQuote: null,
        recommendedCarrier: null,
        agentDecision,
        allEvaluatedOptions: evaluatedOptions,
        outcome: "NO_ELIGIBLE_CARRIER",
      };
    }

    const confidence = Math.round(
      ((winner.carrier ? 1 : 0) +
        (winner.hasInsurance || !input.requireInsurance ? 1 : 0) +
        (winner.quote.transitDays != null ? 1 : 0) +
        (eligibleOptions.length > 1 ? 1 : 0)) /
        4 *
        100
    );
    const isHighConfidence = confidence >= 75;

    // Construct detailed evidence items matching product positioning (Qubere proves every recommendation)
    const evidenceItems = evaluatedOptions.map((opt) => ({
      field: "carrierQuoteComparison",
      extractedValue: `Carrier: ${opt.carrier?.legalName ?? opt.quote.carrierId}, Buy rate: ${opt.quote.currency} ${opt.numericAmount}, Insurance: ${opt.hasInsurance}`,
      sourceSpan: `Quote ID: ${opt.quote.id}, Transit Days: ${opt.quote.transitDays ?? "N/A"}`,
    }));
    evidenceItems.push(...TmsAccountContextBuilder.summarizeForEvidence(accountMemory).map((memory) => ({
      field: "accountOperatingMemory",
      extractedValue: memory.content,
      sourceSpan: `AccountMemory ${memory.memoryId} (${memory.sourceType})`,
    })));

    // 3. Create AgentDecision recommendation record
    const agentDecision = await db.agentDecision.create({
      data: {
        accountId: ctx.accountId,
        shipmentId: input.shipmentId,
        agentName: "CarrierRecommendationAgent",
        decisionSummary: `Recommended ${winner.carrier?.legalName ?? winner.quote.carrierId} at ${winner.quote.currency} ${winner.numericAmount}`,
        status: isHighConfidence ? "Completed" : "Review Required",
        triageState: isHighConfidence ? "AUTO_VERIFIED" : "NEEDS_REVIEW",
        confidence,
        rulesApplied: ["RATE_COMPARISON_V1", "CARRIER_INSURANCE_CHECK"],
        evidenceItems: evidenceItems as any,
        proposedDescription: `Recommended ${winner.carrier?.legalName ?? winner.quote.carrierId} at ${winner.quote.currency} ${winner.numericAmount}`,
      },
    });

    // Link decision to winning quote
    await db.freightQuote.update({
      where: { id: winner.quote.id },
      data: { agentDecisionId: agentDecision.id },
    });

    // 4. Record Audit Log
    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "CARRIER_RECOMMENDED",
      entity: "FreightQuote",
      entityId: winner.quote.id,
      source: "AGENT",
      metadata: {
        shipmentId: input.shipmentId,
        recommendedCarrierId: winner.quote.carrierId,
        amount: winner.numericAmount,
        confidence,
        agentDecisionId: agentDecision.id,
      },
    });

    return {
      recommendedQuote: winner.quote,
      recommendedCarrier: winner.carrier,
      agentDecision,
      allEvaluatedOptions: evaluatedOptions,
      outcome: "RECOMMENDED",
    };
  },
};
