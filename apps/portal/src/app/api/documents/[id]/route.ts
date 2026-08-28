import { NextResponse } from "next/server";
import { authorizePortalResource, getAccountContext } from "@qubere/auth";
import { deleteStoredObject } from "@qubere/storage";
import { db } from "@qubere/db";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getAccountContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const document = await db.shipmentDocument.findUnique({
    where: { id },
    select: {
      id: true,
      accountId: true,
      clientId: true,
      fileName: true,
      fileUrl: true,
      shipmentId: true,
      portalVisibility: true,
    },
  });

  if (!document) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Document not found" }, { status: 404 });
  }

  const auth = await authorizePortalResource({
    permission: "portal.documents.create",
    resourceAccountId: document.accountId,
    resourceClientId: document.clientId,
    portalVisibility: document.portalVisibility,
  });

  if (!auth.authorized || auth.errorResponse) {
    return auth.errorResponse || NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
  }

  // Check if attached to a shipment
  if (document.shipmentId) {
    return NextResponse.json(
      {
        error: "LINKED_TO_SHIPMENT",
        message: "Cannot delete a document that is linked to a shipment.",
      },
      { status: 400 }
    );
  }

  // Delete customer request document links if any
  await db.customerRequestDocument.deleteMany({
    where: { documentId: id },
  });

  // Delete document record, then best-effort remove the stored object.
  await db.shipmentDocument.delete({
    where: { id },
  });
  if (document.fileUrl) {
    await deleteStoredObject(document.fileUrl);
  }

  // Audit deletion
  await db.auditLog.create({
    data: {
      accountId: document.accountId,
      userId: ctx.userId,
      actorUserId: ctx.userId,
      effectiveUserId: ctx.userId,
      action: "CUSTOMER_PORTAL_DOCUMENT_DELETE",
      entity: "ShipmentDocument",
      entityId: id,
      clientId: document.clientId,
      newValue: { fileName: document.fileName },
      source: "PORTAL_UI",
    },
  });

  return NextResponse.json({ success: true, message: `Document "${document.fileName}" deleted successfully.` });
}
