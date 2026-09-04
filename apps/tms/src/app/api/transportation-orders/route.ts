import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import { z } from "zod";

const createOrderSchema = z.object({
  source: z.enum(["EMAIL", "MANUAL", "API"]).default("MANUAL"),
  inboundEmailId: z.string().optional().nullable(),
  rawRequestText: z.string().optional().nullable(),
  requestedBy: z.string().optional().nullable(),
  commodityDescription: z.string().optional().nullable(),
  weight: z.number().optional().nullable(),
  mode: z.string().optional().nullable(),
  originAddress: z.record(z.string(), z.unknown()).optional().nullable(),
  destinationAddress: z.record(z.string(), z.unknown()).optional().nullable(),
  origin: z.record(z.string(), z.unknown()).optional().nullable(),
  destination: z.record(z.string(), z.unknown()).optional().nullable(),
  requestedPickupWindow: z.record(z.string(), z.unknown()).optional().nullable(),
  requestedDeliveryWindow: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const GET = withAuthenticatedRoute(
  async ({ ctx }) => {
    const orders = await db.transportationOrder.findMany({
      where: { accountId: ctx.accountId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ orders });
  },
  { permission: "transportation_orders.read" }
);

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const body = await req.json();
    const parsed = createOrderSchema.parse(body);

    const canonicalOrigin = parsed.origin ?? parsed.originAddress ?? null;
    const canonicalOriginAddr = parsed.originAddress ?? parsed.origin ?? null;
    const canonicalDest = parsed.destination ?? parsed.destinationAddress ?? null;
    const canonicalDestAddr = parsed.destinationAddress ?? parsed.destination ?? null;

    const order = await db.transportationOrder.create({
      data: {
        accountId: ctx.accountId,
        source: parsed.source,
        inboundEmailId: parsed.inboundEmailId ?? null,
        rawRequestText: parsed.rawRequestText ?? null,
        requestedBy: parsed.requestedBy ?? null,
        commodityDescription: parsed.commodityDescription ?? null,
        weight: parsed.weight ?? null,
        mode: parsed.mode ?? null,
        originAddress: canonicalOriginAddr ? (canonicalOriginAddr as any) : undefined,
        destinationAddress: canonicalDestAddr ? (canonicalDestAddr as any) : undefined,
        origin: canonicalOrigin ? (canonicalOrigin as any) : undefined,
        destination: canonicalDest ? (canonicalDest as any) : undefined,
        requestedPickupWindow: parsed.requestedPickupWindow ? (parsed.requestedPickupWindow as any) : undefined,
        requestedDeliveryWindow: parsed.requestedDeliveryWindow ? (parsed.requestedDeliveryWindow as any) : undefined,
        status: "RECEIVED",
      },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "TRANSPORTATION_ORDER_CREATED",
      entity: "TransportationOrder",
      entityId: order.id,
      source: parsed.source,
      requestId,
    });

    return NextResponse.json({ order }, { status: 201 });
  },
  { permission: "transportation_orders.write", write: true }
);
