export interface InvocationStep {
  id: string;
  agentName: string;
  status: "COMPLETED" | "FAILED" | "REVIEW" | "RUNNING";
  rawStatus: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  summary?: string;
  confidence?: number | null;
  modelVersion?: string | null;
  error?: string;
  inputSnapshot?: unknown;
  outputSnapshot?: unknown;
}

export interface AgentInvocation {
  runId: string;
  invokedBy: string;
  triggerEvent: string;
  startedAt: string;
  completedAt: string | null;
  totalDurationMs: number;
  status: "COMPLETED" | "FAILED" | "REVIEW" | "RUNNING";
  steps: InvocationStep[];
}

export function buildTmsAgentInvocations(
  pipelineJobs: any[] = [],
  agentDecisions: any[] = []
): AgentInvocation[] {
  const invocations: AgentInvocation[] = [];

  for (const job of pipelineJobs || []) {
    const runId = job.id;
    const triggerEvent = job.state?.trigger || job.workflowType || "DOCUMENT_UPLOADED";
    const invokedBy = job.userId || job.state?.fileName || "Document Intake";

    const steps: InvocationStep[] = [];
    const jobExecutions = job.stepExecutions || [];

    for (const exec of jobExecutions) {
      const stepStart = exec.startedAt || exec.createdAt || job.createdAt;
      const stepEnd = exec.completedAt || null;
      const durationMs =
        stepStart && stepEnd ? new Date(stepEnd).getTime() - new Date(stepStart).getTime() : 0;

      let status: InvocationStep["status"] = "COMPLETED";
      if (exec.status === "FAILED") status = "FAILED";
      else if (exec.status === "RUNNING" || exec.status === "PROCESSING") status = "RUNNING";
      else if (exec.status === "REVIEW_REQUIRED") status = "REVIEW";

      const outputData = exec.output && typeof exec.output === "object" ? exec.output : {};

      // Match agentDecision for this step if present
      const matchedDecision = (agentDecisions || []).find(
        (d: any) =>
          d.agentName === exec.agentName &&
          (exec.documentId ? d.documentId === exec.documentId : true)
      );

      steps.push({
        id: exec.id,
        agentName: exec.agentName || `Step ${exec.stepNumber}`,
        status,
        rawStatus: exec.status || "RUNNING",
        startedAt: new Date(stepStart).toISOString(),
        completedAt: stepEnd ? new Date(stepEnd).toISOString() : null,
        durationMs,
        summary: outputData.summary || matchedDecision?.decisionSummary || undefined,
        confidence: outputData.confidence ?? matchedDecision?.confidence ?? null,
        modelVersion: matchedDecision?.modelVersion || "gemini-2.5-flash",
        error: exec.errorMessage || undefined,
        inputSnapshot: { jobId: job.id, stepNumber: exec.stepNumber, documentId: job.state?.documentId },
        outputSnapshot: outputData.summary ? outputData : matchedDecision?.evidenceItems ?? outputData,
      });
    }

    steps.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

    const startTimes = steps.map((s) => new Date(s.startedAt).getTime()).filter((t) => !Number.isNaN(t));
    const endTimes = steps.map((s) => (s.completedAt ? new Date(s.completedAt).getTime() : null)).filter((t): t is number => t !== null && !Number.isNaN(t));

    const startedAt = startTimes.length ? new Date(Math.min(...startTimes)).toISOString() : new Date(job.createdAt || Date.now()).toISOString();
    const completedAt = endTimes.length ? new Date(Math.max(...endTimes)).toISOString() : job.completedAt ? new Date(job.completedAt).toISOString() : null;
    const totalDurationMs = completedAt ? new Date(completedAt).getTime() - new Date(startedAt).getTime() : 0;

    let jobStatus: AgentInvocation["status"] = "COMPLETED";
    if (job.status === "FAILED" || steps.some((s) => s.status === "FAILED")) jobStatus = "FAILED";
    else if (job.status === "PROCESSING" || job.status === "PENDING" || steps.some((s) => s.status === "RUNNING")) jobStatus = "RUNNING";
    else if (steps.some((s) => s.status === "REVIEW")) jobStatus = "REVIEW";

    invocations.push({
      runId,
      invokedBy,
      triggerEvent,
      startedAt,
      completedAt,
      totalDurationMs,
      status: jobStatus,
      steps,
    });
  }

  invocations.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return invocations;
}
