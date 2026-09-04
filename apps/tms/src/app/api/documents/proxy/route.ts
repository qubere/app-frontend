import path from "path";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { NextResponse } from "next/server";
import { readTmsDocument } from "@/lib/documentStorage";

export const GET = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json({ error: "documentId query parameter is required", requestId }, { status: 400 });
    }

    const doc = await db.shipmentDocument.findFirst({
      where: { id: documentId, accountId: ctx.accountId },
      select: { fileName: true, fileUrl: true, mimeType: true },
    });

    if (!doc || !doc.fileUrl) {
      return NextResponse.json({ error: "Document not found", requestId }, { status: 404 });
    }

    const fileName = doc.fileName || "document.pdf";
    const stored = await readTmsDocument(doc.fileUrl);
    return new NextResponse(new Uint8Array(stored.body), { headers: {
      "Content-Type": stored.contentType || doc.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${path.basename(fileName).replace(/["\\\r\n]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    }});
  }, { permission: "document.download" });
