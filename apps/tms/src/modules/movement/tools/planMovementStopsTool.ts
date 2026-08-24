import { z } from "zod";
import type { AssistantTool } from "@qubere/assistant";
import type { AccountContext } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import { TmsAccountContextBuilder } from "../../memory/memory.context-builder";

export const planMovementStopsSchema = z.object({
  shipmentId: z.string(),
  legs: z.array(
    z.object({
      sequence: z.number().int().min(1),
      mode: z.string(),
      carrierName: z.string().optional().nullable(),
      carrierCode: z.string().optional().nullable(),
      plannedDeparture: z.string().optional().nullable(),
      plannedArrival: z.string().optional().nullable(),
    })
  ),
  stops: z.array(
    z.object({
      sequence: z.number().int().min(1),
      type: z.enum(["PICKUP", "DELIVERY", "WAYPOINT"]),
      name: z.string().optional().nullable(),
      unlocode: z.string().optional().nullable(),
      plannedArrival: z.string().optional().nullable(),
      plannedDeparture: z.string().optional().nullable(),
    })
  ),
  confidence: z.number().min(0).max(100),
  evidenceItems: z.array(
    z.object({
      field: z.string(),
      extractedValue: z.string(),
      sourceSpan: z.string(),
    })
  ),
});

export type PlanMovementStopsInput = z.infer<typeof planMovementStopsSchema>;

export const planMovementStopsTool: AssistantTool = {
  access: {
    permission: "transportation_orders.write",
    write: true,
    confirmationRequired: true,
  },
  declaration: {
    name: "plan_movement_stops",
    description:
      "Proposes TransportLeg and ShipmentStop records for a shipment with confidence scoring and routing evidence.",
    parameters: {
      type: "OBJECT",
      properties: {
        shipmentId: { type: "STRING", description: "Target shipment ID" },
      },
      required: ["shipmentId"],
    },
  },
  schema: planMovementStopsSchema as any,
  execute: async (ctx: AccountContext, args: Record<string, unknown>) => {
    const input = planMovementStopsSchema.parse(args);

    const autoThreshold = 80;
    const isHighConfidence = input.confidence >= autoThreshold;
    const accountMemory = await TmsAccountContextBuilder.build({
      accountId: ctx.accountId,
      task: "MOVEMENT_PLANNING",
      query: [
        ...input.legs.flatMap((leg) => [leg.mode, leg.carrierName, leg.carrierCode]),
        ...input.stops.flatMap((stop) => [stop.type, stop.name, stop.unlocode]),
      ].filter(Boolean).join(" "),
      scope: {
        shipmentId: input.shipmentId,
        mode: input.legs[0]?.mode,
        origin: input.stops[0]?.unlocode ?? input.stops[0]?.name ?? undefined,
        destination: input.stops.at(-1)?.unlocode ?? input.stops.at(-1)?.name ?? undefined,
      },
    });

    // 1. Create AgentDecision record
    const agentDecision = await db.agentDecision.create({
      data: {
        accountId: ctx.accountId,
        shipmentId: input.shipmentId,
        agentName: "MovementPlannerAgent",
        decisionSummary: `Planned ${input.legs.length} legs and ${input.stops.length} stops`,
        status: isHighConfidence ? "Completed" : "Review Required",
        triageState: isHighConfidence ? "AUTO_VERIFIED" : "NEEDS_REVIEW",
        confidence: input.confidence,
        rulesApplied: ["MOVEMENT_PLAN_V1"],
        evidenceItems: [
          ...input.evidenceItems,
          ...TmsAccountContextBuilder.summarizeForEvidence(accountMemory).map((memory) => ({
            field: "accountOperatingMemory",
            extractedValue: memory.content,
            sourceSpan: `AccountMemory ${memory.memoryId} (${memory.sourceType})`,
          })),
        ] as any,
        proposedDescription: `Planned ${input.legs.length} legs and ${input.stops.length} stops for shipment ${input.shipmentId}`,
      },
    });

    // 2. Persist TransportLeg records
    const createdLegs = [];
    for (const leg of input.legs) {
      const createdLeg = await db.transportLeg.create({
        data: {
          accountId: ctx.accountId,
          shipmentId: input.shipmentId,
          sequence: leg.sequence,
          mode: (leg.mode.toUpperCase() as any) || "TRUCK",
          carrierName: leg.carrierName ?? null,
          carrierCode: leg.carrierCode ?? null,
          plannedDeparture: leg.plannedDeparture ? new Date(leg.plannedDeparture) : null,
          plannedArrival: leg.plannedArrival ? new Date(leg.plannedArrival) : null,
          status: "PLANNED",
        },
      });
      createdLegs.push(createdLeg);
    }

    // 3. Persist ShipmentStop records
    const createdStops = [];
    for (const stop of input.stops) {
      const createdStop = await db.shipmentStop.create({
        data: {
          accountId: ctx.accountId,
          shipmentId: input.shipmentId,
          sequence: stop.sequence,
          type: stop.type,
          name: stop.name ?? stop.unlocode ?? `Stop ${stop.sequence}`,
          unlocode: stop.unlocode ?? null,
          plannedArrival: stop.plannedArrival ? new Date(stop.plannedArrival) : null,
          plannedDeparture: stop.plannedDeparture ? new Date(stop.plannedDeparture) : null,
        },
      });
      createdStops.push(createdStop);
    }

    // 4. Audit Log
    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "MOVEMENT_STOPS_PLANNED",
      entity: "Shipment",
      entityId: input.shipmentId,
      source: "AGENT",
      metadata: {
        legsCount: createdLegs.length,
        stopsCount: createdStops.length,
        confidence: input.confidence,
        agentDecisionId: agentDecision.id,
      },
    });

    return {
      agentDecision,
      legs: createdLegs,
      stops: createdStops,
    };
  },
};
