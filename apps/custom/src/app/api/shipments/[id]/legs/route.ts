import { NextResponse } from "next/server";
import { z } from "zod";
import { LegMode, LegStatus, LegType } from "@prisma/client";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams, parseAndValidateBody } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { getShipmentTrackingProjection } from "@/modules/tracking/shipmentTracking";
import { resolveOwnedShipment, nextStopSequence } from "@/modules/legs/legService";

const paramsSchema = z.object({ id: z.string().min(1) });

const createSchema = z.object({
  legType: z.nativeEnum(LegType).default(LegType.MAIN_CARRIAGE),
  mode: z.nativeEnum(LegMode).default(LegMode.OCEAN),
  originName: z.string().min(1).optional(),
  originUnlocode: z.string().max(10).optional(),
  destinationName: z.string().min(1),
  destinationUnlocode: z.string().max(10).optional(),
  carrierName: z.string().optional(),
  carrierScac: z.string().max(10).optional(),
  vesselName: z.string().optional(),
  voyageNumber: z.string().optional(),
  billOfLadingNumber: z.string().optional(),
  billOfLadingType: z.string().optional(),
  bookingNumber: z.string().optional(),
});

export const GET = withAuthenticatedRoute<{ id: string }>(async ({ ctx, requestId, params }) => {
  const p = validatePathParams(params, paramsSchema, requestId);
  if ("response" in p) return p.response;

  const shipment = await resolveOwnedShipment(ctx.accountId, p.data.id);
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const projection = await getShipmentTrackingProjection(ctx.accountId, shipment.id);
  return NextResponse.json({ journey: projection?.journey ?? null });
});

export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, requestId, params }) => {
  const p = validatePathParams(params, paramsSchema, requestId);
  if ("response" in p) return p.response;

  const body = await parseAndValidateBody(req, createSchema, requestId);
  if ("response" in body) return body.response;

  const shipment = await resolveOwnedShipment(ctx.accountId, p.data.id);
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const b = body.data;

  const leg = await db.$transaction(async (tx) => {
    const existing = await tx.shipmentLeg.findMany({
      where: { shipmentId: shipment.id },
      orderBy: { sequence: "asc" },
      select: { id: true, sequence: true, destinationStopId: true },
    });
    const nextSeq = existing.length + 1;

    let originStopId: string;
    if (existing.length > 0) {
      // Shared-stop invariant: new leg starts where the last leg ends.
      originStopId = existing[existing.length - 1].destinationStopId;
    } else {
      const origin = await tx.shipmentStop.create({
        data: {
          accountId: ctx.accountId,
          shipmentId: shipment.id,
          sequence: await nextStopSequence(tx, shipment.id),
          type: "ORIGIN",
          role: "ORIGIN",
          name: b.originName || "Origin",
          unlocode: b.originUnlocode || null,
        },
      });
      originStopId = origin.id;
    }

    const destSeq = await nextStopSequence(tx, shipment.id);
    const destStop = await tx.shipmentStop.create({
      data: {
        accountId: ctx.accountId,
        shipmentId: shipment.id,
        sequence: destSeq,
        type: "DESTINATION",
        role: nextSeq === 1 ? "DESTINATION" : "TRANSSHIPMENT",
        name: b.destinationName,
        unlocode: b.destinationUnlocode || null,
      },
    });

    return tx.shipmentLeg.create({
      data: {
        accountId: ctx.accountId,
        shipmentId: shipment.id,
        sequence: nextSeq,
        legType: b.legType,
        mode: b.mode,
        status: LegStatus.PLANNED,
        originStopId,
        destinationStopId: destStop.id,
        carrierName: b.carrierName || null,
        carrierScac: b.carrierScac || null,
        vesselName: b.vesselName || null,
        voyageNumber: b.voyageNumber || null,
        billOfLadingNumber: b.billOfLadingNumber || null,
        billOfLadingType: b.billOfLadingType || null,
        bookingNumber: b.bookingNumber || null,
        source: "MANUAL",
        confirmedAt: new Date(),
        confirmedByUserId: ctx.userId,
      },
    });
  });

  const projection = await getShipmentTrackingProjection(ctx.accountId, shipment.id);
  return NextResponse.json({ leg, journey: projection?.journey ?? null }, { status: 201 });
}, { permission: "shipments.manage", write: true });
