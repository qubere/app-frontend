import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams, parseAndValidateBody } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { getShipmentTrackingProjection } from "@/modules/tracking/shipmentTracking";
import { resolveOwnedShipment, resequenceLegs } from "@/modules/legs/legService";

const paramsSchema = z.object({ id: z.string().min(1) });
const bodySchema = z.object({ legIds: z.array(z.string().min(1)).min(1) });

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, requestId, params }) => {
    const p = validatePathParams(params, paramsSchema, requestId);
    if ("response" in p) return p.response;

    const body = await parseAndValidateBody(req, bodySchema, requestId);
    if ("response" in body) return body.response;

    const shipment = await resolveOwnedShipment(ctx.accountId, p.data.id);
    if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

    const current = await db.shipmentLeg.findMany({
      where: { shipmentId: shipment.id },
      select: { id: true },
    });
    const currentIds = new Set(current.map((l) => l.id));
    const requested = body.data.legIds;

    if (requested.length !== current.length || !requested.every((id) => currentIds.has(id))) {
      return NextResponse.json(
        { error: "legIds must be a permutation of this shipment's leg ids", code: "LEG_REORDER_MISMATCH" },
        { status: 422 }
      );
    }

    await db.$transaction((tx) => resequenceLegs(tx, shipment.id, requested));

    const projection = await getShipmentTrackingProjection(ctx.accountId, shipment.id);
    return NextResponse.json({ success: true, journey: projection?.journey ?? null });
  },
  { permission: "shipments.manage", write: true }
);
