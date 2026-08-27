import { createHash, randomUUID } from "node:crypto";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import { NextResponse } from "next/server";
import { enqueueTmsDocumentPipeline } from "@/lib/tmsPipelineEngine";
import {
  scheduleTmsPipelineDispatch,
} from "@/lib/tmsPipelineOutbox";
import { safeDocumentFileName, storeTmsDocument } from "@/lib/documentStorage";

export const maxDuration = 60;

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

function fileSignatureMatches(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return false;
}

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const formData = await req.formData();
    const file = formData.get("file");
    const shipmentId = typeof formData.get("shipmentId") === "string"
      ? String(formData.get("shipmentId")).trim()
      : "";
    const declaredDocType = typeof formData.get("docType") === "string"
      ? String(formData.get("docType")).trim()
      : "OTHER";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was provided.", requestId }, { status: 400 });
    }
    if (!shipmentId) {
      return NextResponse.json({ error: "A shipment is required to run TMS document processing.", requestId }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File must be between 1 byte and 25 MB.", requestId }, { status: 400 });
    }
    const mimeType = file.type || "application/pdf";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json({ error: "Only PDF, PNG, and JPEG freight documents are supported.", requestId }, { status: 415 });
    }

    const shipment = await db.shipment.findFirst({
      where: { id: shipmentId, accountId: ctx.accountId, deletedAt: null },
      select: { id: true },
    });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found in this account.", requestId }, { status: 404 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!fileSignatureMatches(bytes, mimeType)) {
      return NextResponse.json({ error: "The file contents do not match the declared file type.", requestId }, { status: 400 });
    }
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const correlationId = randomUUID();
    const existing = await db.shipmentDocument.findFirst({
      where: { accountId: ctx.accountId, shipmentId, checksum },
    });

    let document = existing;
    let storageProvider: "GCS" | "VERCEL_BLOB" | "LOCAL_DEV" | "EXISTING" = "EXISTING";
    if (!document) {
      const stored = await storeTmsDocument({
        accountId: ctx.accountId,
        storageName: `${Date.now()}-${randomUUID()}-${safeDocumentFileName(file.name)}`,
        mimeType,
        bytes,
      });
      storageProvider = stored.provider;
      document = await db.shipmentDocument.create({
        data: {
          accountId: ctx.accountId,
          shipmentId,
          fileName: safeDocumentFileName(file.name),
          fileUrl: stored.url,
          checksum,
          byteSize: file.size,
          mimeType,
          docType: declaredDocType || "OTHER",
          status: "Processing",
          confidence: null,
          source: "UPLOAD",
        },
      });
    }

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: existing ? "TMS_DOCUMENT_DUPLICATE_REUSED" : "TMS_DOCUMENT_UPLOADED",
      entity: "ShipmentDocument",
      entityId: document.id,
      source: "UI",
      requestId,
      correlationId,
      failClosed: true,
      metadata: {
        shipmentId,
        fileName: document.fileName,
        mimeType,
        byteSize: file.size,
        checksum,
        storageProvider,
      },
    });

    const job = await enqueueTmsDocumentPipeline({
      accountId: ctx.accountId,
      userId: ctx.userId,
      shipmentId,
      documentId: document.id,
      correlationId,
    });

    const dispatch = await scheduleTmsPipelineDispatch(job.id);

    return NextResponse.json(
      {
        status: job.status === "COMPLETED" ? "COMPLETED" : "ACCEPTED",
        requestId,
        correlationId,
        shipmentId,
        documentId: document.id,
        jobId: job.id,
        duplicate: Boolean(existing),
        dispatch,
        message: existing
          ? "Existing document reused; processing status is available on the shipment."
          : "Document stored and queued for TMS agent processing.",
      },
      { status: 202 }
    );
  },
  { permission: "document.upload", write: true }
);
