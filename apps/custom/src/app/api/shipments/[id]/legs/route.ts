import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getShipmentTrackingProjection } from "@/modules/tracking/shipmentTracking";
import { LegMode, LegType, LegStatus } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const shipment = await db.shipment.findFirst({
    where: { OR: [{ id }, { shipmentNumber: id }], deletedAt: null },
  });
  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }

  const projection = await getShipmentTrackingProjection(shipment.accountId, shipment.id);
  return NextResponse.json(projection);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const shipment = await db.shipment.findFirst({
    where: { OR: [{ id }, { shipmentNumber: id }], deletedAt: null },
    include: { legs: { orderBy: { sequence: "asc" }, include: { destinationStop: true } } },
  });

  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const {
      legType = LegType.MAIN_CARRIAGE,
      mode = LegMode.OCEAN,
      originName,
      originUnlocode,
      destinationName,
      destinationUnlocode,
      carrierName,
      carrierScac,
      vesselName,
      voyageNumber,
      billOfLadingNumber,
      bookingNumber,
    } = body;

    const existingLegs = shipment.legs;
    const nextSeq = existingLegs.length + 1;

    let originStopId: string;

    // Invariant: shared stop rule (new leg's origin is previous leg's destination)
    if (existingLegs.length > 0) {
      originStopId = existingLegs[existingLegs.length - 1].destinationStopId;
    } else {
      const originStop = await db.shipmentStop.create({
        data: {
          accountId: shipment.accountId,
          shipmentId: shipment.id,
          sequence: 1,
          type: "FACILITY",
          role: "ORIGIN",
          name: originName || "Origin Terminal",
          unlocode: originUnlocode || null,
        },
      });
      originStopId = originStop.id;
    }

    const destStop = await db.shipmentStop.create({
      data: {
        accountId: shipment.accountId,
        shipmentId: shipment.id,
        sequence: (existingLegs.length + 1) * 2,
        type: "PORT",
        role: "DESTINATION",
        name: destinationName || "Destination Terminal",
        unlocode: destinationUnlocode || null,
      },
    });

    const newLeg = await db.shipmentLeg.create({
      data: {
        accountId: shipment.accountId,
        shipmentId: shipment.id,
        sequence: nextSeq,
        legType: legType as LegType,
        mode: mode as LegMode,
        status: LegStatus.PLANNED,
        originStopId,
        destinationStopId: destStop.id,
        carrierName: carrierName || null,
        carrierScac: carrierScac || null,
        vesselName: vesselName || null,
        voyageNumber: voyageNumber || null,
        billOfLadingNumber: billOfLadingNumber || null,
        bookingNumber: bookingNumber || null,
        source: "MANUAL",
        confirmedAt: new Date(),
      },
    });

    const updatedProjection = await getShipmentTrackingProjection(shipment.accountId, shipment.id);
    return NextResponse.json({ leg: newLeg, projection: updatedProjection }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create leg:", error);
    return NextResponse.json({ error: error.message || "Failed to create leg" }, { status: 422 });
  }
}
