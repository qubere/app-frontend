import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";

export interface PublishTransportationEventInput {
  entityType: "TRANSPORTATION_ORDER" | "SHIPMENT" | "MOVEMENT" | "FREIGHT_QUOTE" | "TENDER" | "CARRIER_INVOICE" | "CUSTOMS_FILING";
  entityId: string;
  shipmentId?: string | null;
  movementId?: string | null;
  transportationOrderId?: string | null;
  eventType: string;
  source: "EMAIL" | "EDI" | "API" | "SYSTEM" | "USER" | "CARRIER" | "TERMINAL" | "CBP" | "PARSER" | "AGENT" | "DOCUMENT" | "MANUAL";
  sourceReference?: string | null;
  occurredAt?: Date;
  location?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  confidence?: number | null;
  correlationId?: string | null;
  causationId?: string | null;
}

export async function publishTransportationEvent(
  ctx: AccountContext,
  input: PublishTransportationEventInput
) {
  const event = await db.transportationEvent.create({
    data: {
      accountId: ctx.accountId,
      entityType: input.entityType,
      entityId: input.entityId,
      shipmentId: input.shipmentId ?? null,
      movementId: input.movementId ?? null,
      transportationOrderId: input.transportationOrderId ?? null,
      eventType: input.eventType,
      source: input.source,
      sourceReference: input.sourceReference ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      receivedAt: new Date(),
      location: input.location ? (input.location as any) : undefined,
      payload: input.payload ? (input.payload as any) : undefined,
      confidence: input.confidence ?? null,
      correlationId: input.correlationId ?? null,
      causationId: input.causationId ?? null,
    },
  });

  return event;
}

export async function listEventsForShipment(ctx: AccountContext, shipmentId: string) {
  return db.transportationEvent.findMany({
    where: {
      accountId: ctx.accountId,
      shipmentId,
    },
    orderBy: { occurredAt: "desc" },
  });
}

export async function listEventsForOrder(ctx: AccountContext, transportationOrderId: string) {
  return db.transportationEvent.findMany({
    where: {
      accountId: ctx.accountId,
      transportationOrderId,
    },
    orderBy: { occurredAt: "desc" },
  });
}

export async function listEventsForMovement(ctx: AccountContext, movementId: string) {
  return db.transportationEvent.findMany({
    where: {
      accountId: ctx.accountId,
      movementId,
    },
    orderBy: { occurredAt: "desc" },
  });
}
