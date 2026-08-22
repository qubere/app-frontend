import { tmsInngest } from "./client";

export const TMS_PIPELINE_EVENT = "tms/pipeline.requested";

export async function queueTmsPipelineJob(jobId: string): Promise<void> {
  await tmsInngest.send({ name: TMS_PIPELINE_EVENT, data: { jobId } });
}
