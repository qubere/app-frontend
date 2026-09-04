import { db } from "@/lib/db";
import { HydrationLogger } from "../hydration/logging/hydrationLogger";
import type { Prisma } from "@prisma/client";

export type ShipmentEventType =
  | "SHIPMENT_CREATED"
  | "USER_FIELD_UPDATED"
  | "DOCUMENT_UPLOADED"
  /** The parser finished and its run became the document's active version. */
  | "DOCUMENT_READY_FOR_CLASSIFICATION"
  | "DOCUMENT_EXTRACTED"
  | "DOCUMENT_PARSE_PROMOTED"
  | "RECONCILIATION_REQUESTED"
  | "CONFLICT_DETECTED"
  | "EXCEPTION_RESOLVED"
  | "AGENT_EXECUTION_TRIGGERED"
  | "DOCUMENT_HYDRATION_PROMOTED"
  | "FILING_SUBMITTED";

export interface LogEventParams {
  shipmentId: string;
  eventType: ShipmentEventType;
  payload?: Record<string, unknown>;
  triggeredBy?: string;
  accountId?: string;
  eventKey?: string;
  required?: boolean;
}

export class ShipmentEventBus {
  /**
   * Logs a domain event durably in ShipmentEventLog and enqueues to WorkflowOutboxEvent
   */
  static async logEvent(params: LogEventParams, tx?: Prisma.TransactionClient) {
    const write = async (client: Prisma.TransactionClient) => {
      const eventLog = await client.shipmentEventLog.create({
        data: {
          shipmentId: params.shipmentId,
          eventType: params.eventType,
          payload: params.payload ? JSON.parse(JSON.stringify(params.payload)) : undefined,
          triggeredBy: params.triggeredBy || "SYSTEM",
        },
      });

      const accountId = params.accountId || (params.payload?.accountId as string);
      if (!accountId) {
        throw new Error(`accountId is required for durable shipment event '${params.eventType}'.`);
      }
      const eventKey = params.eventKey || `evt_${params.shipmentId}_${params.eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      await client.workflowOutboxEvent.create({
        data: {
          accountId,
          eventKey,
          eventType: params.eventType,
          aggregateType: "SHIPMENT",
          aggregateId: params.shipmentId,
          payload: params.payload ? JSON.parse(JSON.stringify(params.payload)) : {},
          status: "PENDING",
        },
      });

      return eventLog;
    };

    try {
      return tx ? await write(tx) : await db.$transaction(write);
    } catch (err) {
      HydrationLogger.error(`Failed to durably log shipment event [${params.eventType}]`, err, {
        shipmentId: params.shipmentId,
        eventType: params.eventType,
      });
      if (params.required) throw err;
      return null;
    }
  }
}
