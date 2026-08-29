import { inngest } from "../client";
import { executeReportRun } from "@/modules/reports/generate";
import { deliverReportRun } from "@/modules/reports/delivery";

/** Fired whenever a ReportRun should be executed -- decouples request/response from generation so a slow report never risks a serverless timeout. */
export const REPORT_RUN_REQUESTED_EVENT = "reports/run.requested";

export const reportRunExecuteJob = (inngest.createFunction as any)(
  { id: "report-run-execute", retries: 2, triggers: [{ event: REPORT_RUN_REQUESTED_EVENT }] },
  async ({ event, step }: { event: any; step: any }) => {
    const runId = event.data.runId as string;
    await step.run("execute-report-run", () => executeReportRun(runId));
    await step.run("deliver-report-run", () => deliverReportRun(runId));
  }
);
