import { withAuthenticatedRoute } from "@qubere/auth";
import { NextResponse } from "next/server";
import { retryTmsPipeline } from "@/lib/tmsPipelineEngine";
import { scheduleTmsPipelineDispatch } from "@/lib/tmsPipelineOutbox";

export const maxDuration = 60;

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    try {
      const jobId = await retryTmsPipeline(ctx.accountId, params.id, ctx.userId);
      const dispatch = await scheduleTmsPipelineDispatch(jobId);
      return NextResponse.json({ jobId, status: "PENDING", dispatch, requestId }, { status: 202 });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Pipeline retry failed.", requestId },
        { status: 409 }
      );
    }
  },
  { permission: "shipments.write", write: true }
);
