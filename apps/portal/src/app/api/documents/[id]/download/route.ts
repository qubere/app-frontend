import { NextResponse } from "next/server";
import { authorizePortalResource } from "@qubere/auth";
import { db } from "@qubere/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const document = await db.shipmentDocument.findUnique({
    where: { id },
    select: {
      id: true,
      accountId: true,
      clientId: true,
      fileName: true,
      mimeType: true,
      fileUrl: true,
      portalVisibility: true,
      rawContent: true,
    },
  });

  if (!document) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const auth = await authorizePortalResource({
    permission: "portal.documents.read",
    resourceAccountId: document.accountId,
    resourceClientId: document.clientId,
    portalVisibility: document.portalVisibility,
  });

  if (!auth.authorized || auth.errorResponse || !auth.ctx) {
    return auth.errorResponse || NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Audit download
  await db.auditLog.create({
    data: {
      accountId: document.accountId,
      userId: auth.ctx.userId,
      actorUserId: auth.ctx.userId,
      effectiveUserId: auth.ctx.userId,
      action: "CUSTOMER_PORTAL_DOCUMENT_DOWNLOAD",
      entity: "ShipmentDocument",
      entityId: document.id,
      clientId: document.clientId,
      newValue: { fileName: document.fileName },
      source: "PORTAL_UI",
    },
  });

  const content = document.rawContent || `Customs Document Content for ${document.fileName}`;
  const isPdf = content.startsWith("%PDF");
  const contentType = isPdf
    ? "application/pdf"
    : document.mimeType && !document.mimeType.includes("pdf")
    ? document.mimeType
    : "text/plain; charset=utf-8";

  const responseBuffer = Buffer.from(content, isPdf ? "binary" : "utf-8");

  return new Response(responseBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
