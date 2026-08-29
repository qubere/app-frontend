import { NextResponse } from "next/server";
import { z } from "zod";
import { LegMode, LegStatus } from "@prisma/client";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams, parseAndValidateBody } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { getShipmentTrackingProjection } from "@/modules/tracking/shipmentTracking";
import { resequenceLegs } from "@/modules/legs/legService";

const paramsSchema = z.object({ id: z.string().min(1), legId: z.string().min(1) });

const patchSchema = z.object({
  mode: z.nativeEnum(LegMode).optional(),
  status: z.nativeEnum(LegStatus).optional(),
  statusReason: z.string().nullable().optional(),
  carrierName: z.string().nullable().optional(),
  carrierScac: z.string().max(10).nullable().optional(),
  vesselName: z.string().nullable().optional(),
  voyageNumber: z.string().nullable().optional(),
  flightNumber: z.string().nullable().optional(),
  billOfLadingNumber: z.string().nullable().optional(),
  billOfLadingType: z.string().nullable().optional(),
  bookingNumber: z.string().nullable().optional(),
  plannedDeparture: z.string().datetime().nullable().optional(),
  estimatedDeparture: z.string().datetime().nullable().optional(),
  actualDeparture: z.string().datetime().nullable().optional(),
  plannedArrival: z.string().datetime().nullable().optional(),
  estimatedArrival: z.string().datetime().nullable().optional(),
  actualArrival: z.string().datetime().nullable().optional(),
  confirmed: z.boolean().optional(),
});

async function loadLeg(accountId: string, shipmentIdOrNumber: string, legId: string) {
  return db.shipmentLeg.findFirst({
    where: {
      id: legId,
      accountId,
      shipment: {
        accountId,
        deletedAt: null,
        OR: [{ id: shipmentIdOrNumber }, { shipmentNumber: shipmentIdOrNumber }],
      },
    },
  });
}

const dateOrKeep = (v: string | null | undefined, current: Date | null) =>
  v === undefined ? current : v === null ? null : new Date(v);

export const PATCH = withAuthenticatedRoute<{ id: string; legId: string }>(
  async ({ req, ctx, requestId, params }) => {
    const p = validatePathParams(params, paramsSchema, requestId);
    if ("response" in p) return p.response;

    const body = await parseAndValidateBody(req, patchSchema, requestId);
    if ("response" in body) return body.response;

    const leg = await loadLeg(ctx.accountId, p.data.id, p.data.legId);
    if (!leg) return NextResponse.json({ error: "Shipment leg not found" }, { status: 404 });

    const b = body.data;

    if (b.mode && b.mode !== leg.mode && leg.status !== "PLANNED") {
      return NextResponse.json(
        { error: "Leg mode is immutable once the leg leaves PLANNED. Delete and re-create the leg instead.", code: "LEG_MODE_LOCKED" },
        { status: 422 }
      );
    }

    const updated = await db.shipmentLeg.update({
      where: { id: leg.id },
      data: {
        mode: b.mode ?? leg.mode,
        status: b.status ?? leg.status,
        statusReason: b.statusReason === undefined ? leg.statusReason : b.statusReason,
        carrierName: b.carrierName === undefined ? leg.carrierName : b.carrierName,
        carrierScac: b.carrierScac === undefined ? leg.carrierScac : b.carrierScac,
        vesselName: b.vesselName === undefined ? leg.vesselName : b.vesselName,
        voyageNumber: b.voyageNumber === undefined ? leg.voyageNumber : b.voyageNumber,
        flightNumber: b.flightNumber === undefined ? leg.flightNumber : b.flightNumber,
        billOfLadingNumber: b.billOfLadingNumber === undefined ? leg.billOfLadingNumber : b.billOfLadingNumber,
        billOfLadingType: b.billOfLadingType === undefined ? leg.billOfLadingType : b.billOfLadingType,
        bookingNumber: b.bookingNumber === undefined ? leg.bookingNumber : b.bookingNumber,
        plannedDeparture: dateOrKeep(b.plannedDeparture, leg.plannedDeparture),
        estimatedDeparture: dateOrKeep(b.estimatedDeparture, leg.estimatedDeparture),
        actualDeparture: dateOrKeep(b.actualDeparture, leg.actualDeparture),
        plannedArrival: dateOrKeep(b.plannedArrival, leg.plannedArrival),
        estimatedArrival: dateOrKeep(b.estimatedArrival, leg.estimatedArrival),
        actualArrival: dateOrKeep(b.actualArrival, leg.actualArrival),
        ...(b.confirmed ? { confirmedAt: new Date(), confirmedByUserId: ctx.userId, confidence: null } : {}),
      },
    });

    const projection = await getShipmentTrackingProjection(ctx.accountId, leg.shipmentId);
    return NextResponse.json({ leg: updated, journey: projection?.journey ?? null });
  },
  { permission: "shipments.manage", write: true }
);

export const DELETE = withAuthenticatedRoute<{ id: string; legId: string }>(
  async ({ ctx, requestId, params }) => {
    const p = validatePathParams(params, paramsSchema, requestId);
    if ("response" in p) return p.response;

    const leg = await loadLeg(ctx.accountId, p.data.id, p.data.legId);
    if (!leg) return NextResponse.json({ error: "Shipment leg not found" }, { status: 404 });

    if (leg.actualDeparture || leg.actualArrival) {
      return NextResponse.json(
        { error: "Cannot delete a leg that has recorded actual departure or arrival.", code: "LEG_HAS_ACTUALS" },
        { status: 422 }
      );
    }

    await db.$transaction(async (tx) => {
      await tx.shipmentLeg.delete({ where: { id: leg.id } });
      const remaining = await tx.shipmentLeg.findMany({
        where: { shipmentId: leg.shipmentId },
        orderBy: { sequence: "asc" },
        select: { id: true },
      });
      if (remaining.length > 0) {
        await resequenceLegs(tx, leg.shipmentId, remaining.map((l) => l.id));
      }
    });

    const projection = await getShipmentTrackingProjection(ctx.accountId, leg.shipmentId);
    return NextResponse.json({ success: true, journey: projection?.journey ?? null });
  },
  { permission: "shipments.manage", write: true }
);
