import { NextResponse } from "next/server";
import { authorizePortalResource } from "@qubere/auth";
import { readStoredObject } from "@qubere/storage";
import { db } from "@qubere/db";

/**
 * Byte signatures we are willing to serve INLINE with their real media type.
 * Anything else is returned as an attachment, so a stored file can never be
 * rendered as active content in the portal's origin.
 */
const INLINE_SIGNATURES: Array<{ mime: string; match: (b: Buffer) => boolean }> = [
  { mime: "application/pdf", match: (b) => b.subarray(0, 1024).includes(Buffer.from("%PDF")) },
  { mime: "image/jpeg", match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    match: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  { mime: "image/tiff", match: (b) => ["49492a00", "4d4d002a"].includes(b.subarray(0, 4).toString("hex")) },
  { mime: "image/gif", match: (b) => ["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString("ascii")) },
];

function sniffInlineMime(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  for (const sig of INLINE_SIGNATURES) {
    if (sig.match(buf)) return sig.mime;
  }
  return null;
}

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

  if (!document.fileUrl) {
    return NextResponse.json(
      { error: "CONTENT_UNAVAILABLE", message: "This document has no stored file." },
      { status: 404 }
    );
  }

  let body: Buffer;
  try {
    ({ body } = await readStoredObject(document.fileUrl));
  } catch (err) {
    console.error("[portal documents/download] storage read failed", document.id, err);
    return NextResponse.json(
      { error: "CONTENT_UNAVAILABLE", message: "Document content could not be retrieved." },
      { status: 502 }
    );
  }

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

  const inlineMime = sniffInlineMime(body);
  const asciiName = (document.fileName || "document").replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const utf8Name = encodeURIComponent(document.fileName || "document");

  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (inlineMime) {
    headers["Content-Type"] = inlineMime;
    headers["Content-Disposition"] = `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;
  } else {
    headers["Content-Type"] = "application/octet-stream";
    headers["Content-Disposition"] = `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;
  }

  return new Response(new Uint8Array(body), { status: 200, headers });
}
