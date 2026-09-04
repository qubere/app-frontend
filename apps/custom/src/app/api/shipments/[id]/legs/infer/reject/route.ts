import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams, parseAndValidateBody } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { resolveOwnedShipment } from "@/modules/legs/legService";

const paramsSchema = z.object({ id: z.string().min(1) });
const bodySchema = z.object({ inputsHash: z.string().min(8) });

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, requestId, params }) => {
    const p = validatePathParams(params, paramsSchema, requestId);
    if ("response" in p) return p.response;
    const body = await parseAndValidateBody(req, bodySchema, requestId);
    if ("response" in body) return body.response;

    const shipment = await resolveOwnedShipment(ctx.accountId, p.data.id);
    if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

    const { count } = await db.legInferenceRun.updateMany({
      where: { shipmentId: shipment.id, inputsHash: body.data.inputsHash, status: { in: ["PROPOSED", "SUPERSEDED"] } },
      data: { status: "REJECTED", rejectedAt: new Date(), rejectedByUserId: ctx.userId },
    });

    return NextResponse.json({ rejected: count > 0 });
  },
  { permission: "shipments.manage", write: true }
);
