import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getShipmentTrackingProjection } from "@/modules/tracking/shipmentTracking";
import { inferShipmentLegs, generateDiffProposal } from "@qubere/shipment-legs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const shipment = await db.shipment.findFirst({
    where: { id, deletedAt: null },
    include: {
      documents: true,
      trackingIdentifiers: true,
      legs: { orderBy: { sequence: "asc" } },
    },
  });

  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }

  const inference = inferShipmentLegs(
    shipment,
    shipment.documents.map((d) => ({
      id: d.id,
      docType: d.docType,
      documentType: d.documentType,
      fileName: d.fileName,
      extractedJson: d.extractedJson,
    })),
    shipment.trackingIdentifiers
  );

  const proposal = generateDiffProposal(
    shipment.id,
    shipment.legs.length,
    inference.legs,
    inference.overallConfidence
  );

  // If zero existing legs, auto-apply inferred legs
  if (shipment.legs.length === 0 && inference.legs.length > 0) {
    let lastStopId: string | null = null;

    for (let i = 0; i < inference.legs.length; i++) {
      const leg = inference.legs[i];
      let originStopId: string;
      if (lastStopId) {
        originStopId = lastStopId;
      } else {
        const originStop = await db.shipmentStop.create({
          data: {
            accountId: shipment.accountId,
            shipmentId: shipment.id,
            sequence: i * 2 + 1,
            type: i === 0 ? "FACILITY" : "PORT",
            role: i === 0 ? "ORIGIN" : "TRANSSHIPMENT",
            name: leg.originName,
            unlocode: leg.originUnlocode,
          },
        });
        originStopId = originStop.id;
      }

      const destStop = await db.shipmentStop.create({
        data: {
          accountId: shipment.accountId,
          shipmentId: shipment.id,
          sequence: i * 2 + 2,
          type: i === inference.legs.length - 1 ? "DC" : "PORT",
          role: i === inference.legs.length - 1 ? "DESTINATION" : "TRANSSHIPMENT",
          name: leg.destinationName,
          unlocode: leg.destinationUnlocode,
        },
      });
      lastStopId = destStop.id;

      await db.shipmentLeg.create({
        data: {
          accountId: shipment.accountId,
          shipmentId: shipment.id,
          sequence: leg.sequence,
          legType: leg.legType,
          mode: leg.mode,
          originStopId,
          destinationStopId: destStop.id,
          carrierName: leg.carrierName,
          carrierScac: leg.carrierScac,
          vesselName: leg.vesselName,
          voyageNumber: leg.voyageNumber,
          billOfLadingNumber: leg.billOfLadingNumber,
          bookingNumber: leg.bookingNumber,
          confidence: leg.confidence,
          source: "INFERRED",
          confirmedAt: null,
        },
      });
    }

    const projection = await getShipmentTrackingProjection(shipment.accountId, shipment.id);
    return NextResponse.json({ applied: true, proposal, projection });
  }

  return NextResponse.json({ applied: false, proposal });
}
