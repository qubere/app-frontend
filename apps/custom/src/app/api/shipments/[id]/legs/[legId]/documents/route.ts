import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getShipmentTrackingProjection } from "@/modules/tracking/shipmentTracking";
import { DocumentType, LegDocumentRequirement } from "@prisma/client";

export async function POST(
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
    const { documentId, expectedDocType = DocumentType.OTHER, requirement = LegDocumentRequirement.REQUIRED, requirementReason } = body;

    // Check if slot for expectedDocType already exists on this leg
    const existingSlot = await db.shipmentLegDocument.findFirst({
      where: { legId, expectedDocType: expectedDocType as DocumentType },
    });

    let legDoc;
    if (existingSlot) {
      legDoc = await db.shipmentLegDocument.update({
        where: { id: existingSlot.id },
        data: {
          documentId: documentId || existingSlot.documentId,
          requirement: requirement as LegDocumentRequirement,
          requirementReason: requirementReason || existingSlot.requirementReason,
        },
      });
    } else {
      legDoc = await db.shipmentLegDocument.create({
        data: {
          accountId: leg.accountId,
          legId,
          documentId: documentId || null,
          expectedDocType: expectedDocType as DocumentType,
          requirement: requirement as LegDocumentRequirement,
          requirementReason: requirementReason || "Broker added checklist item",
          source: "MANUAL",
        },
      });
    }

    const projection = await getShipmentTrackingProjection(leg.accountId, id);
    return NextResponse.json({ legDocument: legDoc, projection }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to attach document to leg" }, { status: 422 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; legId: string }> }
) {
  const { id, legId } = await params;
  const leg = await db.shipmentLeg.findFirst({ where: { id: legId, shipmentId: id } });

  if (!leg) {
    return NextResponse.json({ error: "Leg not found" }, { status: 404 });
  }

  try {
    const { legDocumentId, requirement, requirementReason } = await req.json();
    if (!legDocumentId) {
      return NextResponse.json({ error: "legDocumentId required" }, { status: 400 });
    }

    const updated = await db.shipmentLegDocument.update({
      where: { id: legDocumentId },
      data: {
        requirement: requirement ? (requirement as LegDocumentRequirement) : undefined,
        requirementReason: requirementReason !== undefined ? requirementReason : undefined,
      },
    });

    const projection = await getShipmentTrackingProjection(leg.accountId, id);
    return NextResponse.json({ legDocument: updated, projection });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update checklist row" }, { status: 422 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; legId: string }> }
) {
  const { id, legId } = await params;
  const leg = await db.shipmentLeg.findFirst({ where: { id: legId, shipmentId: id } });

  if (!leg) {
    return NextResponse.json({ error: "Leg not found" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const legDocumentId = searchParams.get("legDocumentId");

    if (!legDocumentId) {
      return NextResponse.json({ error: "legDocumentId query parameter required" }, { status: 400 });
    }

    const target = await db.shipmentLegDocument.findFirst({ where: { id: legDocumentId, legId } });

    if (!target) {
      return NextResponse.json({ error: "Leg document slot not found" }, { status: 404 });
    }

    if (target.requirement === "OPTIONAL") {
      await db.shipmentLegDocument.delete({ where: { id: legDocumentId } });
    } else {
      // Detach doc keeping checklist gap intact
      await db.shipmentLegDocument.update({
        where: { id: legDocumentId },
        data: { documentId: null },
      });
    }

    const projection = await getShipmentTrackingProjection(leg.accountId, id);
    return NextResponse.json({ success: true, projection });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to remove leg document" }, { status: 422 });
  }
}
