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

const OUTBOX_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

function retryAt(attempt: number): Date {
  return new Date(Date.now() + Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, attempt - 1)));
}

export class ShipmentEventConsumer {
  /**
   * Dispatches pending outbox events for aggregateType: "SHIPMENT".
   */
  public static async dispatchOutboxEvents(accountId?: string, limit: number = 50): Promise<OutboxDispatchResult> {
    const now = new Date();
    const staleLock = new Date(now.getTime() - OUTBOX_LOCK_TIMEOUT_MS);
    const whereClause: any = {
      aggregateType: "SHIPMENT",
      OR: [
        { status: "PENDING", nextAttemptAt: { lte: now } },
        { status: "FAILED", nextAttemptAt: { lte: now } },
        { status: "DISPATCHING", lockedAt: { lt: staleLock } },
      ],
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
      if (event.attemptCount >= event.maxAttempts) continue;
      const claimed = await db.workflowOutboxEvent.updateMany({
        where: {
          id: event.id,
          attemptCount: { lt: event.maxAttempts },
          OR: [
            { status: "PENDING", nextAttemptAt: { lte: now } },
            { status: "FAILED", nextAttemptAt: { lte: now } },
            { status: "DISPATCHING", lockedAt: { lt: staleLock } },
          ],
        },
        data: {
          status: "DISPATCHING",
          lockedAt: new Date(),
          lastError: null,
          attemptCount: { increment: 1 },
        },
      });
      if (claimed.count !== 1) continue;

      try {
        if (event.eventType === "DOCUMENT_PARSE_PROMOTED") {
          const payload = typeof event.payload === "string" ? JSON.parse(event.payload) : (event.payload as any) || {};
          const docId = payload.documentId || event.aggregateId;
          const parseVersionId = payload.parseVersionId || "latest";

          const document = await db.shipmentDocument.findFirst({
            where: {
              id: docId,
              accountId: event.accountId,
              shipmentId: event.aggregateId,
            },
            select: { id: true, activeParseVersionId: true },
          });
          if (!document) {
            throw new Error(`Document '${docId}' is not attached to the tenant-owned shipment '${event.aggregateId}'.`);
          }

          if (
            parseVersionId !== "latest" &&
            document.activeParseVersionId &&
            document.activeParseVersionId !== parseVersionId
          ) {
            HydrationLogger.info(`Skipping superseded parse event ${event.id}`, {
              eventId: event.id,
              documentId: docId,
              parseVersionId,
              activeParseVersionId: document.activeParseVersionId,
            });
            await db.workflowOutboxEvent.update({
              where: { id: event.id },
              data: { status: "DISPATCHED", dispatchedAt: new Date(), lockedAt: null },
            });
            successCount++;
            continue;
          }

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
              where: { id: parseVersionId, documentId: docId, accountId: event.accountId },
            });
          } else {
            parseVerRecord = await db.documentParseVersion.findFirst({
              where: { documentId: docId, accountId: event.accountId },
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
            lockedAt: null,
            lastError: null,
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
            lockedAt: null,
            nextAttemptAt: retryAt(event.attemptCount + 1),
          },
        }).catch((updateError) => {
          HydrationLogger.error(`Failed to persist outbox failure state for ${event.id}`, updateError, {
            eventId: event.id,
            accountId: event.accountId,
          });
        });
      }
    }

    return {
      processedCount: successCount + failedCount,
      successCount,
      failedCount,
      errors,
    };
  }
}
