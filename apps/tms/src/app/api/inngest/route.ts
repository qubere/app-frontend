import { serve } from "inngest/next";
import { tmsInngest } from "@/lib/inngest/client";
import { tmsMemoryExtractionJob } from "@/lib/inngest/functions/tmsMemoryExtraction";
import { tmsPipelineProcessingJob } from "@/lib/inngest/functions/tmsPipelineProcessing";

export const { GET, POST, PUT } = serve({
  client: tmsInngest,
  functions: [tmsMemoryExtractionJob, tmsPipelineProcessingJob],
});
