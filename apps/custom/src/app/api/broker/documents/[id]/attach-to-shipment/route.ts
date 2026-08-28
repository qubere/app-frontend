import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { buildErrorResponse } from "@/lib/api/error";
import { PipelineOrchestrator } from "@/modules/agents/pipelineOrchestrator";

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, requestId, params }) => {
    const { id } = await params;

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

    const targetShipmentId = doc.shipmentId || "general";
    const regularStorageUrl = (doc.fileUrl || "").replace(
      /\/quarantine\/requests\/[^\/]+/,
      `/documents/${targetShipmentId}`
    );

    // 2. Update ShipmentDocument: promote from QUARANTINED to active operational document in PostgreSQL
    const updated = await db.shipmentDocument.update({
      where: { id: doc.id },
      data: {
        status: "NeedsReview",
        fileUrl: regularStorageUrl || `https://blob.vercel-storage.com/documents/${targetShipmentId}/${doc.fileName}`,
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

    // 4. Dispatch Agent Pipeline with full document payload asynchronously
    if (doc.shipmentId) {
      void PipelineOrchestrator.processEvent({
        shipmentId: doc.shipmentId,
        accountId: ctx.accountId,
        userId: ctx.userId,
        triggerEvent: "DOCUMENT_UPLOADED",
        payload: {
          documentId: doc.id,
          fileName: doc.fileName,
          fileUrl: updated.fileUrl || doc.fileUrl || undefined,
          mimeType: doc.mimeType || undefined,
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
          asyncAgentJobStarted: true,
        },
        source: "BROKER_WORKBENCH",
      },
    }).catch(() => {});

    return NextResponse.json({
      document: updated,
      status: "QUEUED",
      asyncJob: true,
      message: `Document ${doc.fileName} approved and queued for background agent processing.`,
    });
  },
  { permission: "shipments.manage", write: true }
);
