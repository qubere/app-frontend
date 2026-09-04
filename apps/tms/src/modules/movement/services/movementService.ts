import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";
import { publishTransportationEvent } from "../../events/services/eventService";

export interface CreateMovementStopInput {
  sequence: number;
  type: "ORIGIN" | "PICKUP" | "PORT" | "AIRPORT" | "TERMINAL" | "RAIL_TERMINAL" | "CROSS_DOCK" | "WAREHOUSE" | "DELIVERY" | "DESTINATION";
  partyId?: string | null;
  siteId?: string | null;
  locationName?: string | null;
  name?: string | null;
  address?: Record<string, unknown> | null;
  unlocode?: string | null;
  appointmentStart?: Date | null;
  appointmentEnd?: Date | null;
  plannedArrival?: Date | null;
  plannedDeparture?: Date | null;
}

export interface CreateMovementInput {
  shipmentId?: string | null;
  sequence?: number;
  mode: "OCEAN" | "AIR" | "TRUCK" | "DRAYAGE" | "RAIL";
  carrierPartyId?: string | null;
  carrierName?: string | null;
  originName?: string | null;
  destinationName?: string | null;
  status?: string;
  equipment?: string | null;
  vessel?: string | null;
  voyage?: string | null;
  flight?: string | null;
  train?: string | null;
  truckIdentifiers?: string | null;
  bookingNumber?: string | null;
  masterBillNumber?: string | null;
  houseBillNumber?: string | null;
  plannedStart?: Date | null;
  plannedEnd?: Date | null;
  trackingProvider?: string | null;
  trackingReference?: string | null;
  stops?: CreateMovementStopInput[];
}

export async function createMovement(
  ctx: AccountContext,
  input: CreateMovementInput
) {
  const movementModel = (db as any).movement ?? (db as any).transportLeg;
  if (!movementModel) return null;

  const isMovementModel = movementModel === (db as any).movement;

  const movement = await movementModel.create({
    data: isMovementModel
      ? {
          accountId: ctx.accountId,
          mode: input.mode,
          carrierPartyId: input.carrierPartyId ?? null,
          status: input.status ?? "PLANNED",
          equipment: input.equipment ?? null,
          vessel: input.vessel ?? null,
          voyage: input.voyage ?? null,
          flight: input.flight ?? null,
          train: input.train ?? null,
          truckIdentifiers: input.truckIdentifiers ?? null,
          bookingNumber: input.bookingNumber ?? null,
          masterBillNumber: input.masterBillNumber ?? null,
          houseBillNumber: input.houseBillNumber ?? null,
          plannedStart: input.plannedStart ?? null,
          plannedEnd: input.plannedEnd ?? null,
          trackingProvider: input.trackingProvider ?? null,
          trackingReference: input.trackingReference ?? null,
          stops: input.stops && input.stops.length > 0
            ? {
                create: input.stops.map((stop) => ({
                  accountId: ctx.accountId,
                  sequence: stop.sequence,
                  type: stop.type,
                  partyId: stop.partyId ?? null,
                  siteId: stop.siteId ?? null,
                  locationName: stop.locationName ?? stop.name ?? null,
                  address: stop.address ? (stop.address as any) : undefined,
                  unlocode: stop.unlocode ?? null,
                  appointmentStart: stop.appointmentStart ?? null,
                  appointmentEnd: stop.appointmentEnd ?? null,
                  plannedArrival: stop.plannedArrival ?? null,
                  plannedDeparture: stop.plannedDeparture ?? null,
                  status: "PLANNED",
                })),
              }
            : undefined,
        }
      : {
          accountId: ctx.accountId,
          shipmentId: input.shipmentId ?? "shp_default",
          sequence: input.sequence ?? 1,
          mode: (input.mode === "DRAYAGE" ? "TRUCK" : input.mode) as any,
          carrierName: input.carrierName ?? null,
          originName: input.originName ?? "Origin",
          destinationName: input.destinationName ?? "Destination",
          plannedDeparture: input.plannedStart ?? null,
          plannedArrival: input.plannedEnd ?? null,
          status: "PLANNED",
          stops: input.stops && input.stops.length > 0
            ? {
                create: input.stops.map((stop) => ({
                  accountId: ctx.accountId,
                  shipmentId: input.shipmentId ?? "shp_default",
                  sequence: stop.sequence,
                  type: stop.type,
                  name: stop.name ?? stop.locationName ?? "Stop",
                  unlocode: stop.unlocode ?? null,
                  plannedArrival: stop.plannedArrival ?? null,
                  plannedDeparture: stop.plannedDeparture ?? null,
                })),
              }
            : undefined,
        },
    include: {
      stops: true,
      ...(isMovementModel
        ? {
            carrierParty: {
              include: {
                names: true,
              },
            },
          }
        : {}),
    },
  });

  if (input.shipmentId && isMovementModel && (db as any).shipmentMovement) {
    try {
      await (db as any).shipmentMovement.create({
        data: {
          accountId: ctx.accountId,
          shipmentId: input.shipmentId,
          movementId: movement.id,
          sequence: 1,
          relationshipType: "DIRECT",
        },
      });
    } catch {
      // ignore
    }
  }

  if (input.shipmentId && (db as any).transportationEvent) {
    try {
      await publishTransportationEvent(ctx, {
        entityType: "SHIPMENT",
        entityId: input.shipmentId,
        shipmentId: input.shipmentId,
        movementId: movement.id,
        eventType: "MOVEMENT_PLANNED",
        source: "SYSTEM",
        payload: {
          movementId: movement.id,
          mode: input.mode,
          stopsCount: input.stops?.length ?? 0,
        },
      });
    } catch {
      // ignore
    }
  }

  return movement;
}

export async function getMovementWithStops(ctx: AccountContext, movementId: string) {
  const movementModel = (db as any).movement ?? (db as any).transportLeg;
  if (!movementModel) return null;
  return movementModel.findFirst({
    where: {
      accountId: ctx.accountId,
      id: movementId,
    },
    include: {
      stops: true,
    },
  });
}
