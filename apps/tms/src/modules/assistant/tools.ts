import { db } from "@qubere/db";
import { canWrite, type AccountContext } from "@qubere/auth";
import { createAuditLog } from "@qubere/decisions";
import { runRiskAgent } from "@/modules/agents/services/operationalAgents";
import { sweepPendingInvoices, runFreightAuditAgent } from "@/modules/invoices/services/freightAuditAgent";
import { autoDispatchTender } from "@/modules/tenders/services/tenderService";
import { evaluateRFQ } from "@/modules/rating/services/quoteService";
import { evaluateCarriersForShipment } from "@/modules/carriers/services/carrierSelectionService";
import { parseFreightEmailTool } from "@/modules/orders/tools/parseFreightEmailTool";
import { planMovementStopsTool } from "@/modules/movement/tools/planMovementStopsTool";
import { recommendCarrierTool } from "@/modules/rating/tools/recommendCarrierTool";
import { queueTmsMemoryEvent } from "../../lib/inngest/functions/tmsMemoryExtraction";

export interface AssistantToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  access?: { permission?: string; write?: boolean; confirmationRequired?: boolean };
  execute: (args: Record<string, any>, ctx: AccountContext) => Promise<unknown>;
}

export const availableAssistantTools: Record<string, AssistantToolDefinition> = {
  parse_freight_email: {
    name: parseFreightEmailTool.declaration.name,
    description: parseFreightEmailTool.declaration.description,
    parameters: parseFreightEmailTool.declaration.parameters as any,
    access:
      typeof parseFreightEmailTool.access === "object"
        ? parseFreightEmailTool.access
        : undefined,
    execute: async (args, ctx) => parseFreightEmailTool.execute(ctx, args),
  },

  plan_movement_stops: {
    name: planMovementStopsTool.declaration.name,
    description: planMovementStopsTool.declaration.description,
    parameters: planMovementStopsTool.declaration.parameters as any,
    access:
      typeof planMovementStopsTool.access === "object"
        ? planMovementStopsTool.access
        : undefined,
    execute: async (args, ctx) => planMovementStopsTool.execute(ctx, args),
  },

  recommend_carrier: {
    name: recommendCarrierTool.declaration.name,
    description: recommendCarrierTool.declaration.description,
    parameters: recommendCarrierTool.declaration.parameters as any,
    access:
      typeof recommendCarrierTool.access === "object"
        ? recommendCarrierTool.access
        : undefined,
    execute: async (args, ctx) => recommendCarrierTool.execute(ctx, args),
  },

  list_shipments: {
    name: "list_shipments",
    description: "List or search freight shipments with optional filters for transport mode, status, or promise risk.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status (e.g. In Progress, At Risk, Completed, DELIVERED)" },
        mode: { type: "string", description: "Filter by transport mode (OCEAN, AIR, TRUCK, RAIL)" },
        promiseState: { type: "string", description: "Filter by promise state (ON_PROMISE, AT_RISK, MISSED)" },
        riskOnly: { type: "boolean", description: "If true, returns only shipments flagged at risk or critical" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
    },
    execute: async (args, ctx) => {
      try {
        const accountId = ctx?.accountId;
        if (!accountId) return { count: 0, shipments: [] };

        const where: any = { accountId };
        if (args.status) where.status = args.status;
        if (args.mode) where.transportMode = args.mode.toUpperCase();
        if (args.promiseState) where.promiseState = args.promiseState;
        if (args.riskOnly) {
          where.OR = [
            { healthStatus: "At Risk" },
            { healthStatus: "Critical" },
            { promiseState: "AT_RISK" },
          ];
        }

        const shipments = await db.shipment.findMany({
          where,
          take: args.limit || 10,
          orderBy: { createdAt: "desc" },
        });
        const openExceptions = await db.exceptionItem.findMany({
          where: {
            accountId,
            shipmentId: { in: shipments.map((shipment) => shipment.id) },
            status: { in: ["Open", "OPEN"] },
          },
          select: { shipmentId: true },
        });
        const exceptionCountByShipment = openExceptions.reduce<Record<string, number>>(
          (counts, item) => {
            if (item.shipmentId) counts[item.shipmentId] = (counts[item.shipmentId] ?? 0) + 1;
            return counts;
          },
          {}
        );

        return {
          count: shipments.length,
          shipments: shipments.map((s) => ({
            id: s.id,
            shipmentNumber: s.shipmentNumber,
            status: s.status,
            mode: s.transportMode,
            promiseState: s.promiseState ?? "ON_PROMISE",
            healthStatus: s.healthStatus ?? "Healthy",
            origin: s.portOfEntry || "Origin",
            estimatedArrival: s.estimatedArrival ? new Date(s.estimatedArrival).toISOString() : undefined,
            customerPromiseDate: s.customerPromiseDate ? new Date(s.customerPromiseDate).toISOString() : undefined,
            demurrageExposureUsd: s.demurrageExposureUsd ? Number(s.demurrageExposureUsd) : 0,
            exceptionCount: exceptionCountByShipment[s.id] ?? 0,
          })),
        };
      } catch {
        return { count: 0, shipments: [] };
      }
    },
  },

  list_orders: {
    name: "list_orders",
    description: "List freight orders and transportation requests awaiting quoting or dispatch.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status (OPEN, QUOTED, DISPATCHED, DELIVERED)" },
      },
    },
    execute: async (args, ctx) => {
      try {
        const accountId = ctx?.accountId;
        if (!accountId) return { count: 0, orders: [] };

        const orders = await db.transportationOrder.findMany({
          where: { accountId, ...(args.status ? { status: args.status } : {}) },
          take: 10,
          orderBy: { createdAt: "desc" },
        });

        return {
          count: orders.length,
          orders: orders.map((o) => ({
            id: o.id,
            orderNumber: o.customerReference || o.externalReference || `ORD-${o.id.slice(-6).toUpperCase()}`,
            status: o.status,
            mode: o.mode,
            requestedBy: o.requestedBy,
            origin: o.origin,
            destination: o.destination,
          })),
        };
      } catch {
        return { count: 0, orders: [] };
      }
    },
  },

  list_carriers: {
    name: "list_carriers",
    description: "Query contracted carriers, DOT numbers, performance scores, and OTD metrics.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", description: "Filter by mode (TRUCK, OCEAN, AIR)" },
        minScore: { type: "number", description: "Minimum performance score (0-100)" },
      },
    },
    execute: async (args, ctx) => {
      try {
        if (!ctx?.accountId) return { count: 0, carriers: [] };
        const scoredCarriers = await evaluateCarriersForShipment(ctx, {
          mode: args.mode || "OCEAN",
          requireInsurance: true,
        });

        return {
          count: scoredCarriers.length,
          carriers: scoredCarriers.map((c) => ({
            carrierId: c.carrierId,
            name: c.carrierName,
            scac: c.scac,
            score: c.score,
            isEligible: c.isEligible,
            isPreferred: c.isPreferred,
            onTimeDeliveryRate: `${c.onTimeDeliveryRate}%`,
            tenderAcceptanceRate: `${c.tenderAcceptanceRate}%`,
          })),
        };
      } catch {
        return { count: 0, carriers: [] };
      }
    },
  },

  list_exceptions: {
    name: "list_exceptions",
    description: "Fetch open operational exceptions (demurrage risks, LFD, customs hold, missing documents).",
    parameters: {
      type: "object",
      properties: {
        severity: { type: "string", description: "Filter by severity (Critical, High, Medium, Low)" },
      },
    },
    execute: async (args, ctx) => {
      try {
        const accountId = ctx?.accountId;
        if (!accountId) return { count: 0, exceptions: [] };

        const exceptions = await db.exceptionItem.findMany({
          where: {
            accountId,
            status: "Open",
            ...(args.severity ? { severity: args.severity } : {}),
          },
          take: 10,
          orderBy: { createdAt: "desc" },
          include: { shipment: { select: { shipmentNumber: true } } },
        });

        return {
          count: exceptions.length,
          exceptions: exceptions.map((e) => ({
            id: e.id,
            shipmentNumber: e.shipment?.shipmentNumber ?? e.shipmentId,
            type: e.type,
            severity: e.severity,
            description: e.description,
            requiredAction: e.requiredAction,
          })),
        };
      } catch {
        return { count: 0, exceptions: [] };
      }
    },
  },

  run_risk_sweep: {
    name: "run_risk_sweep",
    description: "Trigger the Risk Agent to sweep all active shipments for LFD, demurrage, and customer promise risks.",
    parameters: {
      type: "object",
      properties: {
        confirm: { type: "boolean", description: "Explicit confirmation to run the mutating risk sweep" },
      },
      required: ["confirm"],
    },
    access: {
      permission: "decisions.reevaluate",
      write: true,
      confirmationRequired: true,
    },
    execute: async (_, ctx) => {
      const mockCtx = ctx;
      const result = await runRiskAgent(mockCtx);
      return {
        success: true,
        evaluated: result.evaluated,
        exceptionsCreated: result.exceptionsCreated,
        message: `Risk sweep completed. Evaluated ${result.evaluated} shipments and flagged ${result.exceptionsCreated} risk items.`,
      };
    },
  },

  run_freight_audit: {
    name: "run_freight_audit",
    description: "Trigger the Freight Audit Agent to perform 3-way matching on all pending carrier invoices.",
    parameters: {
      type: "object",
      properties: {
        carrierInvoiceId: { type: "string", description: "Optional specific invoice ID to audit" },
      },
    },
    access: {
      permission: "carrier_invoices.match",
      write: true,
      confirmationRequired: true,
    },
    execute: async (args, ctx) => {
      const mockCtx = ctx;
      if (args.carrierInvoiceId) {
        const single = await runFreightAuditAgent(mockCtx, args.carrierInvoiceId);
        return {
          success: true,
          mode: "SINGLE",
          carrierInvoiceId: single.carrierInvoiceId,
          auditStatus: single.auditStatus,
          autoApproved: single.autoApproved,
          notes: single.notes,
        };
      }

      const sweep = await sweepPendingInvoices(mockCtx);
      return {
        success: true,
        mode: "SWEEP",
        evaluated: sweep.evaluated,
        autoApproved: sweep.autoApproved,
        escalated: sweep.escalated,
        errors: sweep.errors,
      };
    },
  },

  auto_dispatch_tender: {
    name: "auto_dispatch_tender",
    description: "Run the Tender Agent to select an eligible carrier and create an unsent tender draft under policy controls.",
    parameters: {
      type: "object",
      properties: {
        shipmentId: { type: "string", description: "Shipment ID to auto-dispatch tender for" },
        confirm: { type: "boolean", description: "Explicit confirmation to create the tender draft" },
      },
      required: ["shipmentId", "confirm"],
    },
    access: {
      permission: "tenders.send",
      write: true,
      confirmationRequired: true,
    },
    execute: async (args, ctx) => {
      const mockCtx = ctx;
      const result = await autoDispatchTender(mockCtx, args.shipmentId);
      return result;
    },
  },

  quote_rfq: {
    name: "quote_rfq",
    description: "Run the Quote Agent to evaluate rates, lane intelligence, and propose a customer quote for an order.",
    parameters: {
      type: "object",
      properties: {
        transportationOrderId: { type: "string", description: "Transportation Order ID to evaluate RFQ for" },
        targetMarginPercent: { type: "number", description: "Target margin % (default 15%)" },
        confirm: { type: "boolean", description: "Explicit confirmation to create the quote proposal" },
      },
      required: ["transportationOrderId", "confirm"],
    },
    access: {
      permission: "transportation_orders.write",
      write: true,
      confirmationRequired: true,
    },
    execute: async (args, ctx) => {
      const mockCtx = ctx;
      const result = await evaluateRFQ(mockCtx, {
        transportationOrderId: args.transportationOrderId,
        targetMarginPercent: args.targetMarginPercent,
      });

      return {
        quoteId: result.quote.id,
        carrierName: result.quote.carrierName,
        buyAmount: Number(result.quote.buyAmount),
        sellAmount: Number(result.quote.sellAmount),
        margin: Number(result.quote.margin),
        approvalState: result.quote.approvalState,
        laneConfidence: result.laneIntelligence.confidence,
      };
    },
  },

  resolve_work_item: {
    name: "resolve_work_item",
    description: "Resolve an operational exception or approve/reject an agent policy decision.",
    parameters: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Work item ID (ExceptionItem ID or AgentDecision ID)" },
        action: { type: "string", description: "Action to take: 'approve', 'reject', or 'resolve'" },
        note: { type: "string", description: "Resolution note or justification" },
      },
      required: ["itemId", "action"],
    },
    access: { write: true, confirmationRequired: true },
    execute: async (args, ctx) => {
      const accountId = ctx.accountId;
      if (!accountId) return { success: false, error: "No active tenant account context." };
      const { itemId, action, note } = args as {
        itemId: string;
        action: "approve" | "reject" | "resolve";
        note?: string;
      };

      // Try AgentDecision
      const decision = await db.agentDecision.findFirst({
        where: { id: itemId, accountId },
      }).catch(() => null);

      if (decision) {
        if (action === "resolve") {
          return { success: false, error: "Agent decisions must be approved or rejected." };
        }
        const requiredPermission =
          action === "approve" ? "decisions.approve" : "decisions.reject";
        if (!ctx.isPlatformAdmin && !ctx.permissions.includes(requiredPermission)) {
          return { success: false, error: `Missing permission '${requiredPermission}'.` };
        }
        await db.agentDecision.update({
          where: { id: itemId },
          data: {
            autoApproved: false,
            status: action === "approve" ? "Approved" : "Rejected",
            triageState: action === "approve" ? "APPROVED" : "REJECTED",
            reviewedByUserId: ctx.userId,
            blockedReason: action === "reject" ? note || "Rejected by operator" : null,
          },
        });
        await createAuditLog({
          accountId,
          userId: ctx.userId,
          action: action === "approve" ? "AGENT_DECISION_APPROVED" : "AGENT_DECISION_REJECTED",
          entity: "AgentDecision",
          entityId: itemId,
          source: "SYSTEM",
          metadata: { channel: "ASSISTANT", note: note ?? null },
        });
        await queueTmsMemoryEvent({
          kind: "DECISION_REVIEWED",
          accountId,
          eventId: crypto.randomUUID(),
          decisionId: itemId,
          action: action === "approve" ? "approve" : "reject",
          note,
        }).catch((error) =>
          console.error("[TMS memory] Failed to enqueue assistant decision review", error)
        );
        return { success: true, type: "DECISION", action: action.toUpperCase(), itemId };
      }

      // Try ExceptionItem
      const exception = await db.exceptionItem.findFirst({
        where: { id: itemId, accountId },
      }).catch(() => null);

      if (exception) {
        if (action !== "resolve") {
          return { success: false, error: "Exceptions must use the resolve action." };
        }
        if (!ctx.isPlatformAdmin && !ctx.permissions.includes("exceptions.resolve")) {
          return { success: false, error: "Missing permission 'exceptions.resolve'." };
        }
        if (!note?.trim()) {
          return { success: false, error: "A resolution note is required." };
        }
        await db.exceptionItem.update({
          where: { id: itemId },
          data: {
            status: "Resolved",
            resolvedAt: new Date(),
            resolvedBy: ctx.userId,
            resolutionNote: note,
          },
        });
        await createAuditLog({
          accountId,
          userId: ctx.userId,
          action: "EXCEPTION_RESOLVED",
          entity: "ExceptionItem",
          entityId: itemId,
          source: "SYSTEM",
          metadata: { channel: "ASSISTANT", note },
        });
        await queueTmsMemoryEvent({
          kind: "EXCEPTION_RESOLVED",
          accountId,
          eventId: crypto.randomUUID(),
          exceptionId: itemId,
        }).catch((error) =>
          console.error("[TMS memory] Failed to enqueue assistant resolution", error)
        );
        return { success: true, type: "EXCEPTION", action: "RESOLVED", itemId };
      }

      return { success: false, error: `Work item ${itemId} not found.` };
    },
  },
};

export async function executeAssistantTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AccountContext
): Promise<unknown> {
  const tool = availableAssistantTools[name];
  if (!tool) throw new Error(`Assistant tool '${name}' is not registered.`);

  if (
    tool.access?.permission &&
    !ctx.isPlatformAdmin &&
    !ctx.permissions.includes(tool.access.permission)
  ) {
    throw new Error(
      `Assistant tool '${name}' requires permission '${tool.access.permission}'.`
    );
  }
  if (tool.access?.write && !canWrite(ctx)) {
    throw new Error(`Assistant tool '${name}' is not available to read-only users.`);
  }
  if (tool.access?.confirmationRequired && args.confirm !== true) {
    throw new Error(`Assistant tool '${name}' requires explicit confirmation.`);
  }

  return tool.execute(args, ctx);
}
