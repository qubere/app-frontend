import { randomUUID } from "node:crypto";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// Detaches a document from its shipment without deleting the record --
// extractedJson and metadata stay intact so the document can later be reattached.
export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    const doc = await db.shipmentDocument.findFirst({
      where: { id: params.id, accountId: ctx.accountId },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found.", requestId }, { status: 404 });
    }

    if (!doc.shipmentId) {
      return NextResponse.json({ error: "Document is already unlinked.", requestId }, { status: 400 });
    }

    const previousShipmentId = doc.shipmentId;
    const updated = await db.shipmentDocument.update({
      where: { id: doc.id },
      data: { shipmentId: null },
    });

    const correlationId = randomUUID();
    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "TMS_DOCUMENT_DETACHED",
      entity: "ShipmentDocument",
      entityId: doc.id,
      source: "UI",
      requestId,
      correlationId,
      metadata: { fileName: doc.fileName, previousShipmentId },
      failClosed: true,
    });

    return NextResponse.json({ document: updated, requestId });
  },
  { permission: "document.update", write: true }
);
