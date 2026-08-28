import type { CanonicalShipment } from "@/modules/shipment/canonicalShipmentService";

export interface InvocationStep {
  id: string;
  stepNumber: number;
  agentName: string;
  durationMs: number;
  status: "SUCCESS" | "FAILED" | "REVIEW" | "RUNNING";
  startedAt: string;
  completedAt?: string;
  summary?: string;
  confidence?: unknown;
  modelVersion?: string | null;
  error?: string | null;
  inputSnapshot?: unknown;
  outputSnapshot?: unknown;
}

export interface PipelineJobRow {
  id: string;
  status: string;
  currentStep?: number;
  totalSteps?: number;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  errorMessage?: string | null;
}

export interface AgentInvocation {
  runId: string;
  invokedBy: string;
  triggerEvent: string;
  startedAt: string;
  completedAt: string | null;
  totalDurationMs: number;
  status: "COMPLETED" | "FAILED" | "REVIEW" | "RUNNING" | "PROCESSING";
  currentStep: number;
  totalSteps: number;
  isProcessing: boolean;
  steps: InvocationStep[];
}

function normalizeLogStatus(status: string): InvocationStep["status"] {
  const upper = status.toUpperCase();
  if (upper === "COMPLETED" || upper === "SUCCESS" || upper === "PASSED" || upper === "OK") return "SUCCESS";
  if (upper === "FAILED" || upper === "ERROR") return "FAILED";
  if (upper === "RUNNING" || upper === "IN_PROGRESS" || upper === "PENDING" || upper === "PROCESSING") return "RUNNING";
  return "REVIEW"; // "Review Required" | "Attention"
}

function clusterLegacyByTime<T>(items: T[], getStartMs: (item: T) => number, sourcePrefix: string): Map<T, string> {
  const sorted = [...items].sort((a, b) => getStartMs(a) - getStartMs(b));
  const clusterOf = new Map<T, string>();
  let currentClusterId = "";
  let lastStartMs = -Infinity;
  const GAP_MS = 6000;

  for (const item of sorted) {
    const ms = getStartMs(item);
    if (ms - lastStartMs > GAP_MS) {
      currentClusterId = `${sourcePrefix}_legacy_${ms}`;
    }
    clusterOf.set(item, currentClusterId);
    lastStartMs = ms;
  }
  return clusterOf;
}

export interface AgentExecutionRecordRow {
  id: string;
  agentName: string;
  startedAt: Date | string;
  completedAt?: Date | string | null;
  status: string;
  runId?: string | null;
  invokedBy?: string | null;
  triggerEvent?: string | null;
  summary?: string | null;
  confidence?: unknown;
  modelVersion?: string | null;
  error?: string | null;
  inputSnapshot?: unknown;
  outputSnapshot?: unknown;
}

export interface AgentExecutionLogRow {
  id: string;
  agentName: string;
  timestamp: Date | string;
  durationMs?: number | null;
  status: string;
  runId?: string | null;
  invokedBy?: string | null;
  triggerEvent?: string | null;
  summary?: string;
  inputSnapshot?: unknown;
  outputSnapshot?: unknown;
}

export function buildAgentInvocations(
  records: AgentExecutionRecordRow[],
  logs: AgentExecutionLogRow[],
  pipelineJobs: PipelineJobRow[] = []
): AgentInvocation[] {
  const groups = new Map<string, AgentInvocation>();

  const ensureGroup = (runId: string, invokedBy: string, triggerEvent: string) => {
    let g = groups.get(runId);
    if (!g) {
      g = {
        runId,
        invokedBy,
        triggerEvent,
        startedAt: "",
        completedAt: null,
        totalDurationMs: 0,
        status: "COMPLETED",
        currentStep: 0,
        totalSteps: 0,
        isProcessing: false,
        steps: [],
      };
      groups.set(runId, g);
    }
    return g;
  };

  // Add records (selective agent re-runs)
  const unrunnedRecords = (records || []).filter((r) => !r.runId);
  const legacyRecordClusters = clusterLegacyByTime(
    unrunnedRecords,
    (r) => new Date(r.startedAt).getTime(),
    "rec"
  );

  for (const rec of records || []) {
    const runId = rec.runId || legacyRecordClusters.get(rec)!;
    const g = ensureGroup(runId, rec.invokedBy || "Agent Execution", rec.triggerEvent || "MANUAL_RERUN");

    const startMs = new Date(rec.startedAt).getTime();
    const endMs = rec.completedAt ? new Date(rec.completedAt).getTime() : startMs;
    const durationMs = Math.max(0, endMs - startMs);

    g.steps.push({
      id: rec.id,
      stepNumber: g.steps.length + 1,
      agentName: rec.agentName,
      durationMs,
      status: normalizeLogStatus(rec.status),
      startedAt: new Date(rec.startedAt).toISOString(),
      completedAt: rec.completedAt ? new Date(rec.completedAt).toISOString() : undefined,
      summary: rec.summary || (rec.error ? `Error: ${rec.error}` : `Status: ${rec.status}`),
      inputSnapshot: rec.inputSnapshot,
      outputSnapshot: rec.outputSnapshot,
    });
  }

  // Add execution logs (10-agent pipeline run)
  const unrunnedLogs = (logs || []).filter((l) => !l.runId);
  const legacyLogClusters = clusterLegacyByTime(
    unrunnedLogs,
    (l) => new Date(l.timestamp).getTime() - (l.durationMs || 0),
    "log"
  );

  for (const log of logs || []) {
    const runId = log.runId || legacyLogClusters.get(log)!;
    const g = ensureGroup(runId, log.invokedBy || "Document Upload", log.triggerEvent || "DOCUMENT_UPLOADED");
    const completedAt = new Date(log.timestamp);
    const durationMs = log.durationMs || 0;
    const startedAt = new Date(completedAt.getTime() - durationMs);

    g.steps.push({
      id: log.id,
      stepNumber: g.steps.length + 1,
      agentName: log.agentName,
      durationMs,
      status: normalizeLogStatus(log.status),
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      summary: log.summary || `Executed ${log.agentName}`,
      inputSnapshot: log.inputSnapshot,
      outputSnapshot: log.outputSnapshot,
    });
  }

  // Derive per-group start/completion times and status
  const invocations: AgentInvocation[] = Array.from(groups.values()).map((g) => {
    g.steps.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    g.steps.forEach((step, idx) => {
      step.stepNumber = idx + 1;
    });

    const startTimes = g.steps.map((s) => new Date(s.startedAt).getTime()).filter((t) => !Number.isNaN(t));
    const endTimes = g.steps
      .map((s) => (s.completedAt ? new Date(s.completedAt).getTime() : null))
      .filter((t): t is number => t !== null && !Number.isNaN(t));
    const startedAt = startTimes.length ? new Date(Math.min(...startTimes)).toISOString() : new Date().toISOString();
    const completedAt = endTimes.length ? new Date(Math.max(...endTimes)).toISOString() : null;
    const totalDurationMs = completedAt ? new Date(completedAt).getTime() - new Date(startedAt).getTime() : 0;

    const hasFailed = g.steps.some((s) => s.status === "FAILED");
    const hasRunningStep = g.steps.some((s) => s.status === "RUNNING");
    const hasReview = g.steps.some((s) => s.status === "REVIEW");

    // Match pipelineJob if available
    const activeJob = (pipelineJobs || []).find(
      (pj) => pj.status === "PROCESSING" || pj.status === "PENDING"
    );
    const jobForRun = activeJob || (pipelineJobs || [])[0];

    const expectedTotalSteps =
      jobForRun?.totalSteps ||
      (g.triggerEvent === "DOCUMENT_UPLOADED" || g.triggerEvent === "DOCUMENT_PARSE_PROMOTED" ? 10 : Math.max(g.steps.length, 1));

    const isRecentRun = Date.now() - new Date(startedAt).getTime() < 10 * 60 * 1000;
    const isJobProcessing = activeJob !== undefined || (isRecentRun && g.steps.length < expectedTotalSteps && !hasFailed);

    let status: AgentInvocation["status"] = "COMPLETED";
    if (hasFailed) {
      status = "FAILED";
    } else if (hasRunningStep || isJobProcessing) {
      status = "PROCESSING";
    } else if (hasReview) {
      status = "REVIEW";
    } else {
      status = "COMPLETED";
    }

    const currentStep = jobForRun?.currentStep || (hasRunningStep
      ? g.steps.filter((s) => s.status === "SUCCESS" || s.status === "REVIEW").length + 1
      : g.steps.length);

    const totalSteps = status === "PROCESSING" ? expectedTotalSteps : Math.max(g.steps.length, expectedTotalSteps);
    const isProcessing = status === "PROCESSING";

    return {
      ...g,
      startedAt,
      completedAt: isProcessing ? null : completedAt,
      totalDurationMs,
      status,
      currentStep: Math.min(currentStep, totalSteps),
      totalSteps,
      isProcessing,
    };
  });

  invocations.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return invocations;
}
