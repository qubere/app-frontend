import type { AccountContext } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import { publishTransportationEvent } from "../../events/services/eventService";
import { TmsAccountContextBuilder } from "../../memory/memory.context-builder";

export interface EvidenceItem {
  field: string;
  extractedValue: string;
  sourceSpan: string;
  confidence: number;
}

export interface ParseIntakeRequestInput {
  rawText: string;
  inboundEmailId?: string | null;
  documentId?: string | null;
  requestedBy?: string | null;
  customerReference?: string | null;
  poReferences?: string[] | null;
  commodityDescription?: string | null;
  cargoSummary?: string | null;
  weight?: number | null;
  totalVolume?: number | null;
  mode?: "OCEAN" | "AIR" | "TRUCK" | "RAIL" | "DRAYAGE" | null;
  equipmentRequirements?: string[] | null;
  incoterm?: string | null;
  origin?: { name?: string; city?: string; country?: string; unlocode?: string } | null;
  destination?: { name?: string; city?: string; country?: string; unlocode?: string } | null;
  finalDeliveryLocation?: { name?: string; city?: string; state?: string } | null;
  customsRequired?: boolean;
  confidence?: number;
  evidenceItems?: EvidenceItem[];
}

export async function parseIntakeRequest(
  ctx: AccountContext,
  input: ParseIntakeRequestInput
) {
  const confidence = input.confidence ?? 85;
  const isHighConfidence = confidence >= 80;
  const status = isHighConfidence ? "UNDERSTOOD" : "NEEDS_REVIEW";
  const accountMemory = await TmsAccountContextBuilder.build({
    accountId: ctx.accountId,
    task: "FREIGHT_INTAKE",
    query: [input.requestedBy, input.customerReference, input.mode, input.origin?.unlocode, input.destination?.unlocode]
      .filter(Boolean)
      .join(" "),
    scope: {
      customerName: input.requestedBy ?? undefined,
      mode: input.mode ?? undefined,
      origin: input.origin?.unlocode ?? input.origin?.city,
      destination: input.destination?.unlocode ?? input.destination?.city,
    },
  });
  const rememberedDefaults = TmsAccountContextBuilder.rememberedIntakeDefaults(accountMemory);

  // Build structured order
  const order = await db.transportationOrder.create({
    data: {
      accountId: ctx.accountId,
      source: input.inboundEmailId ? "EMAIL" : input.documentId ? "DOCUMENT" : "API",
      inboundEmailId: input.inboundEmailId ?? null,
      rawRequestText: input.rawText,
      requestedBy: input.requestedBy ?? null,
      customerReference: input.customerReference ?? null,
      poReferences: input.poReferences ? (input.poReferences as any) : undefined,
      commodityDescription: input.commodityDescription ?? "General Cargo",
      cargoSummary: input.cargoSummary ?? input.rawText.slice(0, 100),
      weight: input.weight ?? null,
      totalWeight: input.weight ?? null,
      totalVolume: input.totalVolume ?? null,
      mode: input.mode ?? rememberedDefaults.mode ?? "OCEAN",
      serviceLevel: rememberedDefaults.serviceLevel ?? null,
      equipmentRequirements: input.equipmentRequirements
        ? (input.equipmentRequirements as any)
        : rememberedDefaults.equipment
          ? ([rememberedDefaults.equipment] as any)
          : undefined,
      incoterm: input.incoterm ?? rememberedDefaults.incoterm ?? null,
      customsRequired: input.customsRequired ?? rememberedDefaults.customsRequired ?? true,
      confidence,
      origin: input.origin ? (input.origin as any) : undefined,
      destination: input.destination ? (input.destination as any) : undefined,
      status,
    },
  });

  // Create AgentDecision record with evidence provenance
  const agentDecision = await db.agentDecision.create({
    data: {
      accountId: ctx.accountId,
      agentName: "FreightIntakeAgent",
      decisionSummary: `Parsed inbound request from ${input.requestedBy ?? "Unknown Sender"}`,
      status: isHighConfidence ? "Completed" : "Review Required",
      triageState: isHighConfidence ? "AUTO_VERIFIED" : "NEEDS_REVIEW",
      autoApproved: isHighConfidence,
      autoApprovalPolicy: isHighConfidence ? "freight-intake-auto-v1" : undefined,
      confidence,
      rulesApplied: ["INTAKE_EXTRACTION_V1", "EVIDENCE_PROVENANCE_V1"],
      evidenceItems: [
        ...(input.evidenceItems ?? []),
        ...TmsAccountContextBuilder.summarizeForEvidence(accountMemory).map((memory) => ({
          field: "accountOperatingMemory",
          extractedValue: memory.content,
          sourceSpan: `AccountMemory ${memory.memoryId} (${memory.sourceType})`,
          confidence: Math.round(memory.confidence * 100),
        })),
      ] as any,
      proposedDescription: `Proposed TransportationOrder ${order.id} (${input.mode ?? "OCEAN"}) with ${confidence}% confidence`,
    },
  });

  // Link agentDecision to order
  const updatedOrder = await db.transportationOrder.update({
    where: { id: order.id },
    data: { agentDecisionId: agentDecision.id },
  });

  // Publish TransportationEvent
  await publishTransportationEvent(ctx, {
    entityType: "TRANSPORTATION_ORDER",
    entityId: order.id,
    transportationOrderId: order.id,
    eventType: "ORDER_PARSED",
    source: input.inboundEmailId ? "EMAIL" : "API",
    confidence,
    payload: {
      status,
      mode: input.mode,
      requestedBy: input.requestedBy,
      equipment: input.equipmentRequirements,
      customsRequired: input.customsRequired ?? true,
    },
  });

  // Create Audit Log
  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "FREIGHT_ORDER_PARSED",
    entity: "TransportationOrder",
    entityId: order.id,
    source: "INTAKE_AGENT",
    metadata: {
      confidence,
      agentDecisionId: agentDecision.id,
      status,
    },
  });

  return {
    order: updatedOrder,
    agentDecision,
  };
}
