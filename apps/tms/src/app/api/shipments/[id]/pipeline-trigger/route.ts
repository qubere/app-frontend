import { randomUUID } from "node:crypto";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { NextResponse } from "next/server";
import { enqueueTmsDocumentPipeline, TMS_WORKFLOW_TYPE } from "@/lib/tmsPipelineEngine";
import { scheduleTmsPipelineDispatch } from "@/lib/tmsPipelineOutbox";

export const maxDuration = 60;

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    const activeJob = await db.pipelineJob.findFirst({
      where: {
        accountId: ctx.accountId,
        shipmentId: params.id,
        workflowType: TMS_WORKFLOW_TYPE,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      select: { id: true, status: true },
    });
    if (activeJob) {
      return NextResponse.json(
        { error: `Pipeline ${activeJob.id} is already ${activeJob.status.toLowerCase()}.`, requestId },
        { status: 409 }
      );
    }
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
    const dispatch = await scheduleTmsPipelineDispatch(job.id);
    return NextResponse.json({ jobId: job.id, status: job.status, dispatch, requestId }, { status: 202 });
  },
  { permission: "shipment.update", write: true }
);
