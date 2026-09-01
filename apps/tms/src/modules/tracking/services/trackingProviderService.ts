import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";
import { mapProviderEvent, type TrackingEventMappingRule } from "@qubere/tracking";
import { TrackingWebhookError } from "@qubere/tracking-platform";
import { publishTransportationEvent } from "../../events/services/eventService";

export interface IngestTrackingSignalInput {
  provider: string;
  connectionId?: string;
  shipmentId?: string;
  movementId?: string;
  rawEventCode: string;
  eventDescription?: string;
  occurredAt?: Date;
  location?: { city?: string; country?: string; unlocode?: string; coordinates?: [number, number] };
  newEstimatedArrival?: Date;
  carrierReference?: string;
}

async function loadEventMapping(provider: string, connectionId: string, rawEventCode: string) {
  const definition = await db.trackingProviderDefinition.findUnique({
    where: { key: provider },
    select: {
      eventMappings: {
        where: { active: true },
      },
    },
  });
  if (!definition) {
    throw new TrackingWebhookError(
      "PROVIDER_UNAVAILABLE",
      409,
      `Tracking provider "${provider}" is not configured in the provider catalog.`
    );
  }
  const mapped = mapProviderEvent(
    rawEventCode,
    connectionId,
    definition.eventMappings as TrackingEventMappingRule[]
  );
  if (!mapped) {
    throw new TrackingWebhookError(
      "EVENT_MAPPING_MISSING",
      422,
      `No active event mapping exists for provider "${provider}" code "${rawEventCode}".`
    );
  }
  return mapped;
}

/**
 * Compatibility entry point for existing services. Provider mapping now comes
 * from the database; no provider names or keyword rules live in application code.
 */
export async function ingestRawTrackingSignal(ctx: AccountContext, input: IngestTrackingSignalInput) {
  const occurredAt = input.occurredAt ?? new Date();
  const mapped = await loadEventMapping(input.provider, input.connectionId ?? "", input.rawEventCode);

  // These are compatibility caches only. Canonical event and ETA history remain
  // authoritative and are persisted by the webhook ingestion service.
  if (input.shipmentId) {
    const updateData: { estimatedArrival?: Date; arrivalDate?: Date } = {};
    if (input.newEstimatedArrival) updateData.estimatedArrival = input.newEstimatedArrival;
    if (["CONTAINER_DISCHARGED", "PORT_ARRIVED"].includes(mapped.canonicalEventType)) {
      updateData.arrivalDate = occurredAt;
    }
    if (Object.keys(updateData).length > 0) {
      await db.shipment.updateMany({
        where: { id: input.shipmentId, accountId: ctx.accountId },
        data: updateData,
      });
    }
  }

  const event = await publishTransportationEvent(ctx, {
    entityType: input.movementId ? "MOVEMENT" : "SHIPMENT",
    entityId: input.movementId ?? input.shipmentId ?? "shp_unknown",
    shipmentId: input.shipmentId ?? null,
    movementId: input.movementId ?? null,
    eventType: mapped.canonicalEventType,
    source:
      mapped.sourceType === "CBP"
        ? "CBP"
        : mapped.sourceType === "TERMINAL"
          ? "TERMINAL"
          : "API",
    sourceReference: `${input.provider}:${input.carrierReference ?? input.rawEventCode}`,
    occurredAt,
    location: input.location as Record<string, unknown> | undefined,
    payload: {
      provider: input.provider,
      connectionId: input.connectionId ?? null,
      mappingId: mapped.mappingId,
      rawEventCode: input.rawEventCode,
      eventDescription: input.eventDescription ?? input.rawEventCode,
      newEstimatedArrival: input.newEstimatedArrival?.toISOString() ?? null,
    },
  });

  return { event, eventType: mapped.canonicalEventType, mappingId: mapped.mappingId };
}
