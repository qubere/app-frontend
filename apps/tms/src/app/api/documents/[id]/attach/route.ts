import { randomUUID } from "node:crypto";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import { after, NextResponse } from "next/server";
import { enqueueTmsDocumentPipeline, executeTmsPipelineJob } from "@/lib/tmsPipelineEngine";
import { queueTmsPipelineJob } from "@/lib/inngest/functions/tmsPipelineProcessing";

export const maxDuration = 60;

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, params, requestId }) => {
    const body = await req.json().catch(() => ({}));
    const shipmentId = typeof body.shipmentId === "string" ? body.shipmentId.trim() : "";
    if (!shipmentId) {
      return NextResponse.json({ error: "shipmentId is required.", requestId }, { status: 400 });
    }
    const [document, shipment] = await Promise.all([
      db.shipmentDocument.findFirst({ where: { id: params.id, accountId: ctx.accountId } }),
      db.shipment.findFirst({ where: { id: shipmentId, accountId: ctx.accountId, deletedAt: null }, select: { id: true } }),
    ]);
    if (!document) return NextResponse.json({ error: "Document not found.", requestId }, { status: 404 });
    if (!shipment) return NextResponse.json({ error: "Shipment not found in this account.", requestId }, { status: 404 });

    const correlationId = randomUUID();
    const updated = await db.shipmentDocument.update({
      where: { id: document.id },
      data: { shipmentId, status: document.extractedJson ? document.status : "Processing" },
    });
    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "TMS_DOCUMENT_ATTACHED",
      entity: "ShipmentDocument",
      entityId: document.id,
      source: "UI",
      requestId,
      correlationId,
      metadata: { previousShipmentId: document.shipmentId, shipmentId, fileName: document.fileName },
      failClosed: true,
    });

    const job = await enqueueTmsDocumentPipeline({
      accountId: ctx.accountId,
      userId: ctx.userId,
      shipmentId,
      documentId: document.id,
      correlationId,
    });
    if (process.env.INNGEST_EVENT_KEY) await queueTmsPipelineJob(job.id);
    else {
      after(async () => {
        try {
          await executeTmsPipelineJob(job.id);
        } catch (error) {
          console.error("[TMS document attach pipeline]", error);
        }
      });
    }
    return NextResponse.json(
      { document: updated, jobId: job.id, status: job.status, requestId },
      { status: 202 }
    );
  },
  { permission: "documents.create", write: true }
);
