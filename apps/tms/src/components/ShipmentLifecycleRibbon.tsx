"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  Truck,
  Anchor,
  Plane,
  FileCheck,
  Check,
  ShieldAlert,
  CreditCard,
  Layers,
  Calendar,
  User as UserIcon,
  FileText,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";

function formatStageDateTime(val?: string | Date | null): string | null {
  if (!val) return null;
  const d = new Date(val);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type LifecycleStageState = "COMPLETE" | "ACTIVE" | "UPCOMING" | "BLOCKED";

export type MovementDetail = {
  movementId: string;
  mode: string;
  status: string;
};

export type LifecycleStage = {
  index: number;
  label: string;
  state: LifecycleStageState;
  detail: string | null;
  movements?: MovementDetail[];
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
  actorName?: string | null;
  actorRole?: string | null;
  referenceNumber?: string | null;
  durationText?: string | null;
};

export type ShipmentLifecycleStatus = {
  currentStageIndex: number; // 0-8
  stages: LifecycleStage[];
};

export function ShipmentLifecycleRibbon({
  status,
  shipmentId,
  carrierInvoiceId,
  onStageSelect,
}: {
  status?: ShipmentLifecycleStatus | null;
  shipmentId?: string;
  carrierInvoiceId?: string;
  onStageSelect?: (stageIndex: number) => void;
}) {
  const router = useRouter();
  const [settling, setSettling] = useState(false);
  const [settleMsg, setSettleMsg] = useState<string | null>(null);

  if (!status || !status.stages || status.stages.length === 0) {
    return null;
  }

  const currentStage = status.stages[status.currentStageIndex] || status.stages[0];
  const isOverallBlocked = status.stages.some((s) => s.state === "BLOCKED");

  const handleSettle = async (invId?: string) => {
    const targetId = invId || carrierInvoiceId;
    if (!targetId) return;
    try {
      setSettling(true);
      const res = await fetch(`/api/invoices/${encodeURIComponent(targetId)}/settle`, {
        method: "POST",
      });
      if (res.ok) {
        setSettleMsg("Carrier invoice marked as settled.");
        router.refresh();
      } else {
        const errData = await res.json().catch(() => ({}));
        setSettleMsg(`Settlement error: ${errData.error || "Failed to settle"}`);
      }
    } catch (e: any) {
      setSettleMsg(`Error: ${e.message}`);
    } finally {
      setSettling(false);
    }
  };

  const getModeIcon = (mode?: string) => {
    const m = (mode || "").toUpperCase();
    if (m === "OCEAN") return <Anchor className="w-3 h-3" />;
    if (m === "AIR") return <Plane className="w-3 h-3" />;
    return <Truck className="w-3 h-3" />;
  };

  return (
    <details
      className={`rounded-2xl border p-4 space-y-0 group-open:space-y-1.5 shadow-2xs transition-colors group select-none ${
        isOverallBlocked
          ? "border-red-200 bg-red-50/70 text-red-950"
          : currentStage.state === "COMPLETE"
          ? "border-emerald-200 bg-emerald-50/60 text-emerald-950"
          : "border-blue-200 bg-blue-50/60 text-blue-950"
      }`}
    >
      {/* Top Banner Row as Summary */}
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border shrink-0 ${
            isOverallBlocked
              ? "bg-red-100 border-red-300 text-red-700"
              : currentStage.state === "COMPLETE"
              ? "bg-emerald-100 border-emerald-300 text-emerald-700"
              : "bg-blue-100 border-blue-300 text-blue-700"
          }`}>
            {isOverallBlocked ? (
              <AlertCircle className="w-5 h-5" />
            ) : currentStage.state === "COMPLETE" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Clock className="w-5 h-5 animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-extrabold tracking-tight">
                Shipment Lifecycle Status: Step {status.currentStageIndex + 1}/9 — {currentStage.label}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase border ${
                isOverallBlocked
                  ? "bg-red-200 text-red-900 border-red-300"
                  : currentStage.state === "COMPLETE"
                  ? "bg-emerald-200 text-emerald-900 border-emerald-300"
                  : "bg-blue-200 text-blue-900 border-blue-300"
              }`}>
                {currentStage.state}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5 font-medium mb-0 p-0">
              {currentStage.detail || "Tracking physical and commercial milestone progression."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {settleMsg && (
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-300">
              {settleMsg}
            </span>
          )}
          <div className="p-1.5 rounded-xl bg-black/5 hover:bg-black/10 transition-colors text-ink-muted flex items-center justify-center shrink-0">
            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
          </div>
        </div>
      </summary>

      {/* 9-Stage Linear Progress Track */}
      <div className="pt-0 group-open:pt-1.5 pb-0 select-text">
        <div className="grid grid-cols-9 gap-1.5 items-center relative">
          {status.stages.map((stage, idx) => {
            const isCompleted = stage.state === "COMPLETE";
            const isActive = stage.state === "ACTIVE";
            const isBlocked = stage.state === "BLOCKED";

            let pillStyle = "bg-gray-100 text-gray-400 border-gray-200";
            let dotStyle = "bg-gray-300 text-gray-600";

            if (isCompleted) {
              pillStyle = "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs";
              dotStyle = "bg-emerald-600 text-white";
            } else if (isActive) {
              pillStyle = "bg-white text-blue-900 border-blue-400 shadow-xs ring-2 ring-blue-400/20 font-bold";
              dotStyle = "bg-blue-600 text-white animate-pulse";
            } else if (isBlocked) {
              pillStyle = "bg-red-100 text-red-900 border-red-400 shadow-xs ring-2 ring-red-400/20 font-bold";
              dotStyle = "bg-red-600 text-white";
            }

            return (
              <div key={stage.index} className="flex flex-col items-center group relative text-center min-w-0">
                {/* Step Box Header */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onStageSelect?.(stage.index);
                  }}
                  className={`w-full py-1.5 px-1 rounded-xl border text-[11px] font-semibold transition-all flex flex-col items-center gap-0.5 ${pillStyle} ${onStageSelect ? "cursor-pointer hover:opacity-90 hover:scale-[1.02]" : ""}`}
                  title={`Step ${idx + 1}/9 — ${stage.label}: ${stage.detail || stage.state}`}
                >
                  <span className="text-[9px] font-mono font-bold opacity-75 leading-none">
                    Step {idx + 1}/9
                  </span>
                  <div className={`w-4.5 h-4.5 rounded-full text-[9px] font-bold flex items-center justify-center ${dotStyle}`}>
                    {isCompleted ? (
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    ) : isBlocked ? (
                      "!"
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span className="truncate w-full block text-[10px] leading-tight font-bold">
                    {stage.label.split("/")[0].trim()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expandable Details Section */}
      <div className="mt-0 group-open:mt-1.5 space-y-2 border-t border-black/5 pt-0 group-open:pt-1.5 select-text">
          {status.stages.map((stage) => {
            const isCompleted = stage.state === "COMPLETE";
            const isActive = stage.state === "ACTIVE";
            const isBlocked = stage.state === "BLOCKED";

            return (
              <div
                key={stage.index}
                onClick={() => onStageSelect?.(stage.index)}
                className={`p-3 rounded-xl border text-xs flex flex-col gap-2 ${onStageSelect ? "cursor-pointer hover:border-brand/60" : ""} ${
                  isActive
                    ? "bg-blue-50/80 border-blue-300 text-blue-950"
                    : isBlocked
                    ? "bg-red-50/80 border-red-300 text-red-950"
                    : isCompleted
                    ? "bg-white/80 border-emerald-200 text-slate-800"
                    : "bg-white/40 border-gray-200 text-gray-500"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? "bg-emerald-600 text-white"
                          : isBlocked
                          ? "bg-red-600 text-white"
                          : isActive
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {stage.index + 1}
                    </span>
                    <span className="font-extrabold text-ink">{stage.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase border ${
                        isCompleted
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : isBlocked
                          ? "bg-red-100 text-red-800 border-red-300"
                          : isActive
                          ? "bg-blue-100 text-blue-800 border-blue-300"
                          : "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      {stage.state}
                    </span>

                    {/* Quick Settlement Action in Stage 8 if matched but pending settlement */}
                    {stage.index === 8 && (isActive || isCompleted) && stage.state !== "COMPLETE" && carrierInvoiceId && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={settling}
                        onClick={() => void handleSettle()}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1 px-2 cursor-pointer"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>{settling ? "Settling…" : "Mark Settled"}</span>
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-xs font-medium text-ink-muted pl-7">
                  {stage.detail || "No details reported for this stage."}
                </p>

                {/* Broker Audit & Timestamp Details */}
                {(stage.startedAt || stage.completedAt || stage.actorName || stage.referenceNumber || stage.durationText) && (
                  <div className="ml-7 mt-1.5 p-2.5 rounded-lg bg-surface-muted/70 border border-border/80 text-[11px] space-y-1.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-ink">
                      {stage.startedAt && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                          <div>
                            <span className="text-[9px] uppercase font-black text-ink-muted block tracking-wider">Started / Initiated</span>
                            <span className="font-mono font-bold text-ink">{formatStageDateTime(stage.startedAt)}</span>
                          </div>
                        </div>
                      )}

                      {stage.completedAt && (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <div>
                            <span className="text-[9px] uppercase font-black text-ink-muted block tracking-wider">Completed / Cleared</span>
                            <span className="font-mono font-bold text-emerald-950">{formatStageDateTime(stage.completedAt)}</span>
                          </div>
                        </div>
                      )}

                      {stage.actorName && (
                        <div className="flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-brand shrink-0" />
                          <div>
                            <span className="text-[9px] uppercase font-black text-ink-muted block tracking-wider">Handled By</span>
                            <span className="font-bold text-ink">{stage.actorName} {stage.actorRole ? `(${stage.actorRole})` : ""}</span>
                          </div>
                        </div>
                      )}

                      {stage.referenceNumber && (
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <div>
                            <span className="text-[9px] uppercase font-black text-ink-muted block tracking-wider">Ref / Doc ID</span>
                            <span className="font-mono font-bold text-ink">{stage.referenceNumber}</span>
                          </div>
                        </div>
                      )}

                      {stage.durationText && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <div>
                            <span className="text-[9px] uppercase font-black text-ink-muted block tracking-wider">Phase SLA Duration</span>
                            <span className="font-mono font-bold text-blue-900">{stage.durationText}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Per-Movement Breakdown for Multi-leg shipments */}
                {stage.movements && stage.movements.length > 1 && (
                  <div className="ml-7 mt-1 p-2 rounded-lg bg-surface-muted/60 border border-border/80 space-y-1">
                    <p className="text-[10px] font-bold text-ink-muted flex items-center gap-1">
                      <Layers className="w-3 h-3 text-brand" />
                      <span>Multi-Leg Movement Breakdown ({stage.movements.length} Legs):</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {stage.movements.map((leg, lIdx) => (
                        <div
                          key={leg.movementId || lIdx}
                          className="flex items-center justify-between p-1.5 rounded-md bg-white border border-border text-[11px]"
                        >
                          <span className="flex items-center gap-1 font-mono font-bold text-ink">
                            {getModeIcon(leg.mode)}
                            <span>Leg {lIdx + 1} ({leg.mode})</span>
                          </span>
                          <span className="px-1.5 py-0.5 rounded font-mono text-[9px] font-black bg-gray-100 text-gray-700 border border-gray-200 uppercase">
                            {leg.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
    </details>
  );
}
