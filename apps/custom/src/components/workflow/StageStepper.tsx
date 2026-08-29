"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  Info,
  UserCheck,
  AlertCircle,
} from "lucide-react";

interface StageStep {
  stage: string;
  label: string;
  status: "complete" | "active" | "pending" | "gate_pending" | "blocked";
}

interface StageHistoryEntry {
  id: string;
  stage: string;
  enteredAt: string;
  exitedAt?: string | null;
  outcome?: string | null;
  advancedBy?: string | null;
  note?: string | null;
}

interface StageGateDecision {
  id: string;
  status: string;
  triageState?: string | null;
  decisionSummary: string;
  assignedToUser?: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
}

interface StageInfoResponse {
  shipmentId: string;
  currentStage: string;
  stageStatus: string;
  autoAdvance: boolean;
  stepper: StageStep[];
  history: StageHistoryEntry[];
  gateDecision?: StageGateDecision | null;
  openExceptions: Array<{ id: string; category: string; description: string; severity: string }>;
  pendingDecisions: Array<{ id: string; agentName: string; status: string; decisionSummary: string }>;
}

export function StageStepper({ shipmentId }: { shipmentId: string }) {
  const router = useRouter();
  const [data, setData] = useState<StageInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStageData = async () => {
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/stage`);
      if (res.ok) {
        const result: StageInfoResponse = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error("Failed to fetch stage info", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStageData();
    const interval = setInterval(fetchStageData, 10000);
    return () => clearInterval(interval);
  }, [shipmentId]);

  const handleToggleAutoAdvance = async () => {
    if (!data) return;
    setTogglingAuto(true);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoAdvance: !data.autoAdvance }),
      });
      if (res.ok) {
        await fetchStageData();
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to toggle autoAdvance", err);
    } finally {
      setTogglingAuto(false);
    }
  };

  const handleResetBreaker = async () => {
    if (!data) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/stage/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStage: data.currentStage,
          resetBreaker: true,
          reason: "Manual reset & retry from Stage Stepper",
        }),
      });
      if (res.ok) {
        await fetchStageData();
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to reset breaker", err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 animate-pulse flex items-center justify-between">
        <div className="h-4 bg-slate-200 rounded w-1/4"></div>
        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (!data) return null;

  const activeStep = data.stepper.find((s) => s.stage === data.currentStage);

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 mb-6">
      {/* Header bar: Title, AutoAdvance toggle & Status summary */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg font-semibold text-xs flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Autonomous Orchestration</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Lifecycle Stage: {activeStep?.label || data.currentStage}</span>
              {data.stageStatus === "GATE_PENDING" && (
                <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Gate Pending
                </span>
              )}
              {data.stageStatus === "BLOCKED" && (
                <span className="text-[10px] bg-red-100 text-red-800 border border-red-300 font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Breaker Tripped (Blocked)
                </span>
              )}
              {data.stageStatus === "COMPLETE" && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Workflow Complete
                </span>
              )}
            </h3>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {data.stageStatus === "BLOCKED" && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleResetBreaker}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? "animate-spin" : ""}`} />
              <span>Reset & Retry Stage</span>
            </button>
          )}

          <button
            type="button"
            disabled={togglingAuto}
            onClick={handleToggleAutoAdvance}
            className={`px-3 py-1 text-xs font-semibold rounded-lg border flex items-center space-x-1.5 transition-colors cursor-pointer ${
              data.autoAdvance
                ? "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
            }`}
            title={data.autoAdvance ? "Pause autonomous stage advancement" : "Resume autonomous stage advancement"}
          >
            {data.autoAdvance ? (
              <>
                <PauseCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Pause Auto-advance</span>
              </>
            ) : (
              <>
                <PlayCircle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>Resume Auto-advance</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stepper horizontal bar */}
      <div className="grid grid-cols-7 gap-2">
        {data.stepper.map((step, idx) => {
          const isSelected = selectedStage === step.stage;
          let icon = <Clock className="w-3.5 h-3.5 text-slate-400" />;
          let bgClass = "bg-slate-50 border-slate-200 text-slate-500";
          let barClass = "bg-slate-200";

          if (step.status === "complete") {
            icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
            bgClass = "bg-emerald-50 border-emerald-200 text-emerald-800";
            barClass = "bg-emerald-500";
          } else if (step.status === "active") {
            icon = <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />;
            bgClass = "bg-indigo-50 border-indigo-300 text-indigo-900 font-bold ring-2 ring-indigo-400/30";
            barClass = "bg-indigo-600";
          } else if (step.status === "gate_pending") {
            icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
            bgClass = "bg-amber-50 border-amber-300 text-amber-900 font-bold ring-2 ring-amber-400/30";
            barClass = "bg-amber-500";
          } else if (step.status === "blocked") {
            icon = <XCircle className="w-3.5 h-3.5 text-red-600" />;
            bgClass = "bg-red-50 border-red-300 text-red-900 font-bold ring-2 ring-red-400/30";
            barClass = "bg-red-500";
          }

          return (
            <div
              key={step.stage}
              onClick={() => setSelectedStage(isSelected ? null : step.stage)}
              className={`p-2 rounded-lg border text-xs cursor-pointer transition-all ${bgClass} ${
                isSelected ? "ring-2 ring-offset-1 ring-slate-400" : "hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono opacity-70">0{idx + 1}</span>
                {icon}
              </div>
              <p className="font-semibold truncate text-[11px]" title={step.label}>
                {step.label}
              </p>
              <div className={`h-1 w-full rounded-full mt-1.5 ${barClass}`} />
            </div>
          );
        })}
      </div>

      {/* Gate Pending Banner */}
      {data.stageStatus === "GATE_PENDING" && data.gateDecision && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <UserCheck className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-900">
                Human Stage Gate Approval Required
              </p>
              <p className="text-xs text-amber-800">{data.gateDecision.decisionSummary}</p>
              {data.gateDecision.assignedToUser && (
                <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                  Assigned to: {data.gateDecision.assignedToUser.firstName} {data.gateDecision.assignedToUser.lastName} ({data.gateDecision.assignedToUser.email})
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/app/actions?scope=mine")}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          >
            <span>Review Gate in Queue</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected Stage Detail Drawer */}
      {selectedStage && (
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
          <div className="flex items-center justify-between font-bold text-slate-800 pb-2 border-b border-slate-200">
            <span>Stage Detail: {data.stepper.find((s) => s.stage === selectedStage)?.label}</span>
            <button
              onClick={() => setSelectedStage(null)}
              className="text-slate-400 hover:text-slate-600 text-xs font-medium cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold text-slate-700 mb-1">Stage Transitions History:</p>
              {data.history.filter((h) => h.stage === selectedStage).length === 0 ? (
                <p className="text-slate-400 italic">No historical transitions recorded yet.</p>
              ) : (
                <ul className="space-y-1 text-[11px] text-slate-600">
                  {data.history
                    .filter((h) => h.stage === selectedStage)
                    .map((h) => (
                      <li key={h.id} className="flex justify-between bg-white p-1.5 rounded border border-slate-200">
                        <span>{new Date(h.enteredAt).toLocaleString()}</span>
                        <span className="font-semibold text-indigo-700">{h.outcome || "IN_PROGRESS"}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-700 mb-1">Open Stage Exceptions:</p>
              {data.openExceptions.length === 0 ? (
                <p className="text-emerald-600 font-medium">No open blocking exceptions.</p>
              ) : (
                <ul className="space-y-1 text-[11px]">
                  {data.openExceptions.map((ex) => (
                    <li key={ex.id} className="bg-red-50 text-red-800 p-1.5 rounded border border-red-200 flex justify-between">
                      <span>[{ex.category}] {ex.description}</span>
                      <span className="font-bold">{ex.severity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
