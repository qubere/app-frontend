import { executeTmsPipelineJob } from "@/lib/tmsPipelineEngine";
import { recoverTmsPipelineDispatches } from "@/lib/tmsPipelineOutbox";
import { tmsInngest } from "../client";
import { TMS_PIPELINE_EVENT } from "../tmsPipelineEvents";

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

export const tmsPipelineRecoveryJob = (tmsInngest.createFunction as any)(
  {
    id: "tms-pipeline-outbox-recovery",
    retries: 2,
    triggers: [{ cron: "*/2 * * * *" }],
    concurrency: [{ limit: 1 }],
  },
  async ({ step }: { step: any }) =>
    step.run("recover-undelivered-tms-workflows", () => recoverTmsPipelineDispatches())
);
