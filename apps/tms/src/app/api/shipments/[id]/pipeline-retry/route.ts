import { withAuthenticatedRoute } from "@qubere/auth";
import { after, NextResponse } from "next/server";
import { executeTmsPipelineJob, retryTmsPipeline } from "@/lib/tmsPipelineEngine";
import { queueTmsPipelineJob } from "@/lib/inngest/functions/tmsPipelineProcessing";

export const maxDuration = 60;

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    try {
      const jobId = await retryTmsPipeline(ctx.accountId, params.id, ctx.userId);
      if (process.env.INNGEST_EVENT_KEY) await queueTmsPipelineJob(jobId);
      else {
        after(async () => {
          try {
            await executeTmsPipelineJob(jobId);
          } catch (error) {
            console.error("[TMS pipeline retry]", error);
          }
        });
      }
      return NextResponse.json({ jobId, status: "PENDING", requestId }, { status: 202 });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Pipeline retry failed.", requestId },
        { status: 409 }
      );
    }
  },
  { permission: "shipments.write", write: true }
);
