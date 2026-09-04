import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams } from "@/lib/api/validation";
import { getShipmentTrackingProjection } from "@/modules/tracking/shipmentTracking";

const paramsSchema = z.object({ id: z.string().min(1) });

export const GET = withAuthenticatedRoute<{ id: string }>(async ({ ctx, requestId, params }) => {
  const paramsValue = validatePathParams(params, paramsSchema, requestId);
  if ("response" in paramsValue) return paramsValue.response;

  const projection = await getShipmentTrackingProjection(ctx.accountId, paramsValue.data.id);
  if (!projection) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }

  return NextResponse.json({ tracking: projection });
});
