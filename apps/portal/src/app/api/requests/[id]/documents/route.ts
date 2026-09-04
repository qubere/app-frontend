import { withPortalAccount } from "@/lib/portal-scope";
import { NextResponse } from "next/server";
import { authorizePortalResource } from "@qubere/auth";
import { db } from "@qubere/db";
import { buildDocumentProvenance } from "@qubere/db/services/document-provenance";
import { storeDocumentBytes } from "@qubere/storage";
import { createHash } from "crypto";
import path from "path";

export const POST = withPortalAccount(async (ctx, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const request = await db.customerRequest.findUnique({
    where: { id },
    select: { id: true, accountId: true, clientId: true, shipmentId: true, title: true },
  });

  if (!request) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const auth = await authorizePortalResource({
    permission: "portal.requests.respond",
    resourceAccountId: request.accountId,
    resourceClientId: request.clientId,
  });

  if (!auth.authorized || auth.errorResponse || !auth.ctx) {
    return auth.errorResponse || NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Only allow attaching a document the caller's request can legitimately see:
  // same account, and (when the doc is client-scoped) the same client.
  // See docs/plans/review/CUSTOMER-PORTAL-PR97-REVIEW.md (P1-2).
  const loadAttachableDoc = async (documentId: string) => {
    const doc = await db.shipmentDocument.findUnique({
      where: { id: documentId },
      select: { id: true, fileName: true, mimeType: true, docType: true, status: true, createdAt: true, accountId: true, clientId: true },
    });
    if (!doc) return null;
    if (doc.accountId !== request.accountId) return null;
    if (doc.clientId && doc.clientId !== request.clientId) return null;
    return doc;
  };
  const toDocDto = (doc: { id: string; fileName: string; mimeType: string | null; docType: string | null; status: string | null; createdAt: Date }) => ({
    id: doc.id,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    docType: doc.docType,
    status: doc.status,
    createdAt: doc.createdAt,
  });

  try {
    const contentType = req.headers.get("content-type") || "";

    // Case A: JSON payload attaching existing document
    if (contentType.includes("application/json")) {
      const { documentId } = await req.json();
      if (!documentId) {
        return NextResponse.json({ error: "DOCUMENT_ID_REQUIRED" }, { status: 400 });
      }

      const existingDoc = await loadAttachableDoc(documentId);

      if (!existingDoc) {
        return NextResponse.json({ error: "DOCUMENT_NOT_FOUND" }, { status: 404 });
      }

      const reqDoc = await db.customerRequestDocument.create({
        data: {
          requestId: id,
          documentId: existingDoc.id,
        },
      });

      const msg = await db.customerRequestMessage.create({
        data: {
          requestId: id,
          accountId: request.accountId,
          clientId: request.clientId,
          authorUserId: auth.ctx.userId,
          authorType: "CUSTOMER",
          body: `Attached existing document from Documents folder: ${existingDoc.fileName}`,
        },
      });

      await db.customerRequest.update({
        where: { id },
        data: { status: "CUSTOMER_RESPONDED" },
      });

      return NextResponse.json({ document: toDocDto(existingDoc), message: msg });
    }

    // Case B: Multipart form data with file upload or existing documentId
    const formData = await req.formData();
    const existingDocId = formData.get("documentId") as string | null;

    if (existingDocId) {
      const existingDoc = await loadAttachableDoc(existingDocId);

      if (!existingDoc) {
        return NextResponse.json({ error: "DOCUMENT_NOT_FOUND" }, { status: 404 });
      }

      const reqDoc = await db.customerRequestDocument.create({
        data: {
          requestId: id,
          documentId: existingDoc.id,
        },
      });

      const msg = await db.customerRequestMessage.create({
        data: {
          requestId: id,
          accountId: request.accountId,
          clientId: request.clientId,
          authorUserId: auth.ctx.userId,
          authorType: "CUSTOMER",
          body: `Attached existing document from Documents folder: ${existingDoc.fileName}`,
        },
      });

      await db.customerRequest.update({
        where: { id },
        data: { status: "CUSTOMER_RESPONDED" },
      });

      return NextResponse.json({ document: toDocDto(existingDoc), message: msg });
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "NO_FILE_PROVIDED" }, { status: 400 });
    }

    // Basename only — never let a caller-supplied name traverse out of the
    // quarantine directory. See CUSTOMER-PORTAL-PR97-REVIEW.md (P1-7/P1-8).
    const fileName = path.basename(file.name || "").replace(/[^\x20-\x7e]/g, "").trim();
    if (!fileName || fileName === "." || fileName === ".." || fileName.includes("/") || fileName.includes("\\")) {
      return NextResponse.json({ error: "INVALID_FILE_NAME" }, { status: 400 });
    }

    const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "FILE_TOO_LARGE", message: "Maximum upload size is 25 MB." }, { status: 413 });
    }

    const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt"];
    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ error: "UNSUPPORTED_FILE_TYPE", message: `Allowed: ${ALLOWED_EXT.join(", ")}` }, { status: 415 });
    }

    const mimeType = file.type || (ext === ".pdf" ? "application/pdf" : "application/octet-stream");
    const fileSize = file.size;

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(buffer).digest("hex");

    // 1. Persist the original bytes to durable object storage (GCS `quarantine/`
    //    prefix in prod; local disk only for localhost dev). Never in Postgres.
    const stored = await storeDocumentBytes({
      buffer,
      fileName,
      contentType: mimeType,
      folder: "quarantine",
    });

    const shipDoc = await db.shipmentDocument.create({
      data: {
        accountId: request.accountId,
        clientId: request.clientId,
        shipmentId: request.shipmentId || undefined,
        fileName,
        fileUrl: stored.url,
        mimeType,
        byteSize: fileSize,
        checksum,
        docType: request.title.replace("Upload ", "") || "Commercial Invoice",
        status: "QUARANTINED",
        portalVisibility: "CUSTOMER",
        source: "PORTAL_UPLOAD",
        ...(await buildDocumentProvenance({
          channel: "CUSTOMER_PORTAL",
          uploadedByType: "CUSTOMER_USER",
          uploadedByUserId: auth.ctx.userId,
          channelMeta: { requestId: id },
        })),
      },
    });

    // 2. Link to CustomerRequestDocument
    const reqDoc = await db.customerRequestDocument.create({
      data: {
        requestId: id,
        documentId: shipDoc.id,
      },
    });

    // 3. Append a message notification to thread
    const msg = await db.customerRequestMessage.create({
      data: {
        requestId: id,
        accountId: request.accountId,
        clientId: request.clientId,
        authorUserId: auth.ctx.userId,
        authorType: "CUSTOMER",
        body: `Uploaded document to quarantine: ${fileName} (${Math.round(fileSize / 1024)} KB)`,
      },
    });

    await db.customerRequest.update({
      where: { id },
      data: {
        status: "CUSTOMER_RESPONDED",
      },
    });

    return NextResponse.json({ document: toDocDto(shipDoc), message: msg });
  } catch (err: any) {
    console.error("Error processing document upload:", err);
    return NextResponse.json({ error: "UPLOAD_FAILED", message: err.message }, { status: 500 });
  }
});
