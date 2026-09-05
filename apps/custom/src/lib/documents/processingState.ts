/**
 * Rolls the `GET /api/documents/{id}/processing` payload up into one badge
 * state, so the Documents UI can show "Parsing…" / "Processed" / "Failed"
 * without every caller re-deriving it from the run list.
 */

export type ProcessingRollupState =
  | "not_started"
  | "queued"
  | "parsing"
  | "extracting"
  | "processed"
  | "needs_review"
  | "failed"
  | "mock"
  | "blocked";

export interface ProcessingRollup {
  state: ProcessingRollupState;
  label: string;
  tone: "neutral" | "progress" | "success" | "warn" | "error";
  detail: string | null;
  /** True while the state can still change on its own — the caller should poll. */
  polling: boolean;
}

export interface ProcessingRun {
  id: string;
  version: number;
  status: string;
  isActive?: boolean;
  parser?: { provider?: string | null } | null;
  error?: { code?: string | null; message?: string | null } | null;
}

export interface AgentTimelineStep {
  id: string;
  agentName: string;
  summary?: string | null;
  status: string;
  durationMs?: number | null;
  startedAt: string;
}

export interface ProcessingResponse {
  parser?: { isMock?: boolean; blocker?: string | null } | null;
  runs?: ProcessingRun[] | null;
  document?: { activeProcessingRunId?: string | null } | null;
  agentTimeline?: AgentTimelineStep[] | null;
}

const TERMINAL: ProcessingRollupState[] = [
  "not_started",
  "processed",
  "needs_review",
  "failed",
  "mock",
  "blocked",
];

export function isTerminalProcessingState(s: ProcessingRollupState): boolean {
  return TERMINAL.includes(s);
}

export function rollupProcessingState(res: ProcessingResponse | null | undefined): ProcessingRollup {
  const runs = res?.runs ?? [];
  const blocker = res?.parser?.blocker ?? null;

  if (runs.length === 0) {
    return blocker
      ? { state: "blocked", label: "Parser unavailable", tone: "error", detail: blocker, polling: false }
      : { state: "not_started", label: "Not processed", tone: "neutral", detail: null, polling: false };
  }

  // The active run if one is marked, else the newest (runs are version-desc).
  const run = runs.find((r) => r.isActive) ?? runs[0];
  const usedMock = (run.parser?.provider ?? "").toUpperCase().includes("MOCK");

  switch (run.status) {
    case "QUEUED":
      return { state: "queued", label: "Queued", tone: "progress", detail: null, polling: true };
    case "SUBMITTED":
    case "POLLING":
      return { state: "parsing", label: "Parsing…", tone: "progress", detail: null, polling: true };
    case "SUCCEEDED":
      if (usedMock) {
        return {
          state: "mock",
          label: "Mock — not evidence",
          tone: "warn",
          detail: "Parsed by the mock provider, not IBM Docling. This result is not evidence.",
          polling: false,
        };
      }
      // Parse is done; downstream extraction runs right after. Treat "succeeded
      // but not yet the document's active version" as still finishing.
      if (run.isActive || res?.document?.activeProcessingRunId) {
        return { state: "processed", label: "Processed", tone: "success", detail: null, polling: false };
      }
      return { state: "extracting", label: "Extracting…", tone: "progress", detail: null, polling: true };
    case "NEEDS_REVIEW":
      return {
        state: "needs_review",
        label: "Needs review",
        tone: "warn",
        detail: "Parsing finished but the quality gate wants a person to look.",
        polling: false,
      };
    case "FAILED":
      return {
        state: "failed",
        label: "Failed",
        tone: "error",
        detail: run.error?.message ?? run.error?.code ?? blocker ?? "Processing failed.",
        polling: false,
      };
    default:
      return { state: "queued", label: run.status, tone: "progress", detail: null, polling: true };
  }
}
