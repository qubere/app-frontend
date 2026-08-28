import { NextResponse } from "next/server";
import { authorizePortalResource } from "@qubere/auth";
import { db } from "@qubere/db";
import fs from "fs/promises";
import path from "path";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  try {
    const contentType = req.headers.get("content-type") || "";

    // Case A: JSON payload attaching existing document
    if (contentType.includes("application/json")) {
      const { documentId } = await req.json();
      if (!documentId) {
        return NextResponse.json({ error: "DOCUMENT_ID_REQUIRED" }, { status: 400 });
      }

      const existingDoc = await db.shipmentDocument.findUnique({
        where: { id: documentId },
      });

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

      return NextResponse.json({ document: existingDoc, message: msg });
    }

    // Case B: Multipart form data with file upload or existing documentId
    const formData = await req.formData();
    const existingDocId = formData.get("documentId") as string | null;

    if (existingDocId) {
      const existingDoc = await db.shipmentDocument.findUnique({
        where: { id: existingDocId },
      });

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

      return NextResponse.json({ document: existingDoc, message: msg });
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "NO_FILE_PROVIDED" }, { status: 400 });
    }

    const fileName = file.name;
    const mimeType = file.type || (fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
    const fileSize = file.size;

    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    // Convert binary PDF / images to base64 for database rawContent persistence
    let rawContent = "";
    if (mimeType.includes("text") || mimeType.includes("json") || mimeType.includes("csv")) {
      rawContent = buffer.toString("utf-8");
    } else {
      rawContent = buffer.toString("base64");
    }

    // 1. Create ShipmentDocument in QUARANTINE folder on blob storage
    const quarantineUrl = `https://blob.vercel-storage.com/quarantine/requests/${id}/${fileName}`;
    const shipDoc = await db.shipmentDocument.create({
      data: {
        accountId: request.accountId,
        clientId: request.clientId,
        shipmentId: request.shipmentId || undefined,
        fileName,
        fileUrl: quarantineUrl,
        mimeType,
        docType: request.title.replace("Upload ", "") || "Commercial Invoice",
        status: "QUARANTINED",
        portalVisibility: "CUSTOMER",
        rawContent,
      },
    });

    // Save to disk under quarantine directories using shipDoc.id
    const targetDirs = [
      path.join(process.cwd(), "uploads", "quarantine", shipDoc.id),
      path.join(process.cwd(), "uploads", "quarantine", id),
      path.join(process.cwd(), "..", "custom", "uploads", "quarantine", shipDoc.id),
    ];

    for (const dir of targetDirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, fileName), buffer);
      } catch (err) {
        console.error("Failed writing upload to disk path:", dir, err);
      }
    }

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

    return NextResponse.json({ document: shipDoc, message: msg });
  } catch (err: any) {
    console.error("Error processing document upload:", err);
    return NextResponse.json({ error: "UPLOAD_FAILED", message: err.message }, { status: 500 });
  }
}
