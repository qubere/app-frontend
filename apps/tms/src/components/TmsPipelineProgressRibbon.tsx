"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
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

function timestamp(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function TmsPipelineProgressRibbon({ shipmentId }: { shipmentId: string }) {
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
    return (
      <div className="rounded-2xl border border-border bg-white p-4 flex items-center gap-3 text-xs text-ink-muted">
        <Loader2 className="w-4 h-4 animate-spin text-brand" />
        Loading TMS processing status…
      </div>
    );
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold disabled:opacity-50"
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

  return (
    <section className={`rounded-2xl border p-4 space-y-3 shadow-2xs ${failed ? "border-red-200 bg-red-50" : active ? "border-blue-200 bg-blue-50" : "border-emerald-200 bg-emerald-50"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {failed ? <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" /> : active ? <RefreshCw className="w-5 h-5 text-brand animate-spin shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-extrabold text-ink">
                {failed
                  ? status.stalled ? "TMS processing stalled" : "TMS processing failed"
                  : active
                    ? status.status === "PENDING" ? "TMS processing queued" : `Running: ${status.activeAgent ?? "agent workflow"}`
                    : reviewCount > 0 ? `Processing complete — ${reviewCount} review item(s)` : "TMS processing complete"}
              </p>
              <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold ${streamConnected ? "text-emerald-700" : "text-amber-700"}`}>
                <Radio className="w-3 h-3" /> {streamConnected ? "LIVE" : "RECONNECTING"}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              {failed
                ? status.stallReason || status.errorMessage || "The run can be safely resumed from its last durable step."
                : `${completedCount} of ${status.totalSteps} agents finished · Attempt ${status.attemptCount || 1} of ${status.maxAttempts}`}
            </p>
            <p className="text-[10px] text-ink-muted mt-1 font-mono">
              Dispatch {status.dispatch?.status ?? "UNKNOWN"} · Heartbeat {timestamp(status.lastHeartbeatAt)}
              {status.nextRetryAt ? ` · Pipeline retry ${timestamp(status.nextRetryAt)}` : ""}
              {status.dispatch?.nextAttemptAt && status.dispatch.status !== "DISPATCHED" ? ` · Dispatch retry ${timestamp(status.dispatch.nextAttemptAt)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-sm font-black text-ink">{status.progressPercent}%</span>
          {failed && status.attemptCount < status.maxAttempts ? (
            <button
              type="button"
              disabled={retrying}
              onClick={() => void callPipeline("pipeline-retry", "retry")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Retrying…" : "Resume"}
            </button>
          ) : !active ? (
            <button
              type="button"
              disabled={starting}
              onClick={() => void callPipeline("pipeline-trigger", "start")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink text-white text-xs font-bold disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" /> {starting ? "Starting…" : "Run again"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-white/80 overflow-hidden border border-black/5">
        <div className={`h-full transition-all duration-500 ${failed ? "bg-red-500" : active ? "bg-brand" : "bg-emerald-500"}`} style={{ width: `${status.progressPercent}%` }} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {status.steps.map((step) => {
          const running = step.status === "RUNNING";
          const done = step.status === "SUCCESS";
          const review = step.status === "REVIEW_REQUIRED";
          const stepFailed = step.status === "FAILED";
          const memories = step.output?.memories ?? [];
          return (
            <details key={step.stepNumber} className={`rounded-xl border px-3 py-2 bg-white/80 ${stepFailed ? "border-red-300" : running ? "border-brand" : review ? "border-amber-300" : done ? "border-emerald-300" : "border-border"}`}>
              <summary className="cursor-pointer list-none">
                <div className="flex items-center gap-1.5">
                  {running ? <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" /> : done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : review ? <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> : stepFailed ? <AlertCircle className="w-3.5 h-3.5 text-red-600" /> : <Clock3 className="w-3.5 h-3.5 text-ink-muted" />}
                  <span className="text-[10px] font-mono font-bold text-ink-muted">STEP {step.stepNumber}</span>
                </div>
                <p className="text-[11px] font-bold text-ink leading-tight mt-1.5">{step.agentName.replace(" Agent", "")}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className={`text-[9px] font-mono font-bold ${review ? "text-amber-700" : stepFailed ? "text-red-700" : done ? "text-emerald-700" : running ? "text-brand" : "text-ink-muted"}`}>{step.status.replace("_", " ")}</p>
                  {memories.length > 0 && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-violet-700"><Brain className="w-3 h-3" />{memories.length}</span>}
                </div>
              </summary>
              {(step.output?.summary || step.errorMessage) && <p className="text-[10px] text-ink mt-2 pt-2 border-t border-border leading-relaxed">{step.errorMessage || step.output?.summary}</p>}
              {step.output?.memoryRetrievalStatus && <p className="text-[9px] font-mono text-ink-muted mt-2">MEMORY {Array.isArray(step.output.memoryRetrievalStatus) ? step.output.memoryRetrievalStatus.join(" / ") : step.output.memoryRetrievalStatus}</p>}
              {memories.map((memory) => (
                <div key={memory.memoryId} className="mt-2 rounded-lg bg-violet-50 border border-violet-100 p-2">
                  <p className="text-[9px] font-bold text-violet-900">{memory.sourceType.replaceAll("_", " ")} · {Math.round(memory.confidence * 100)}%</p>
                  <p className="text-[9px] text-violet-800 mt-0.5 leading-relaxed">{memory.content}</p>
                  <p className="text-[8px] font-mono text-violet-600 mt-1">{memory.memoryId} · score {memory.score.toFixed(4)}</p>
                </div>
              ))}
            </details>
          );
        })}
      </div>

      {status.runs.length > 1 && (
        <details className="rounded-xl border border-border bg-white/70 px-3 py-2">
          <summary className="cursor-pointer list-none flex items-center gap-2 text-xs font-bold text-ink"><History className="w-3.5 h-3.5" /> Previous runs ({status.runs.length - 1})</summary>
          <div className="mt-2 divide-y divide-border">
            {status.runs.slice(1).map((run) => (
              <details key={run.jobId} className="py-2 text-[10px]">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                  <div><span className="font-mono font-bold text-ink">{run.jobId}</span><span className="text-ink-muted"> · {timestamp(run.createdAt)}</span></div>
                  <span className="font-mono font-bold text-ink-muted">{run.status} · {run.progressPercent}% · attempt {run.attemptCount}</span>
                </summary>
                <div className="mt-2 grid md:grid-cols-2 gap-1.5">
                  {run.steps.map((step) => (
                    <div key={step.stepNumber} className="rounded-lg border border-border bg-white px-2 py-1.5">
                      <p className="font-bold text-ink">{step.stepNumber}. {step.agentName} · {step.status}</p>
                      {step.output?.summary && <p className="text-ink-muted mt-0.5">{step.output.summary}</p>}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      )}
      {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
    </section>
  );
}
