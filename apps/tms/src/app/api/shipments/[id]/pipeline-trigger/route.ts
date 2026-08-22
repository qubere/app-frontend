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
      where: { accountId: ctx.accountId, shipmentId: params.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!document) {
      return NextResponse.json(
        { error: "Upload or attach a document before starting TMS processing.", requestId },
        { status: 409 }
      );
    }
    const runKey = randomUUID();
    const job = await enqueueTmsDocumentPipeline({
      accountId: ctx.accountId,
      userId: ctx.userId,
      shipmentId: params.id,
      documentId: document.id,
      correlationId: runKey,
      runKey,
    });
    if (process.env.INNGEST_EVENT_KEY) await queueTmsPipelineJob(job.id);
    else {
      after(async () => {
        try {
          await executeTmsPipelineJob(job.id);
        } catch (error) {
          console.error("[TMS pipeline manual trigger]", error);
        }
      });
    }
    return NextResponse.json({ jobId: job.id, status: job.status, requestId }, { status: 202 });
  },
  { permission: "shipments.write", write: true }
);
