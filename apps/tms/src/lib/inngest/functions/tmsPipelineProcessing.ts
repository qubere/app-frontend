import { executeTmsPipelineJob } from "@/lib/tmsPipelineEngine";
import { tmsInngest } from "../client";

export const TMS_PIPELINE_EVENT = "tms/pipeline.requested";

export async function queueTmsPipelineJob(jobId: string): Promise<void> {
  await tmsInngest.send({ name: TMS_PIPELINE_EVENT, data: { jobId } });
}

export const tmsPipelineProcessingJob = (tmsInngest.createFunction as any)(
  {
    id: "tms-document-pipeline-processing",
    retries: 4,
    triggers: [{ event: TMS_PIPELINE_EVENT }],
    concurrency: [{ key: "event.data.jobId", limit: 1 }],
  },
  async ({ event, step }: { event: { data: { jobId: string } }; step: any }) => {
    const result = await step.run("execute-durable-tms-pipeline", () =>
      executeTmsPipelineJob(event.data.jobId)
    );
    return { jobId: event.data.jobId, status: result?.status ?? "UNKNOWN" };
  }
);
