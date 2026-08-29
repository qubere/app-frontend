import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getShipmentTrackingProjection } from "@/modules/tracking/shipmentTracking";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; legId: string }> }
) {
  const { id, legId } = await params;
  const leg = await db.shipmentLeg.findFirst({ where: { id: legId, shipmentId: id } });

  if (!leg) {
    return NextResponse.json({ error: "Shipment leg not found" }, { status: 404 });
  }

  try {
    const body = await req.json();

    // Invariant: mode cannot be mutated once status leaves PLANNED
    if (body.mode && body.mode !== leg.mode && leg.status !== "PLANNED") {
      return NextResponse.json(
        { error: "Leg mode is immutable after status leaves PLANNED. Delete and re-create the leg instead." },
        { status: 422 }
      );
    }

    const updatedLeg = await db.shipmentLeg.update({
      where: { id: legId },
      data: {
        carrierName: body.carrierName !== undefined ? body.carrierName : leg.carrierName,
        carrierScac: body.carrierScac !== undefined ? body.carrierScac : leg.carrierScac,
        vesselName: body.vesselName !== undefined ? body.vesselName : leg.vesselName,
        voyageNumber: body.voyageNumber !== undefined ? body.voyageNumber : leg.voyageNumber,
        flightNumber: body.flightNumber !== undefined ? body.flightNumber : leg.flightNumber,
        billOfLadingNumber: body.billOfLadingNumber !== undefined ? body.billOfLadingNumber : leg.billOfLadingNumber,
        bookingNumber: body.bookingNumber !== undefined ? body.bookingNumber : leg.bookingNumber,
        status: body.status !== undefined ? body.status : leg.status,
        statusReason: body.statusReason !== undefined ? body.statusReason : leg.statusReason,
        plannedDeparture: body.plannedDeparture ? new Date(body.plannedDeparture) : leg.plannedDeparture,
        estimatedDeparture: body.estimatedDeparture ? new Date(body.estimatedDeparture) : leg.estimatedDeparture,
        actualDeparture: body.actualDeparture ? new Date(body.actualDeparture) : leg.actualDeparture,
        plannedArrival: body.plannedArrival ? new Date(body.plannedArrival) : leg.plannedArrival,
        estimatedArrival: body.estimatedArrival ? new Date(body.estimatedArrival) : leg.estimatedArrival,
        actualArrival: body.actualArrival ? new Date(body.actualArrival) : leg.actualArrival,
      },
    });

    const projection = await getShipmentTrackingProjection(leg.accountId, id);
    return NextResponse.json({ leg: updatedLeg, projection });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update leg" }, { status: 422 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; legId: string }> }
) {
  const { id, legId } = await params;
  const leg = await db.shipmentLeg.findFirst({ where: { id: legId, shipmentId: id } });

  if (!leg) {
    return NextResponse.json({ error: "Shipment leg not found" }, { status: 404 });
  }

  // Refuse deletion if leg has actual timestamps (real tracking landed)
  if (leg.actualDeparture || leg.actualArrival) {
    return NextResponse.json(
      { error: "Cannot delete a leg with recorded actual departure or arrival timestamps." },
      { status: 422 }
    );
  }

  await db.shipmentLeg.delete({ where: { id: legId } });

  // Re-sequence remaining legs 1..N and reconcile shared stops
  const remainingLegs = await db.shipmentLeg.findMany({
    where: { shipmentId: id },
    orderBy: { sequence: "asc" },
  });

  for (let i = 0; i < remainingLegs.length; i++) {
    const cur = remainingLegs[i];
    await db.shipmentLeg.update({
      where: { id: cur.id },
      data: { sequence: i + 1 },
    });
    if (i > 0) {
      const prev = remainingLegs[i - 1];
      // Ensure shared stop invariant
      if (cur.originStopId !== prev.destinationStopId) {
        await db.shipmentLeg.update({
          where: { id: cur.id },
          data: { originStopId: prev.destinationStopId },
        });
      }
    }
  }

  const projection = await getShipmentTrackingProjection(leg.accountId, id);
  return NextResponse.json({ success: true, projection });
}
