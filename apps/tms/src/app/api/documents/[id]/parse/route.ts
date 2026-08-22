import { randomUUID } from "node:crypto";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { after, NextResponse } from "next/server";
import { enqueueTmsDocumentPipeline, executeTmsPipelineJob } from "@/lib/tmsPipelineEngine";
import { queueTmsPipelineJob } from "@/lib/inngest/functions/tmsPipelineProcessing";

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
    if (process.env.INNGEST_EVENT_KEY) await queueTmsPipelineJob(job.id);
    else {
      after(async () => {
        try {
          await executeTmsPipelineJob(job.id);
        } catch (error) {
          console.error("[TMS document parse]", error);
        }
      });
    }
    return NextResponse.json({ documentId: document.id, jobId: job.id, status: job.status, requestId }, { status: 202 });
  },
  { permission: "documents.create", write: true }
);
