import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getShipmentTrackingProjection } from "@/modules/tracking/shipmentTracking";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const shipment = await db.shipment.findFirst({ where: { id, deletedAt: null } });

  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }

  try {
    const { legIds } = await req.json();
    if (!Array.isArray(legIds) || legIds.length === 0) {
      return NextResponse.json({ error: "legIds array required" }, { status: 400 });
    }

    const currentLegs = await db.shipmentLeg.findMany({ where: { shipmentId: id } });
    if (currentLegs.length !== legIds.length) {
      return NextResponse.json({ error: "legIds length must match total leg count for shipment" }, { status: 422 });
    }

    // Reassign sequence numbers and update shared stops
    for (let i = 0; i < legIds.length; i++) {
      const legId = legIds[i];
      await db.shipmentLeg.update({
        where: { id: legId },
        data: { sequence: i + 1 },
      });
    }

    const reorderedLegs = await db.shipmentLeg.findMany({
      where: { shipmentId: id },
      orderBy: { sequence: "asc" },
    });

    for (let i = 1; i < reorderedLegs.length; i++) {
      const prev = reorderedLegs[i - 1];
      const cur = reorderedLegs[i];
      if (cur.originStopId !== prev.destinationStopId) {
        await db.shipmentLeg.update({
          where: { id: cur.id },
          data: { originStopId: prev.destinationStopId },
        });
      }
    }

    const projection = await getShipmentTrackingProjection(shipment.accountId, id);
    return NextResponse.json({ success: true, projection });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to reorder legs" }, { status: 422 });
  }
}
