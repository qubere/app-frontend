import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    const { id } = await params;

    const order = await db.transportationOrder.findFirst({
      where: { id, accountId: ctx.accountId },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Transportation order not found" },
        { status: 404 }
      );
    }

    if (order.shipmentId) {
      const existingShipment = await db.shipment.findFirst({
        where: { id: order.shipmentId, accountId: ctx.accountId },
      });
      return NextResponse.json({
        shipment: existingShipment,
        promotedOrder: order,
        alreadyPromoted: true,
      });
    }

    // 1:1 Promotion into a Shipment
    const shipment = await db.shipment.create({
      data: {
        accountId: ctx.accountId,
        shipmentNumber: `SHP-${Date.now().toString(36).toUpperCase()}`,
        importerName: order.requestedBy ?? "Pending Importer",
        status: "Draft",
        transportMode: order.mode ?? "Truck",
      },
    });

    const updatedOrder = await db.transportationOrder.update({
      where: { id: order.id },
      data: {
        shipmentId: shipment.id,
        status: "SHIPMENT_CREATED",
      },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "TRANSPORTATION_ORDER_PROMOTED",
      entity: "TransportationOrder",
      entityId: order.id,
      source: "API",
      requestId,
      metadata: {
        shipmentId: shipment.id,
      },
    });

    return NextResponse.json(
      {
        shipment,
        promotedOrder: updatedOrder,
      },
      { status: 201 }
    );
  },
  { permission: "transportation_orders.write", write: true }
);
