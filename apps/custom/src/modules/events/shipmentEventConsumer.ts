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

          // Fetch real parse version & extraction fields from DB
          const extractionFields = await db.extractionField.findMany({
            where: { documentId: docId },
          });

          const extractedFieldsMap: Record<string, string> = {};
          const keyValuePairs: Array<{ label: string; value: string; confidence?: number; page?: number }> = [];

          for (const ef of extractionFields) {
            extractedFieldsMap[ef.fieldName] = ef.value;
            keyValuePairs.push({
              label: ef.fieldName,
              value: ef.value,
              confidence: ef.confidence ?? 95,
              page: ef.pageNumber ?? 1,
            });
          }

          let parseVerRecord = null;
          if (parseVersionId !== "latest") {
            parseVerRecord = await db.documentParseVersion.findFirst({
              where: { id: parseVersionId },
            });
          } else {
            parseVerRecord = await db.documentParseVersion.findFirst({
              where: { documentId: docId },
              orderBy: { version: "desc" },
            });
          }

          let tradeMetadata: Record<string, string> | undefined;
          let lineItems: Array<Record<string, unknown>> | undefined;

          if (parseVerRecord?.rawJson) {
            try {
              const json = typeof parseVerRecord.rawJson === "string"
                ? JSON.parse(parseVerRecord.rawJson)
                : (parseVerRecord.rawJson as any);
              if (json?.tradeMetadata) tradeMetadata = json.tradeMetadata;
              if (json?.lineItems) lineItems = json.lineItems;
            } catch {
              // Ignore invalid JSON
            }
          }

          const account = await db.account.findUnique({
            where: { id: event.accountId },
            select: { dataMode: true },
          }).catch(() => null);

          const dataMode = (account?.dataMode as "PRODUCTION" | "DEMO" | "SANDBOX") || "PRODUCTION";

          await HydrationWorker.processDocumentHydration(
            event.accountId,
            {
              documentId: docId,
              parseVersionId: parseVerRecord?.id || parseVersionId,
              extractedFields: extractedFieldsMap,
              tradeMetadata,
              lineItems,
              keyValuePairs,
            },
            {
              shipmentId: event.aggregateId,
              dataMode,
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
