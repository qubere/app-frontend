import { randomUUID } from "node:crypto";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { NextResponse } from "next/server";
import { enqueueTmsDocumentPipeline } from "@/lib/tmsPipelineEngine";
import { scheduleTmsPipelineDispatch } from "@/lib/tmsPipelineOutbox";

export const maxDuration = 60;

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    const document = await db.shipmentDocument.findFirst({
      where: { id: params.id, accountId: ctx.accountId },
      select: { id: true, shipmentId: true },
    });
    if (!document) return NextResponse.json({ error: "Document not found.", requestId }, { status: 404 });
    if (!document.shipmentId) {
      return NextResponse.json(
        { error: "Attach the document to a shipment before processing.", requestId },
        { status: 409 }
      );
    }
    const runKey = randomUUID();
    const job = await enqueueTmsDocumentPipeline({
      accountId: ctx.accountId,
      userId: ctx.userId,
      shipmentId: document.shipmentId,
      documentId: document.id,
      correlationId: runKey,
      runKey,
      forceExtraction: true,
    });
    const dispatch = await scheduleTmsPipelineDispatch(job.id);
    return NextResponse.json({ documentId: document.id, jobId: job.id, status: job.status, dispatch, requestId }, { status: 202 });
  },
  { permission: "documents.create", write: true }
);
