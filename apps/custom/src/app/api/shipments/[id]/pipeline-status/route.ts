import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().min(1) });

export const GET = withAuthenticatedRoute<{ id: string }>(async ({ ctx, requestId, params }) => {
  const paramsVal = validatePathParams(params, paramsSchema, requestId);
  if ("response" in paramsVal) return paramsVal.response;
  const { id } = paramsVal.data;

  // Fetch the most recent pipeline job for this shipment
  const job = await db.pipelineJob.findFirst({
    where: { shipmentId: id, accountId: ctx.accountId },
    orderBy: { createdAt: "desc" },
    include: { stepExecutions: true },
  });

  const processingDoc = await db.shipmentDocument.findFirst({
    where: {
      shipmentId: id,
      status: { in: ["PENDING", "PROCESSING", "EXTRACTING", "QUEUED", "SUBMITTED", "POLLING"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (processingDoc) {
    const docTime = processingDoc.createdAt.toISOString();
    return NextResponse.json({
      jobId: `doc-${processingDoc.id}`,
      status: "PROCESSING",
      stalled: false,
      currentStep: 1,
      totalSteps: 3,
      startedAt: docTime,
      completedAt: null,
      errorMessage: null,
      stepExecutions: [
        {
          stepNumber: 1,
          agentName: "Document Parser & OCR Agent",
          status: "PROCESSING",
          startedAt: docTime,
        },
        {
          stepNumber: 2,
          agentName: "Customs Classification Agent",
          status: "PENDING",
          startedAt: docTime,
        },
        {
          stepNumber: 3,
          agentName: "Filing Readiness Evaluator",
          status: "PENDING",
          startedAt: docTime,
        },
      ],
    });
  }

  if (!job) {
    return NextResponse.json({ error: "No pipeline job found" }, { status: 404 });
  }

  const STALL_THRESHOLD_MS = 5 * 60 * 1000;
  const isStalled =
    job.status === "PROCESSING" &&
    job.lockedAt !== null &&
    Date.now() - new Date(job.lockedAt).getTime() > STALL_THRESHOLD_MS;

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    stalled: isStalled,
    currentStep: job.currentStep,
    totalSteps: job.totalSteps,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    errorMessage: job.errorMessage,
    stepExecutions: job.stepExecutions,
  });
});
