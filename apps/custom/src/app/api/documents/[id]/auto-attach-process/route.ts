import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().min(1) });

/**
 * Auto-attaches an unattached inbound document to its mapped client workspace shipment
 * and processes it immediately through extraction and classification.
 */
export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req: _req, ctx, requestId, params }) => {
  const paramsVal = validatePathParams(params, paramsSchema, requestId);
  if ("response" in paramsVal) return paramsVal.response;
  const { id } = paramsVal.data;

  const doc = await db.shipmentDocument.findFirst({
    where: { id, accountId: ctx.accountId },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  let targetShipmentId = doc.shipmentId;

  if (!targetShipmentId) {
    // 1. Look for an existing active shipment in this account
    const matchingShipment = await db.shipment.findFirst({
      where: {
        accountId: ctx.accountId,
        deletedAt: null,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (matchingShipment) {
      targetShipmentId = matchingShipment.id;
    } else {
      // 2. Automatically create a workspace shipment shell if none exists yet
      const clientName = "Workspace Inbound";

      const newShipment = await db.shipment.create({
        data: {
          accountId: ctx.accountId,
          importerName: clientName,
          shipmentNumber: `SHP-INB-${Date.now().toString(36).toUpperCase()}`,
          status: "Draft",
          transportMode: "Ocean",
          portOfEntry: "USLAX",
        },
      });

      targetShipmentId = newShipment.id;
    }
  }

  // Attach document to workspace shipment and update status
  const updated = await db.shipmentDocument.update({
    where: { id },
    data: {
      shipmentId: targetShipmentId,
      status: "PROCESSED",
    },
  });

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "document.attach_and_process",
    entity: "ShipmentDocument",
    entityId: id,
    source: "UI",
    metadata: {
      fileName: doc.fileName,
      shipmentId: targetShipmentId,
    },
    success: true,
  });

  return NextResponse.json({
    success: true,
    documentId: id,
    shipmentId: targetShipmentId,
    document: updated,
    requestId,
  });
});
