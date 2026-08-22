"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock3, Loader2, RefreshCw, RotateCcw } from "lucide-react";

type PipelineStep = {
  stepNumber: number;
  agentName: string;
  surface: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "REVIEW_REQUIRED";
  output?: { summary?: string } | null;
  errorMessage?: string | null;
};

type PipelineStatus = {
  jobId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  currentStep: number;
  totalSteps: number;
  progressPercent: number;
  activeAgent: string | null;
  attemptCount: number;
  maxAttempts: number;
  stalled: boolean;
  errorMessage?: string | null;
  nextRetryAt?: string | null;
  steps: PipelineStep[];
};

export function TmsPipelineProgressRibbon({ shipmentId }: { shipmentId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completedJobRef = useRef<string | null>(null);

  const poll = useCallback(async () => {
    const response = await fetch(`/api/shipments/${encodeURIComponent(shipmentId)}/pipeline-status`, {
      cache: "no-store",
    });
    if (response.status === 404) {
      setStatus(null);
      setLoading(false);
      return null;
    }
    if (!response.ok) throw new Error("Processing status is temporarily unavailable.");
    const next = (await response.json()) as PipelineStatus;
    setStatus(next);
    setError(null);
    setLoading(false);
    if (next.status === "COMPLETED" && completedJobRef.current !== next.jobId) {
      completedJobRef.current = next.jobId;
      router.refresh();
    }
    return next;
  }, [router, shipmentId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = async () => {
      try {
        const next = await poll();
        if (cancelled) return;
        const delay = next?.status === "PENDING" || next?.status === "PROCESSING" ? 1500 : 10000;
        timer = setTimeout(run, delay);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Processing status is unavailable.");
        setLoading(false);
        timer = setTimeout(run, 5000);
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [poll]);

  const retry = async () => {
    setRetrying(true);
    setError(null);
    try {
      const response = await fetch(`/api/shipments/${encodeURIComponent(shipmentId)}/pipeline-retry`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Pipeline retry failed.");
      await poll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pipeline retry failed.");
    } finally {
      setRetrying(false);
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
      <div className="rounded-2xl border border-border bg-white p-4 flex items-center gap-3 text-xs">
        <Clock3 className="w-4 h-4 text-ink-muted" />
        <div>
          <p className="font-bold text-ink">No document processing run yet</p>
          <p className="text-ink-muted">Upload or attach a freight document to start the six-agent workflow.</p>
        </div>
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
          {failed ? (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          ) : active ? (
            <RefreshCw className="w-5 h-5 text-brand animate-spin shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-ink">
              {failed
                ? status.stalled ? "TMS processing stalled" : "TMS processing failed"
                : active
                  ? status.status === "PENDING" ? "TMS processing queued" : `Running: ${status.activeAgent ?? "agent workflow"}`
                  : reviewCount > 0 ? `Processing complete — ${reviewCount} review item(s)` : "TMS processing complete"}
            </p>
            <p className="text-xs text-ink-muted mt-0.5">
              {failed
                ? status.errorMessage || "The run can be safely resumed from its last durable step."
                : `${completedCount} of ${status.totalSteps} agents finished · Attempt ${status.attemptCount || 1} of ${status.maxAttempts}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-sm font-black text-ink">{status.progressPercent}%</span>
          {failed && status.attemptCount < status.maxAttempts && (
            <button
              type="button"
              disabled={retrying}
              onClick={retry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Retrying…" : "Resume"}
            </button>
          )}
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
          return (
            <div key={step.stepNumber} className={`rounded-xl border px-3 py-2 bg-white/80 ${stepFailed ? "border-red-300" : running ? "border-brand" : review ? "border-amber-300" : done ? "border-emerald-300" : "border-border"}`}>
              <div className="flex items-center gap-1.5">
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" /> : done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : review ? <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> : stepFailed ? <AlertCircle className="w-3.5 h-3.5 text-red-600" /> : <Clock3 className="w-3.5 h-3.5 text-ink-muted" />}
                <span className="text-[10px] font-mono font-bold text-ink-muted">STEP {step.stepNumber}</span>
              </div>
              <p className="text-[11px] font-bold text-ink leading-tight mt-1.5">{step.agentName.replace(" Agent", "")}</p>
              <p className={`text-[9px] font-mono font-bold mt-1 ${review ? "text-amber-700" : stepFailed ? "text-red-700" : done ? "text-emerald-700" : running ? "text-brand" : "text-ink-muted"}`}>
                {step.status.replace("_", " ")}
              </p>
            </div>
          );
        })}
      </div>
      {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
    </section>
  );
}
