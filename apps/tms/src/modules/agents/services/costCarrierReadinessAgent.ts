import { db } from "@qubere/db";
import { TmsAccountContextBuilder } from "../../memory/memory.context-builder";
import {
  buildStepMemory,
  cleanString,
  createAgentDecision,
  loadJob,
  memoryLineage,
  trustedMemories,
  type StepResult,
} from "../shared/pipelineShared";

export async function runCostCarrierReadiness(
  job: Awaited<ReturnType<typeof loadJob>>,
  documentId: string
): Promise<StepResult> {
  if (!job) throw new Error("Pipeline job not found.");
  const shipment = await db.shipment.findFirst({
    where: { id: job.shipmentId, accountId: job.accountId },
    include: {
      freightQuotes: { orderBy: { createdAt: "desc" } },
      tenders: { orderBy: { createdAt: "desc" } },
      shipmentCharges: true,
      shipmentCosts: true,
      transportationOrders: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!shipment) throw new Error("Shipment not found.");
  const order = shipment.transportationOrders[0];
  const [carrierMemory, rateMemory] = await Promise.all([
    buildStepMemory({
      accountId: job.accountId,
      task: "CARRIER_SELECTION",
      shipment: shipment as unknown as Record<string, unknown>,
      order: order as unknown as Record<string, unknown> | undefined,
      queryParts: [shipment.transportMode, shipment.countryOfExport, shipment.destinationCountry, shipment.carrierName, "carrier tender preference"],
    }),
    buildStepMemory({
      accountId: job.accountId,
      task: "RATE_QUOTING",
      shipment: shipment as unknown as Record<string, unknown>,
      order: order as unknown as Record<string, unknown> | undefined,
      queryParts: [shipment.transportMode, shipment.countryOfExport, shipment.destinationCountry, shipment.importerName, "buy cost target margin"],
    }),
  ]);
  const preferredCarrier = trustedMemories(carrierMemory)
    .map((memory) => cleanString((memory.scope?.carrierName ?? memory.scope?.scac) as string | undefined))
    .find(Boolean) ?? null;
  const rememberedTargetMargin = TmsAccountContextBuilder.rememberedTargetMargin(rateMemory);
  const acceptedQuote = shipment.freightQuotes.find((quote) => quote.status === "ACCEPTED");
  const activeTender = shipment.tenders.find((tender) => ["SENT", "ACCEPTED"].includes(tender.status));
  const missing: string[] = [];
  if (!acceptedQuote) missing.push("accepted freight quote");
  if (!activeTender) missing.push("active carrier tender");
  if (shipment.shipmentCosts.length === 0 && shipment.expectedBuyCost == null) missing.push("expected buy cost");
  let summary = missing.length
    ? `Commercial execution is incomplete: ${missing.join(", ")}. No rate or tender was fabricated.`
    : `Accepted quote, carrier tender, and expected cost are present. Gross margin is ${shipment.grossMarginPct == null ? "not yet calculated" : `${Number(shipment.grossMarginPct).toFixed(1)}%`}.`;
  if (!activeTender && preferredCarrier) summary += ` Account memory identifies ${preferredCarrier} as a candidate, pending current-rate and operator validation.`;
  if (rememberedTargetMargin != null) summary += ` The approved account target margin is ${rememberedTargetMargin.toFixed(1)}%.`;
  const decision = await createAgentDecision({
    accountId: job.accountId, shipmentId: job.shipmentId, documentId,
    agentName: "Cost & Carrier Readiness Agent", summary, confidence: missing.length ? null : 100, needsReview: missing.length > 0,
    purpose: "Verify rate, cost, margin, and carrier commitment before execution.",
    sources: ["FreightQuote", "Tender", "ShipmentCost"],
    evidence: {
      missing,
      acceptedQuoteId: acceptedQuote?.id,
      activeTenderId: activeTender?.id,
      preferredCarrier,
      rememberedTargetMargin,
      memoryRetrievalStatus: [carrierMemory.retrievalStatus, rateMemory.retrievalStatus],
      memories: memoryLineage(carrierMemory, rateMemory),
    },
  });
  return {
    status: missing.length ? "REVIEW_REQUIRED" : "SUCCESS",
    summary,
    confidence: missing.length ? null : 100,
    decisionId: decision.id,
    details: {
      missing,
      preferredCarrier,
      rememberedTargetMargin,
      memoryRetrievalStatus: [carrierMemory.retrievalStatus, rateMemory.retrievalStatus],
      memories: memoryLineage(carrierMemory, rateMemory),
    },
  };
}
