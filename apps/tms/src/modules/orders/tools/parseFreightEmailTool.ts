import { z } from "zod";
import type { AssistantTool } from "@qubere/assistant";
import type { AccountContext } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import { publishTransportationEvent } from "../../events/services/eventService";
import { TmsAccountContextBuilder } from "../../memory/memory.context-builder";

export const parseFreightEmailSchema = z.object({
  inboundEmailId: z.string().optional().nullable(),
  rawText: z.string(),
  requestedBy: z.string().optional().nullable(),
  customerReference: z.string().optional().nullable(),
  poReferences: z.array(z.string()).optional().nullable(),
  commodityDescription: z.string().optional().nullable(),
  cargoSummary: z.string().optional().nullable(),
  weight: z.number().optional().nullable(),
  totalVolume: z.number().optional().nullable(),
  mode: z.string().optional().nullable(),
  serviceLevel: z.string().optional().nullable(),
  incoterm: z.string().optional().nullable(),
  customsRequired: z.boolean().optional().default(true),
  originAddress: z.record(z.string(), z.unknown()).optional().nullable(),
  destinationAddress: z.record(z.string(), z.unknown()).optional().nullable(),
  requestedPickupWindow: z.record(z.string(), z.unknown()).optional().nullable(),
  requestedDeliveryWindow: z.record(z.string(), z.unknown()).optional().nullable(),
  confidence: z.number().min(0).max(100),
  evidenceItems: z.array(
    z.object({
      field: z.string(),
      extractedValue: z.string(),
      sourceSpan: z.string(),
    })
  ),
});

export type ParseFreightEmailInput = z.infer<typeof parseFreightEmailSchema>;

export const parseFreightEmailTool: AssistantTool = {
  access: {
    permission: "transportationOrders.write",
    write: true,
    confirmationRequired: true,
  },
  declaration: {
    name: "parse_freight_email",
    description:
      "Parses an inbound freight email into a structured TransportationOrder proposal with field confidence scores and text evidence spans.",
    parameters: {
      type: "OBJECT",
      properties: {
        rawText: { type: "STRING", description: "Raw body text of the inbound email" },
      },
      required: ["rawText"],
    },
  },
  schema: parseFreightEmailSchema as any,
  execute: async (ctx: AccountContext, args: Record<string, unknown>) => {
    const input = parseFreightEmailSchema.parse(args);

    const autoThreshold = 80;
    const isHighConfidence = input.confidence >= autoThreshold;
    const accountMemory = await TmsAccountContextBuilder.build({
      accountId: ctx.accountId,
      task: "FREIGHT_INTAKE",
      query: [input.requestedBy, input.customerReference, input.mode].filter(Boolean).join(" "),
      scope: {
        customerName: input.requestedBy ?? undefined,
        mode: input.mode ?? undefined,
      },
    });
    const rememberedDefaults = TmsAccountContextBuilder.rememberedIntakeDefaults(accountMemory);

    // 1. Create TransportationOrder
    const orderStatus = isHighConfidence ? "UNDERSTOOD" : "NEEDS_REVIEW";
    const order = await db.transportationOrder.create({
      data: {
        accountId: ctx.accountId,
        source: "EMAIL",
        inboundEmailId: input.inboundEmailId ?? null,
        customerReference: input.customerReference ?? null,
        poReferences: input.poReferences ? (input.poReferences as any) : undefined,
        rawRequestText: input.rawText,
        requestedBy: input.requestedBy ?? null,
        commodityDescription: input.commodityDescription ?? null,
        cargoSummary: input.cargoSummary ?? null,
        weight: input.weight ?? null,
        totalWeight: input.weight ?? null,
        totalVolume: input.totalVolume ?? null,
        mode: input.mode ?? rememberedDefaults.mode ?? null,
        serviceLevel: input.serviceLevel ?? rememberedDefaults.serviceLevel ?? null,
        equipmentRequirements: rememberedDefaults.equipment ? ([rememberedDefaults.equipment] as any) : undefined,
        incoterm: input.incoterm ?? rememberedDefaults.incoterm ?? null,
        customsRequired: input.customsRequired ?? rememberedDefaults.customsRequired ?? true,
        confidence: input.confidence,
        originAddress: input.originAddress ? (input.originAddress as any) : undefined,
        destinationAddress: input.destinationAddress ? (input.destinationAddress as any) : undefined,
        origin: input.originAddress ? (input.originAddress as any) : undefined,
        destination: input.destinationAddress ? (input.destinationAddress as any) : undefined,
        requestedPickupWindow: input.requestedPickupWindow ? (input.requestedPickupWindow as any) : undefined,
        requestedDeliveryWindow: input.requestedDeliveryWindow ? (input.requestedDeliveryWindow as any) : undefined,
        status: orderStatus,
      },
    });

    // 2. Create AgentDecision record
    const agentDecision = await db.agentDecision.create({
      data: {
        accountId: ctx.accountId,
        agentName: "FreightEmailIntakeAgent",
        decisionSummary: `Parsed email request from ${input.requestedBy ?? "Unknown Sender"}`,
        status: isHighConfidence ? "Completed" : "Review Required",
        triageState: isHighConfidence ? "AUTO_VERIFIED" : "NEEDS_REVIEW",
        confidence: input.confidence,
        rulesApplied: ["EMAIL_INTAKE_V1"],
        evidenceItems: [
          ...input.evidenceItems,
          ...TmsAccountContextBuilder.summarizeForEvidence(accountMemory).map((memory) => ({
            field: "accountOperatingMemory",
            extractedValue: memory.content,
            sourceSpan: `AccountMemory ${memory.memoryId} (${memory.sourceType})`,
            confidence: Math.round(memory.confidence * 100),
          })),
        ] as any,
        proposedDescription: `TransportationOrder ${order.id} proposed with confidence ${input.confidence}%`,
      },
    });

    // Update order with agentDecisionId
    await db.transportationOrder.update({
      where: { id: order.id },
      data: { agentDecisionId: agentDecision.id },
    });

    // 3. Publish TransportationEvent
    await publishTransportationEvent(ctx, {
      entityType: "TRANSPORTATION_ORDER",
      entityId: order.id,
      transportationOrderId: order.id,
      eventType: "ORDER_PARSED",
      source: "EMAIL",
      confidence: input.confidence,
      payload: { status: orderStatus, requestedBy: input.requestedBy },
    });

    // 4. Audit Log
    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "FREIGHT_EMAIL_PARSED",
      entity: "TransportationOrder",
      entityId: order.id,
      source: "EMAIL",
      metadata: {
        confidence: input.confidence,
        agentDecisionId: agentDecision.id,
      },
    });

    return {
      order: { ...order, agentDecisionId: agentDecision.id },
      agentDecision,
    };
  },
};
