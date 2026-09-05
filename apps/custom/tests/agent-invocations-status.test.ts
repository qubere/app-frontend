import { describe, it, expect } from "vitest";
import { buildAgentInvocations } from "@/app/app/shipments/[id]/agentInvocations";

describe("buildAgentInvocations status", () => {
  it("does not mark an older completed run as PROCESSING because a different run's job is active", () => {
    // Old run started well outside both the job-correlation window and the
    // "isRecentRun" fallback window, so it can only be marked PROCESSING if
    // the (unrelated) active job below leaks into it.
    const oldRunStart = new Date(Date.now() - 60 * 60 * 1000);
    const newRunStart = new Date();

    const logs = [
      {
        id: "log-old",
        agentName: "Document Intake Agent",
        timestamp: new Date(oldRunStart.getTime() + 1000).toISOString(),
        durationMs: 1000,
        status: "COMPLETED",
        runId: "run-old",
      },
      {
        id: "log-new",
        agentName: "Document Intake Agent",
        timestamp: new Date(newRunStart.getTime() + 1000).toISOString(),
        durationMs: 1000,
        status: "COMPLETED",
        runId: "run-new",
      },
    ];

    const pipelineJobs = [
      {
        id: "job-new",
        status: "PROCESSING",
        currentStep: 1,
        totalSteps: 8,
        startedAt: newRunStart,
      },
    ];

    const invocations = buildAgentInvocations([], logs, pipelineJobs);
    const oldRun = invocations.find((i) => i.runId === "run-old")!;
    const newRun = invocations.find((i) => i.runId === "run-new")!;

    expect(oldRun.status).toBe("COMPLETED");
    expect(newRun.status).toBe("PROCESSING");
  });
});
