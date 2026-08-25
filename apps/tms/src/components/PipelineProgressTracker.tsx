"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw, Sparkles } from "lucide-react";

interface StepExecution {
  stepNumber: number;
  agentName: string;
  surface: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  summary: string;
}

interface PipelineStatus {
  shipmentId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  currentStep: number;
  totalSteps: number;
  progressPercent: number;
  activeAgent: string | null;
  errorMessage?: string;
  steps: StepExecution[];
}

export function PipelineProgressTracker({ shipmentId }: { shipmentId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/shipments/${shipmentId}/pipeline-status`);
        if (isCancelled || !res.ok) return;

        const data: PipelineStatus = await res.json();
        if (isCancelled) return;

        setStatus(data);

        if (data.status === "COMPLETED") {
          if (!hasRefreshed) {
            setHasRefreshed(true);
            router.refresh();
          }
          return;
        }

        if (data.status === "PROCESSING" || data.status === "PENDING") {
          timer = setTimeout(checkStatus, 1500);
        }
      } catch (err) {
        console.error("Error checking pipeline status:", err);
      }
    };

    checkStatus();

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [shipmentId, hasRefreshed, router]);

  const handleTriggerPipeline = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/pipeline-trigger`, { method: "POST" });
      if (res.ok) {
        setHasRefreshed(false);
        setStatus((prev) => (prev ? { ...prev, status: "PROCESSING", currentStep: 1, progressPercent: 14 } : null));
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to trigger pipeline:", err);
    } finally {
      setRetrying(false);
    }
  };

  if (!status) return null;

  if (status.status === "FAILED") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center justify-between mb-6 shadow-2xs">
        <div className="flex items-center space-x-3 text-red-900">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <h4 className="text-sm font-bold">Autonomous Agent Pipeline Exception</h4>
            <p className="text-xs opacity-90">{status.errorMessage || "An unexpected error occurred during agent execution."}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={retrying}
          onClick={handleTriggerPipeline}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
          <span>{retrying ? "Re-running..." : "Retry Agent Pipeline"}</span>
        </button>
      </div>
    );
  }

  // Active Processing Ribbon
  if (status.status === "PROCESSING" || status.status === "PENDING") {
    return (
      <div className="p-5 rounded-2xl border border-brand/30 bg-gradient-to-r from-blue-50/80 via-white to-brand/5 shadow-2xs space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center shadow-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-black text-ink">Autonomous Freight Pipeline Executing</h4>
                <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-brand text-white">
                  Step {status.currentStep} of {status.totalSteps}
                </span>
              </div>
              <p className="text-xs font-semibold text-brand mt-0.5 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-brand" />
                <span>Active Agent: {status.activeAgent || "Intake Parser"}</span>
              </p>
            </div>
          </div>

          <span className="text-sm font-mono font-black text-brand">{status.progressPercent}%</span>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full h-2 rounded-full bg-border/60 overflow-hidden">
          <div
            style={{ width: `${status.progressPercent}%` }}
            className="h-full bg-brand transition-all duration-300 rounded-full"
          />
        </div>

        {/* Step Indicator Pills */}
        <div className="flex items-center justify-between text-[10px] font-mono font-bold text-ink-muted pt-1">
          {status.steps.map((s) => (
            <div key={s.stepNumber} className="flex items-center space-x-1">
              {s.status === "COMPLETED" ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              ) : s.status === "RUNNING" ? (
                <Loader2 className="w-3 h-3 text-brand animate-spin" />
              ) : (
                <Clock className="w-3 h-3 text-ink-muted/50" />
              )}
              <span className={s.status === "COMPLETED" ? "text-emerald-700" : s.status === "RUNNING" ? "text-brand" : "opacity-60"}>
                {s.stepNumber}. {s.agentName.replace(" Agent", "")}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Completed Banner with Manual Re-Trigger Button
  return (
    <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between mb-6 shadow-2xs">
      <div className="flex items-center space-x-3 text-emerald-950">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <h4 className="text-xs font-bold">Autonomous Freight Agent Pipeline Completed</h4>
          <p className="text-[11px] text-emerald-800 font-medium">All 7 freight intake, planning, rating, and tendering agent steps verified and logged.</p>
        </div>
      </div>

      <button
        type="button"
        disabled={retrying}
        onClick={handleTriggerPipeline}
        className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${retrying ? "animate-spin" : ""}`} />
        <span>{retrying ? "Running..." : "Re-run Agent Pipeline"}</span>
      </button>
    </div>
  );
}
