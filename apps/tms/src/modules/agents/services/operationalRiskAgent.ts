import { db } from "@qubere/db";
import {
  buildStepMemory,
  createAgentDecision,
  loadJob,
  memoryLineage,
  trustedMemories,
  type StepResult,
} from "../shared/pipelineShared";

export async function runOperationalRisk(
  job: Awaited<ReturnType<typeof loadJob>>,
  documentId: string
): Promise<StepResult> {
  if (!job) throw new Error("Pipeline job not found.");
  const shipment = await db.shipment.findFirst({
    where: { id: job.shipmentId, accountId: job.accountId },
    include: { trackingEvents: { orderBy: { receivedAt: "desc" }, take: 1 }, exceptionItems: { where: { status: { in: ["Open", "OPEN"] } } }, customsFilings: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!shipment) throw new Error("Shipment not found.");
  const accountMemory = await buildStepMemory({
    accountId: job.accountId,
    task: "RISK_DETECTION",
    shipment: shipment as unknown as Record<string, unknown>,
    queryParts: [shipment.transportMode, shipment.countryOfExport, shipment.destinationCountry, shipment.carrierName, "tracking ETA promise last free day risk"],
  });
  const authoritativeMemory = trustedMemories(accountMemory);
  const rememberedNumber = (key: "trackingFreshnessHours" | "promiseRiskBufferHours" | "lfdRiskHours", fallback: number, min: number, max: number) => {
    const candidate = authoritativeMemory.map((memory) => memory.scope?.[key]).find((value) => typeof value === "number");
    return typeof candidate === "number" && Number.isFinite(candidate) && candidate >= min && candidate <= max ? candidate : fallback;
  };
  const trackingFreshnessHours = rememberedNumber("trackingFreshnessHours", 24, 1, 168);
  const promiseRiskBufferHours = rememberedNumber("promiseRiskBufferHours", 4, 0, 72);
  const lfdRiskHours = rememberedNumber("lfdRiskHours", 48, 1, 168);
  const latestTracking = shipment.trackingEvents[0];
  const trackingAgeHours = latestTracking ? (Date.now() - latestTracking.receivedAt.getTime()) / 3_600_000 : null;
  const eta = shipment.estimatedArrival;
  const promise = shipment.customerPromiseDate;
  const bufferHours = eta && promise ? (promise.getTime() - eta.getTime()) / 3_600_000 : null;
  const promiseState = bufferHours == null ? null : bufferHours < 0 ? "MISSED" : bufferHours < promiseRiskBufferHours ? "AT_RISK" : "ON_PROMISE";
  const hoursToLfd = shipment.lastFreeDay ? (shipment.lastFreeDay.getTime() - Date.now()) / 3_600_000 : null;
  const released = shipment.customsFilings[0]?.filingStatus?.toUpperCase() === "RELEASED";
  const riskReasons: string[] = [];
  if (trackingAgeHours == null) riskReasons.push("no tracking signal");
  else if (trackingAgeHours > trackingFreshnessHours) riskReasons.push(`tracking data is ${Math.round(trackingAgeHours)}h old`);
  if (promiseState === "MISSED") riskReasons.push("customer promise missed");
  else if (promiseState === "AT_RISK") riskReasons.push(`customer promise buffer below ${promiseRiskBufferHours}h`);
  if (hoursToLfd != null && hoursToLfd < lfdRiskHours && !released) riskReasons.push(`last free day within ${lfdRiskHours}h without customs release`);
  if (shipment.exceptionItems.length > 0) riskReasons.push(`${shipment.exceptionItems.length} open exception(s)`);
  const healthStatus = riskReasons.length === 0 ? "Healthy" : promiseState === "MISSED" || (hoursToLfd != null && hoursToLfd < 12) ? "Critical" : "At Risk";
  await db.shipment.update({ where: { id: shipment.id }, data: { promiseState, healthStatus } });
  const summary = riskReasons.length ? `Operational review found: ${riskReasons.join("; ")}.` : "No current schedule, LFD, tracking-freshness, customs, or exception risk was detected.";
  const decision = await createAgentDecision({
    accountId: job.accountId, shipmentId: job.shipmentId, documentId,
    agentName: "Operational Risk Agent", summary, confidence: latestTracking?.confidence == null ? null : Math.round(latestTracking.confidence), needsReview: riskReasons.length > 0,
    purpose: "Evaluate tracking freshness, customer promise, last free day, customs release, and active exceptions.",
    sources: ["TrackingEvent", "Shipment", "CustomsFiling", "ExceptionItem"],
    evidence: {
      trackingAgeHours,
      bufferHours,
      hoursToLfd,
      riskReasons,
      thresholds: { trackingFreshnessHours, promiseRiskBufferHours, lfdRiskHours },
      memoryRetrievalStatus: accountMemory.retrievalStatus,
      memories: memoryLineage(accountMemory),
    },
  });
  return {
    status: riskReasons.length ? "REVIEW_REQUIRED" : "SUCCESS",
    summary,
    confidence: latestTracking?.confidence == null ? null : Math.round(latestTracking.confidence),
    decisionId: decision.id,
    details: {
      riskReasons,
      healthStatus,
      thresholds: { trackingFreshnessHours, promiseRiskBufferHours, lfdRiskHours },
      memoryRetrievalStatus: accountMemory.retrievalStatus,
      memories: memoryLineage(accountMemory),
    },
  };
}
