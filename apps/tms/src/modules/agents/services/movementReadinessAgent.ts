import { db } from "@qubere/db";
import {
  buildStepMemory,
  cleanString,
  createAgentDecision,
  loadJob,
  memoryLineage,
  trustedMemories,
  type StepResult,
} from "../shared/pipelineShared";

export async function runMovementReadiness(
  job: Awaited<ReturnType<typeof loadJob>>,
  documentId: string
): Promise<StepResult> {
  if (!job) throw new Error("Pipeline job not found.");
  const shipment = await db.shipment.findFirst({
    where: { id: job.shipmentId, accountId: job.accountId },
    include: {
      transportationOrders: { orderBy: { createdAt: "desc" }, take: 1 },
      shipmentMovements: { include: { movement: { include: { stops: true } } } },
      trackingIdentifiers: true,
      trackingEquipment: true,
    },
  });
  if (!shipment) throw new Error("Shipment not found.");
  const order = shipment.transportationOrders[0];
  const accountMemory = await buildStepMemory({
    accountId: job.accountId,
    task: "MOVEMENT_PLANNING",
    shipment: shipment as unknown as Record<string, unknown>,
    order: order as unknown as Record<string, unknown> | undefined,
    queryParts: [shipment.transportMode, shipment.countryOfExport, shipment.destinationCountry, shipment.carrierName, "movement equipment stops"],
  });
  const rememberedEquipment = trustedMemories(accountMemory)
    .map((memory) => cleanString(memory.scope?.equipment as string | undefined))
    .find(Boolean) ?? null;
  const missing: string[] = [];
  if (!shipment.transportMode && !order?.mode) missing.push("transport mode");
  if (!shipment.countryOfExport && !order?.origin) missing.push("origin");
  if (!shipment.destinationCountry && !order?.destination) missing.push("destination");
  if (!order?.equipmentRequirements && shipment.trackingEquipment.length === 0) missing.push("equipment requirement");
  if (shipment.trackingIdentifiers.length === 0) missing.push("carrier tracking reference");
  const hasPlan = shipment.shipmentMovements.length > 0;
  if (!hasPlan) missing.push("movement plan");
  let summary = missing.length
    ? `Movement is not execution-ready. Missing ${missing.join(", ")}. No carrier action was taken.`
    : `${shipment.shipmentMovements.length} movement plan(s) and ${shipment.trackingIdentifiers.length} tracking reference(s) are ready for execution.`;
  if (rememberedEquipment && missing.includes("equipment requirement")) {
    summary += ` Account memory suggests ${rememberedEquipment}, but it was not promoted without current-shipment confirmation.`;
  }
  const decision = await createAgentDecision({
    accountId: job.accountId, shipmentId: job.shipmentId, documentId,
    agentName: "Movement Readiness Agent", summary, confidence: missing.length ? null : 100, needsReview: missing.length > 0,
    purpose: "Verify that route, equipment, stops, and tracking references are sufficient to execute movement.",
    sources: ["Shipment", "TransportationOrder", "Movement", "TrackingIdentifier"],
    evidence: {
      missing,
      movementCount: shipment.shipmentMovements.length,
      rememberedEquipment,
      memoryRetrievalStatus: accountMemory.retrievalStatus,
      memories: memoryLineage(accountMemory),
    },
  });
  return {
    status: missing.length ? "REVIEW_REQUIRED" : "SUCCESS",
    summary,
    confidence: missing.length ? null : 100,
    decisionId: decision.id,
    details: { missing, rememberedEquipment, memoryRetrievalStatus: accountMemory.retrievalStatus, memories: memoryLineage(accountMemory) },
  };
}
