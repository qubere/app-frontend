import { db } from "@/lib/db";
import { HydrationLogger } from "../hydration/logging/hydrationLogger";

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
}

export class ShipmentEventBus {
  /**
   * Logs a domain event durably in ShipmentEventLog and enqueues to WorkflowOutboxEvent
   */
  static async logEvent(params: LogEventParams) {
    try {
      const eventLog = await db.shipmentEventLog.create({
        data: {
          shipmentId: params.shipmentId,
          eventType: params.eventType,
          payload: params.payload ? JSON.parse(JSON.stringify(params.payload)) : undefined,
          triggeredBy: params.triggeredBy || "SYSTEM",
        },
      });

      // Enqueue to durable workflow outbox queue
      const accountId = params.accountId || (params.payload?.accountId as string) || "system";
      const eventKey = `evt_${params.shipmentId}_${params.eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      await db.workflowOutboxEvent.create({
        data: {
          accountId,
          eventKey,
          eventType: params.eventType,
          aggregateType: "SHIPMENT",
          aggregateId: params.shipmentId,
          payload: params.payload ? JSON.parse(JSON.stringify(params.payload)) : {},
          status: "PENDING",
        },
      }).catch((err) => {
        HydrationLogger.warn(`Outbox event enqueue fallback for ${params.eventType}`, {
          shipmentId: params.shipmentId,
          eventType: params.eventType,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      return eventLog;
    } catch (err) {
      console.error(`Failed to log shipment event [${params.eventType}]:`, err);
      return null;
    }
  }
}
