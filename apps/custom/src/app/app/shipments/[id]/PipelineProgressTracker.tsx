"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronRight, Layers, RefreshCw, XCircle } from "lucide-react";

interface StepExecution {
  stepNumber: number;
  agentName: string;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
}

interface PipelineStatus {
  jobId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  currentStep: number;
  totalSteps: number;
  stalled?: boolean;
  errorMessage?: string;
  stepExecutions?: StepExecution[];
}

export function PipelineProgressTracker({ shipmentId }: { shipmentId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [hasRefreshed, setHasRefreshed] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/shipments/${shipmentId}/pipeline-status`);
        if (isCancelled) return;
        if (!res.ok) return;

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

        if (data.status === "FAILED") return;

        if (data.status === "PENDING" || data.status === "PROCESSING") {
          timer = setTimeout(checkStatus, 3000);
        }
      } catch (err) {
        console.error("Error checking pipeline status", err);
      }
    };

    checkStatus();

    const handleUploadEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ shipmentId?: string }>;
      if (!customEvent.detail?.shipmentId || customEvent.detail.shipmentId === shipmentId) {
        setHasRefreshed(false);
        if (timer) clearTimeout(timer);
        void checkStatus();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkStatus();
      }
    };

    window.addEventListener("qubere:document-uploaded", handleUploadEvent);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("qubere:document-uploaded", handleUploadEvent);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [shipmentId, hasRefreshed, router]);

  const [retrying, setRetrying] = useState(false);

  const handleRetry = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRetrying(true);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/pipeline-retry`, { method: "POST" });
      if (res.ok) {
        setStatus((prev) => (prev ? { ...prev, status: "PROCESSING" } : null));
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to retry pipeline", err);
    } finally {
      setRetrying(false);
    }
  };

  const handleWaterfallClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;

    window.dispatchEvent(
      new CustomEvent("qubere:switch-tab", {
        detail: { tab: "audit", scrollId: "waterfall-view" },
      })
    );

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "audit");
      url.hash = "waterfall-view";
      window.history.replaceState(null, "", url);
    } catch {
      // Ignore if URL update fails
    }

    const el = document.getElementById("waterfall-view");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (!status || status.status === "COMPLETED") return null;

  if (status.status === "FAILED") {
    return (
      <div
        onClick={handleWaterfallClick}
        title="Click to view pipeline execution waterfall"
        className="bg-red-50 hover:bg-red-100/60 border border-red-200 rounded-2xl p-4 flex items-center justify-between mb-6 cursor-pointer transition-colors"
      >
        <div className="flex items-center space-x-3 text-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <h4 className="text-sm font-bold">Processing Exception</h4>
            <p className="text-xs opacity-80">{status.errorMessage || "An error occurred during AI processing."}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            disabled={retrying}
            onClick={handleRetry}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
            <span>{retrying ? "Retrying..." : "Retry Pipeline"}</span>
          </button>
          <div className="hidden sm:flex items-center space-x-1 text-xs font-semibold text-red-700 hover:underline">
            <Layers className="w-3.5 h-3.5" />
            <span>Waterfall</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = Math.min(100, Math.round((status.currentStep / status.totalSteps) * 100));
  const steps = status.stepExecutions ?? [];
  const currentStepName =
    steps.find((s) => s.status === "REVIEW_REQUIRED" || (s.stepNumber === status.currentStep && s.status !== "SUCCESS"))
      ?.agentName ?? null;

  return (
    <div
      onClick={handleWaterfallClick}
      title="Click to view agent execution waterfall"
      className="bg-blue-50/90 hover:bg-blue-100/60 border border-blue-200 rounded-2xl p-4 mb-6 space-y-3 cursor-pointer transition-colors group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 text-blue-900">
          <RefreshCw className="w-5 h-5 animate-spin text-brand shrink-0" />
          <div>
            <h4 className="text-sm font-bold flex items-center gap-2">
              <span>Autonomous AI Pipeline Running</span>
              <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1 group-hover:bg-brand group-hover:text-white transition-colors">
                <Layers className="w-3 h-3" />
                View Waterfall
                <ChevronRight className="w-3 h-3" />
              </span>
            </h4>
            <p className="text-xs opacity-80">
              {status.status === "PENDING"
                ? "Waiting for available worker…"
                : currentStepName
                ? `Running: ${currentStepName}`
                : `Agent ${status.currentStep} of ${status.totalSteps}`}
              {status.stalled && " · stalled — will be reclaimed automatically"}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {status.stalled && (
            <button
              type="button"
              disabled={retrying}
              onClick={handleRetry}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
              <span>{retrying ? "Reclaiming..." : "Reclaim & Resume"}</span>
            </button>
          )}
          <span className="text-sm font-bold text-brand">{progressPercent}%</span>
        </div>
      </div>

      <div className="w-full bg-blue-200/50 rounded-full h-1.5">
        <div
          className="bg-brand h-1.5 rounded-full transition-all duration-500 ease-in-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {steps.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {steps
            .slice()
            .sort((a, b) => a.stepNumber - b.stepNumber)
            .map((step) => {
              const icon =
                step.status === "SUCCESS" ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                ) : step.status === "FAILED" ? (
                  <XCircle className="w-3 h-3 text-red-500 shrink-0" />
                ) : (
                  <RefreshCw className="w-3 h-3 animate-spin text-brand shrink-0" />
                );
              return (
                <span
                  key={step.stepNumber}
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    step.status === "SUCCESS"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : step.status === "FAILED"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-blue-100 text-blue-800 border-blue-300"
                  }`}
                >
                  {icon}
                  {step.agentName}
                </span>
              );
            })}
        </div>
      )}
    </div>
  );
}
