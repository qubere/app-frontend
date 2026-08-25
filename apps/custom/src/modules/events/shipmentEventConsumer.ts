/**
 * Outbox Event Consumer for Shipment Aggregate Events — LLM Universal Field Hydration
 *
 * Processes pending outbox events for aggregateType: "SHIPMENT", executing universal
 * field hydration pipelines on DOCUMENT_PARSE_PROMOTED events.
 */

import { db } from "@qubere/db";
import { HydrationWorker } from "../hydration/orchestration/hydrationWorker";
import { HydrationLogger } from "../hydration/logging/hydrationLogger";

export interface OutboxDispatchResult {
  processedCount: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ eventId: string; error: string }>;
}

export class ShipmentEventConsumer {
  /**
   * Dispatches pending outbox events for aggregateType: "SHIPMENT".
   */
  public static async dispatchOutboxEvents(accountId?: string, limit: number = 50): Promise<OutboxDispatchResult> {
    const whereClause: any = {
      aggregateType: "SHIPMENT",
      status: "PENDING",
    };
    if (accountId) {
      whereClause.accountId = accountId;
    }

    const pendingEvents = await db.workflowOutboxEvent.findMany({
      where: whereClause,
      take: limit,
      orderBy: { createdAt: "asc" },
    });

    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ eventId: string; error: string }> = [];

    for (const event of pendingEvents) {
      try {
        if (event.eventType === "DOCUMENT_PARSE_PROMOTED") {
          const payload = typeof event.payload === "string" ? JSON.parse(event.payload) : (event.payload as any) || {};
          const docId = payload.documentId || event.aggregateId;
          const parseVersionId = payload.parseVersionId || "latest";

          HydrationLogger.info(`Dispatching outbox event ${event.id} for document ${docId}`, {
            eventId: event.id,
            accountId: event.accountId,
            documentId: docId,
          });

          await HydrationWorker.processDocumentHydration(
            event.accountId,
            {
              documentId: docId,
              parseVersionId,
              extractedFields: [] as any,
            },
            {
              shipmentId: event.aggregateId,
            }
          );
        }

        // Mark event as dispatched
        await db.workflowOutboxEvent.update({
          where: { id: event.id },
          data: {
            status: "DISPATCHED",
            dispatchedAt: new Date(),
          },
        });

        successCount++;
      } catch (err) {
        failedCount++;
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push({ eventId: event.id, error: errMsg });

        HydrationLogger.error(`Failed to process outbox event ${event.id}`, err, {
          eventId: event.id,
          accountId: event.accountId,
          eventType: event.eventType,
        });

        // Mark event as failed with retry counter
        await db.workflowOutboxEvent.update({
          where: { id: event.id },
          data: {
            status: "FAILED",
            lastError: errMsg,
            attemptCount: { increment: 1 },
          },
        }).catch(() => {});
      }
    }

    return {
      processedCount: pendingEvents.length,
      successCount,
      failedCount,
      errors,
    };
  }
}
