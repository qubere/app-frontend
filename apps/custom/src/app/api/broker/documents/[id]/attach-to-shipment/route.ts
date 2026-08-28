import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { buildErrorResponse } from "@/lib/api/error";
import { PipelineOrchestrator } from "@/modules/agents/pipelineOrchestrator";
import { loadDocumentBytes } from "@/modules/documents/loadDocumentBytes";
import { storeDocumentFile } from "@/lib/storage";
import { enqueueDocumentParse } from "@/modules/documents/processing/documentProcessingWorker";
import { advanceDocumentProcessing } from "@/modules/documents/processing/advanceProcessing";

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  tif: "image/tiff",
  tiff: "image/tiff",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  txt: "text/plain",
};

function resolveUploadMime(fileName: string, recorded: string | null): string {
  if (recorded && recorded !== "application/octet-stream") return recorded;
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return EXT_MIME[ext] ?? recorded ?? "application/octet-stream";
}

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, requestId, params }) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const bodyShipmentId = typeof body.shipmentId === "string" ? body.shipmentId : undefined;

    // 1. Resolve document either by ShipmentDocument.id or CustomerRequestDocument.id
    let doc = await db.shipmentDocument.findFirst({
      where: { id, accountId: ctx.accountId },
      select: { id: true, shipmentId: true, fileName: true, fileUrl: true, status: true, mimeType: true },
    });

    if (!doc) {
      const reqDoc = await db.customerRequestDocument.findUnique({
        where: { id },
        include: {
          document: {
            select: { id: true, shipmentId: true, fileName: true, fileUrl: true, status: true, mimeType: true },
          },
        },
      });
      if (reqDoc?.document) {
        doc = reqDoc.document;
      }
    }

    if (!doc) {
      return buildErrorResponse(404, "NOT_FOUND", "Document not found in database", undefined, requestId);
    }

    // Resolve target shipment ID from document, request body, or parent customer request link
    let targetShipmentId = doc.shipmentId || bodyShipmentId;
    if (!targetShipmentId) {
      const parentLink = await db.customerRequestDocument.findFirst({
        where: { documentId: doc.id },
        include: { request: { select: { shipmentId: true } } },
      });
      if (parentLink?.request?.shipmentId) {
        targetShipmentId = parentLink.request.shipmentId;
      }
    }

    const storageShipmentFolder = targetShipmentId || "general";

    // Recover the real bytes. Portal uploads land in `rawContent` + the local
    // quarantine directory with a placeholder `fileUrl`; without this the
    // pipeline's extraction agents (Document Intake, Document Intelligence) get
    // no document to read and extraction silently produces nothing.
    const loaded = await loadDocumentBytes(doc.id);

    // Re-store the original under real storage so it has a durable URL and
    // checksum and a Docling parse can fetch it. Best-effort: a failure here
    // must not stop the document being attached or the pipeline running on the
    // in-memory bytes below.
    let storedUrl: string | null = null;
    let storedChecksum: string | null = null;
    let storedMime: string | null = null;
    if (loaded) {
      try {
        const mime = resolveUploadMime(loaded.fileName, loaded.mimeType);
        const stored = await storeDocumentFile(
          new File([new Uint8Array(loaded.buffer)], loaded.fileName, { type: mime }),
          loaded.fileName,
          `documents/${storageShipmentFolder}`
        );
        storedUrl = stored.url;
        storedChecksum = stored.checksum;
        storedMime = mime;
      } catch (err) {
        console.error("[attach-to-shipment] re-store of portal document failed:", err);
      }
    }

    const fallbackUrl = (doc.fileUrl || "").replace(
      /\/quarantine\/requests\/[^\/]+/,
      `/documents/${storageShipmentFolder}`
    );

    // 2. Update ShipmentDocument: link to target shipment, promote from QUARANTINED to NeedsReview in PostgreSQL
    const updated = await db.shipmentDocument.update({
      where: { id: doc.id },
      data: {
        ...(targetShipmentId ? { shipmentId: targetShipmentId } : {}),
        status: "NeedsReview",
        fileUrl:
          storedUrl ||
          fallbackUrl ||
          `https://blob.vercel-storage.com/documents/${storageShipmentFolder}/${doc.fileName}`,
        ...(storedChecksum ? { checksum: storedChecksum } : {}),
        ...(storedMime ? { mimeType: storedMime } : {}),
        ...(loaded ? { byteSize: loaded.buffer.byteLength } : {}),
        portalVisibility: "CUSTOMER",
      },
    });

    // 3. Mark parent CustomerRequest as RESOLVED if linked
    try {
      const parentLink = await db.customerRequestDocument.findFirst({
        where: { documentId: doc.id },
        select: { requestId: true },
      });
      if (parentLink?.requestId) {
        await db.customerRequest.update({
          where: { id: parentLink.requestId },
          data: { status: "RESOLVED" },
        });
      }
    } catch (err) {
      console.warn("Notice: parent customer request status update notice:", err);
    }

    // 3b. Queue a Docling parse so Document Intelligence gets a
    // provenance-carrying parsed context, matching every other upload path.
    // Requires a real storage URL, so only runs when the re-store succeeded.
    if (storedUrl && storedChecksum) {
      try {
        const queued = await enqueueDocumentParse({
          accountId: ctx.accountId,
          documentId: doc.id,
          contentSha256: storedChecksum,
          profile: "STANDARD",
          reason: "INITIAL",
        });
        if (queued.blocker === null) {
          advanceDocumentProcessing({ reason: "document.attach-to-shipment" });
        }
      } catch (err) {
        console.error("[attach-to-shipment] enqueue Docling parse failed:", err);
      }
    }

    // 4. Dispatch Agent Pipeline with full document payload asynchronously
    if (updated.shipmentId) {
      void PipelineOrchestrator.processEvent({
        shipmentId: updated.shipmentId,
        accountId: ctx.accountId,
        userId: ctx.userId,
        triggerEvent: "DOCUMENT_UPLOADED",
        payload: {
          documentId: doc.id,
          fileName: doc.fileName,
          fileUrl: updated.fileUrl || doc.fileUrl || undefined,
          fileBuffer: loaded?.buffer,
          mimeType: storedMime || doc.mimeType || loaded?.mimeType || undefined,
        },
      }).catch((pipelineErr) => {
        console.error("[AsyncJob] Agent pipeline background execution error:", pipelineErr);
      });
    }

    // 5. Create security audit log entry
    void db.auditLog.create({
      data: {
        accountId: ctx.accountId,
        userId: ctx.userId,
        actorUserId: ctx.userId,
        effectiveUserId: ctx.userId,
        action: "APPROVE_QUARANTINE_DOCUMENT_AND_START_AGENT_PIPELINE",
        entity: "ShipmentDocument",
        entityId: doc.id,
        newValue: {
          fileName: doc.fileName,
          previousUrl: doc.fileUrl,
          regularStorageUrl: updated.fileUrl,
          previousStatus: doc.status,
          newStatus: updated.status,
          shipmentId: updated.shipmentId,
          asyncAgentJobStarted: true,
        },
        source: "BROKER_WORKBENCH",
      },
    }).catch(() => {});

    return NextResponse.json({
      document: updated,
      status: "QUEUED",
      asyncJob: true,
      message: `Document ${doc.fileName} approved, attached to shipment, and queued for background agent processing.`,
    });
  },
  { permission: "shipments.manage", write: true }
);
