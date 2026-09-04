"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

type MemoryLineage = {
  memoryId: string;
  content: string;
  sourceType: string;
  confidence: number;
  score: number;
  scopeMatches: number;
};

type PipelineStep = {
  stepNumber: number;
  agentName: string;
  surface: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "REVIEW_REQUIRED";
  attempt?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  output?: {
    summary?: string;
    memoryRetrievalStatus?: string | string[];
    memories?: MemoryLineage[];
    missing?: string[];
    thresholds?: Record<string, number>;
  } | null;
  errorMessage?: string | null;
};

type PipelineRun = {
  jobId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  currentStep: number;
  totalSteps: number;
  progressPercent: number;
  activeAgent: string | null;
  attemptCount: number;
  maxAttempts: number;
  stalled: boolean;
  stallReason?: string | null;
  errorMessage?: string | null;
  nextRetryAt?: string | null;
  lastHeartbeatAt?: string | null;
  createdAt: string;
  completedAt?: string | null;
  dispatch?: {
    status: "PENDING" | "DISPATCHING" | "DISPATCHED" | "FAILED";
    attemptCount: number;
    maxAttempts: number;
    nextAttemptAt?: string | null;
    lastError?: string | null;
  } | null;
  steps: PipelineStep[];
};

type PipelineStatus = PipelineRun & { runs: PipelineRun[] };

export function TmsPipelineProgressRibbon({
  shipmentId,
  onNavigateToActivity,
}: {
  shipmentId: string;
  onNavigateToActivity?: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completedJobRef = useRef<string | null>(null);
  const streamHealthyRef = useRef(false);

  const applyStatus = useCallback((next: PipelineStatus | null) => {
    setStatus(next);
    setError(null);
    setLoading(false);
    if (next?.status === "COMPLETED" && completedJobRef.current !== next.jobId) {
      completedJobRef.current = next.jobId;
      router.refresh();
    }
  }, [router]);

  const poll = useCallback(async () => {
    const response = await fetch(`/api/shipments/${encodeURIComponent(shipmentId)}/pipeline-status`, {
      cache: "no-store",
    });
    if (response.status === 404) {
      applyStatus(null);
      return null;
    }
    if (!response.ok) throw new Error("Processing status is temporarily unavailable.");
    const next = (await response.json()) as PipelineStatus;
    applyStatus(next);
    return next;
  }, [applyStatus, shipmentId]);

  useEffect(() => {
    void poll().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Processing status is unavailable.");
      setLoading(false);
    });

    const source = new EventSource(`/api/shipments/${encodeURIComponent(shipmentId)}/pipeline-stream`);
    source.onopen = () => {
      streamHealthyRef.current = true;
      setStreamConnected(true);
    };
    source.onmessage = (event) => {
      try {
        applyStatus(JSON.parse(event.data) as PipelineStatus | null);
      } catch {
        setError("A live pipeline update could not be read.");
      }
    };
    source.onerror = () => {
      streamHealthyRef.current = false;
      setStreamConnected(false);
    };
    const fallback = setInterval(() => {
      if (!streamHealthyRef.current) void poll().catch(() => undefined);
    }, 5000);
    return () => {
      source.close();
      clearInterval(fallback);
      streamHealthyRef.current = false;
    };
  }, [applyStatus, poll, shipmentId]);

  const callPipeline = async (path: "pipeline-retry" | "pipeline-trigger", action: "retry" | "start") => {
    if (action === "retry") setRetrying(true);
    else setStarting(true);
    setError(null);
    try {
      const response = await fetch(`/api/shipments/${encodeURIComponent(shipmentId)}/${path}`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Pipeline ${action} failed.`);
      await poll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Pipeline ${action} failed.`);
    } finally {
      if (action === "retry") setRetrying(false);
      else setStarting(false);
    }
  };

  if (loading) {
    return null;
  }

  if (!status) {
    return (
      <div className="rounded-2xl border border-border bg-white p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Clock3 className="w-4 h-4 text-ink-muted" />
            <div>
              <p className="font-bold text-ink">No document processing run yet</p>
              <p className="text-ink-muted">Upload or attach a freight document, then start the six-agent workflow.</p>
            </div>
          </div>
          <button
            type="button"
            disabled={starting}
            onClick={() => void callPipeline("pipeline-trigger", "start")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" /> {starting ? "Starting…" : "Start processing"}
          </button>
        </div>
        {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
      </div>
    );
  }

  const failed = status.status === "FAILED" || status.stalled;
  const active = status.status === "PENDING" || status.status === "PROCESSING";
  const reviewCount = status.steps.filter((step) => step.status === "REVIEW_REQUIRED").length;
  const completedCount = status.steps.filter((step) => ["SUCCESS", "REVIEW_REQUIRED"].includes(step.status)).length;

  if (status.status === "COMPLETED" && !failed && !active && !starting && !retrying) {
    return null;
  }

  return (
    <div
      onClick={() => onNavigateToActivity?.()}
      className={`rounded-2xl border p-4 space-y-3 shadow-2xs transition-all ${
        onNavigateToActivity ? "cursor-pointer hover:shadow-xs" : ""
      } ${failed ? "border-red-200 bg-red-50 hover:bg-red-100/60" : active ? "border-blue-200 bg-blue-50 hover:bg-blue-100/60" : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100/60"}`}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {failed ? (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          ) : active ? (
            <RefreshCw className="w-5 h-5 text-brand animate-spin shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-extrabold text-ink">
                {failed
                  ? status.stalled
                    ? "TMS processing stalled"
                    : "TMS processing failed"
                  : active
                  ? `Processing Status: ${status.progressPercent}% Done (${completedCount}/${status.totalSteps} steps completed)`
                  : reviewCount > 0
                  ? `Processing Complete — ${reviewCount} review item(s)`
                  : "TMS processing complete"}
              </p>
              <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold ${streamConnected ? "text-emerald-700" : "text-amber-700"}`}>
                <Radio className="w-3 h-3" /> {streamConnected ? "LIVE" : "RECONNECTING"}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5 font-medium">
              {failed
                ? status.stallReason || status.errorMessage || "Processing halted; click to view Agent Executions & Audit Log."
                : active
                ? `Running: ${status.activeAgent ?? "Autonomous Workflow"} · Click to view Agent Executions & Audit Log`
                : "All pipeline steps finished · Click to view Agent Executions & Audit Log"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-sm font-black text-ink">{status.progressPercent}% ({completedCount}/{status.totalSteps} done)</span>
          {failed && status.attemptCount < status.maxAttempts ? (
            <button
              type="button"
              disabled={retrying}
              onClick={(e) => {
                e.stopPropagation();
                void callPipeline("pipeline-retry", "retry");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Retrying…" : "Resume"}
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToActivity?.();
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/90 text-brand text-xs font-extrabold border border-border hover:bg-white cursor-pointer shadow-2xs"
            >
              View Audit Log →
            </button>
          )}
        </div>
      </div>

      <div className="h-2 rounded-full bg-white/80 overflow-hidden border border-black/5">
        <div
          className={`h-full transition-all duration-500 ${failed ? "bg-red-500" : active ? "bg-brand animate-pulse" : "bg-emerald-500"}`}
          style={{ width: `${status.progressPercent}%` }}
        />
      </div>

      {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
