import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export class LegValidationError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Resolve a shipment the caller owns. `idOrNumber` may be a cuid or a
 * shipmentNumber; the account scope makes the shipmentNumber lookup safe
 * (shipmentNumber is only unique per account).
 */
export async function resolveOwnedShipment(accountId: string, idOrNumber: string) {
  const shipment = await db.shipment.findFirst({
    where: {
      accountId,
      deletedAt: null,
      OR: [{ id: idOrNumber }, { shipmentNumber: idOrNumber }],
    },
    select: {
      id: true,
      accountId: true,
      shipmentNumber: true,
      transportMode: true,
      countryOfExport: true,
      countryOfOrigin: true,
      destinationCountry: true,
      portOfEntry: true,
      incoterm: true,
    },
  });
  return shipment;
}

/**
 * Re-number a shipment's legs to 1..N in the given id order, and repair the
 * shared-stop invariant (leg k's destinationStop == leg k+1's originStop).
 * Two-phase to dodge the `@@unique([shipmentId, sequence])` constraint.
 */
export async function resequenceLegs(
  tx: Prisma.TransactionClient,
  shipmentId: string,
  orderedLegIds: string[]
) {
  // Phase 1: park every leg at a negative sequence so no two collide.
  for (let i = 0; i < orderedLegIds.length; i++) {
    await tx.shipmentLeg.update({
      where: { id: orderedLegIds[i] },
      data: { sequence: -(i + 1) },
    });
  }
  // Phase 2: assign final 1..N and fix shared stops.
  let prevDestStopId: string | null = null;
  for (let i = 0; i < orderedLegIds.length; i++) {
    const updated: { destinationStopId: string } = await tx.shipmentLeg.update({
      where: { id: orderedLegIds[i] },
      data: {
        sequence: i + 1,
        ...(prevDestStopId ? { originStopId: prevDestStopId } : {}),
      },
      select: { destinationStopId: true },
    });
    prevDestStopId = updated.destinationStopId;
  }
}

/** Next free stop sequence for a shipment. */
export async function nextStopSequence(tx: Prisma.TransactionClient, shipmentId: string): Promise<number> {
  const agg = await tx.shipmentStop.aggregate({
    where: { shipmentId },
    _max: { sequence: true },
  });
  return (agg._max.sequence ?? 0) + 1;
}
