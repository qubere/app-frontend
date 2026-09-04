"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bot, UserCheck, CheckCircle2, TrendingDown,
  Sparkles, Layers,
} from "lucide-react";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { Card, Button } from "@/components/ui";
import { AgenticDecisionCard } from "@/components/AgenticDecisionCard";
import { ModifyDecisionModal } from "@/components/ModifyDecisionModal";
import type { OperationsSummary, WorkQueueItem } from "@/modules/operations/services/operationsSummaryService";

export function OperationsDashboardClient({ summary }: { summary: OperationsSummary }) {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("all");
  const [activeTaskFilter, setActiveTaskFilter] = useState<"all" | "mine" | "ai_waiting">("all");
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [_actionFeedbackMap, setActionFeedbackMap] = useState<Record<string, string>>({});
  const [modifyingItem, setModifyingItem] = useState<WorkQueueItem | null>(null);
  const [isModifyOpen, setIsModifyOpen] = useState(false);

  const filteredQueue = summary.workQueue.filter((item) => {
    if (resolvedIds.includes(item.id)) return false;

    if (activeCategoryFilter === "critical" && item.severity !== "CRITICAL") return false;
    if (activeCategoryFilter === "customs" && item.domain !== "CUSTOMS") return false;
    if (activeCategoryFilter === "schedule" && item.domain !== "TRANSPORTATION") return false;
    if (activeCategoryFilter === "cost" && item.domain !== "FINANCIAL") return false;
    if (activeCategoryFilter === "documents" && item.domain !== "DOCUMENT") return false;

    return true;
  });

  const handleExecuteAction = async (
    itemId: string,
    action: "approve" | "reject" | "resolve",
    itemType: "EXCEPTION" | "DECISION" | "APPROVAL",
    actionText: string
  ) => {
    setExecutingId(itemId);

    try {
      const res = await fetch(`/api/work-items/${itemId}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: actionText, itemType }),
      });

      if (res.ok) {
        setResolvedIds((prev) => [...prev, itemId]);
        setActionFeedbackMap((prev) => ({
          ...prev,
          [itemId]: actionText,
        }));
      }
    } catch (err) {
      console.error("Failed to resolve work item:", err);
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex w-full">
      <TmsSidebar accountName="Enterprise Freight" />

      <div className="flex-1 flex flex-col min-w-0">
        <TmsHeader tenantName="Enterprise Freight" userName="Operations Lead" />

        <main className="flex-1 p-8 overflow-y-auto space-y-8 max-w-[1600px] mx-auto w-full">
          {/* Header & Operating Model Subtitle */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-brand" />
                </div>
                <h1 className="text-2xl font-extrabold text-ink tracking-tight">Operations Inbox</h1>
              </div>
              <p className="text-xs text-ink-muted mt-1 font-medium max-w-2xl">
                Qubere continuously monitors every shipment and surfaces only decisions or exceptions requiring human intervention.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <Link href="/shipments">
                <Button variant="secondary" size="sm" className="cursor-pointer">
                  <Layers className="w-3.5 h-3.5 text-brand" />
                  <span>View All Shipments</span>
                </Button>
              </Link>
              <Link href="/orders">
                <Button variant="primary" size="sm" className="cursor-pointer shadow-xs">
                  <span>+ Intake Order</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Section 1 & 2: Top-Level Metrics (Separating Shipment Health & Autonomy) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Shipment Health Cards */}
            <Card className="p-4 bg-white border border-border space-y-2 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted block">SHIPMENT HEALTH</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-ink font-mono">{summary.shipmentHealth.totalActive}</span>
                <span className="text-[11px] font-bold text-ink-muted">Active Shipments</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-1 text-center font-mono">
                <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-xs font-black text-emerald-800">{summary.shipmentHealth.onTrack}</span>
                  <span className="text-[9px] font-bold text-emerald-700 block">ON TRACK</span>
                </div>
                <div className="p-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-xs font-black text-amber-900">{summary.shipmentHealth.atRisk}</span>
                  <span className="text-[9px] font-bold text-amber-800 block">AT RISK</span>
                </div>
                <div className="p-1.5 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-xs font-black text-red-900">{summary.shipmentHealth.critical}</span>
                  <span className="text-[9px] font-bold text-red-800 block">CRITICAL</span>
                </div>
              </div>
            </Card>

            {/* Operational Management / Autonomy */}
            <Card className="p-4 bg-white border border-border space-y-2 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted block">OPERATIONAL MANAGEMENT</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-brand font-mono">{summary.autonomy.aiManaging}</span>
                <span className="text-[11px] font-bold text-brand">AI Managing (100% Auto)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-center font-mono">
                <div className="p-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-xs font-black text-amber-900">{summary.autonomy.humanIntervention}</span>
                  <span className="text-[9px] font-bold text-amber-800 block">WAITING HUMAN</span>
                </div>
                <div className="p-1.5 bg-surface-muted border border-border rounded-lg">
                  <span className="text-xs font-black text-ink">{summary.autonomy.deliveredToday}</span>
                  <span className="text-[9px] font-bold text-ink-muted block">DELIVERED TODAY</span>
                </div>
              </div>
            </Card>

            {/* Customer Promise Risk */}
            <Card className="p-4 bg-white border border-border space-y-2 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted block">CUSTOMER PROMISE</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-800 font-mono">{summary.customerPromise.onPromise}</span>
                <span className="text-[11px] font-bold text-emerald-700">On Promise</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-center font-mono">
                <div className="p-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-xs font-black text-amber-900">{summary.customerPromise.atRisk}</span>
                  <span className="text-[9px] font-bold text-amber-800 block">AT RISK</span>
                </div>
                <div className="p-1.5 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-xs font-black text-red-900">{summary.customerPromise.missed}</span>
                  <span className="text-[9px] font-bold text-red-800 block">MISSED</span>
                </div>
              </div>
            </Card>

            {/* At-Risk Financial Exposure */}
            <Card className="p-4 bg-gradient-to-r from-red-50 to-white border border-red-200 space-y-2 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-800 block">AT-RISK EXPOSURE</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-red-900 font-mono">${summary.atRiskFinancialExposure.totalExposureUsd.toLocaleString()}</span>
                <span className="text-[11px] font-bold text-red-700">Financial Risk</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] font-semibold text-ink-muted pt-1">
                <span>Demurrage: <strong className="text-red-700">${summary.atRiskFinancialExposure.demurrageUsd}</strong></span>
                <span>Rate Var: <strong className="text-amber-800">${summary.atRiskFinancialExposure.rateVarianceUsd}</strong></span>
              </div>
            </Card>
          </div>

          {/* Section 3, 4, 5, 6, 7 & 16: Dominant "NEEDS YOU" Action Queue */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-3 gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-black text-ink tracking-tight">NEEDS YOU</h2>
                    <span className="px-3 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                      {summary.workQueueHeader.shipmentsNeedingActionCount} shipments • {filteredQueue.length} work items
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted font-medium">
                    Deterministically prioritized by business impact, Customs deadlines, and financial exposure.
                  </p>
                </div>
              </div>

              {/* Lightweight Operational Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-white p-1 rounded-xl border border-border text-xs shadow-2xs">
                  {[
                    { id: "all", label: "All Items" },
                    { id: "critical", label: "Critical" },
                    { id: "customs", label: "Customs" },
                    { id: "schedule", label: "Schedule" },
                    { id: "cost", label: "Cost & Rates" },
                    { id: "documents", label: "Documents" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setActiveCategoryFilter(f.id)}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        activeCategoryFilter === f.id ? "bg-brand text-white shadow-2xs" : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="flex bg-white p-1 rounded-xl border border-border text-xs shadow-2xs">
                  <button
                    onClick={() => setActiveTaskFilter("all")}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      activeTaskFilter === "all" ? "bg-surface-muted text-ink shadow-2xs" : "text-ink-muted"
                    }`}
                  >
                    All Team
                  </button>
                  <button
                    onClick={() => setActiveTaskFilter("mine")}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      activeTaskFilter === "mine" ? "bg-brand text-white shadow-2xs" : "text-ink-muted"
                    }`}
                  >
                    Assigned to Me
                  </button>
                </div>
              </div>
            </div>

            {/* Action Cards Queue */}
            <div className="space-y-4">
              {filteredQueue.length === 0 ? (
                <Card className="p-12 text-center text-xs text-ink-muted font-medium bg-white border border-border space-y-2 shadow-2xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="font-bold text-ink text-sm">All Action Items Resolved!</p>
                  <p>No operational exceptions or AI policy decisions requiring human intervention.</p>
                </Card>
              ) : (
                filteredQueue.map((item) => (
                  <AgenticDecisionCard
                    key={item.id}
                    item={item}
                    onExecuteAction={(itemId, action, itemType, note) =>
                      handleExecuteAction(
                        itemId,
                        action,
                        itemType,
                        note || `Executed ${action} for ${item.shipmentNumber}`
                      )
                    }
                    onOpenModify={(itm) => {
                      setModifyingItem(itm);
                      setIsModifyOpen(true);
                    }}
                    executingId={executingId}
                  />
                ))
              )}
            </div>
          </div>

          {/* Section 10 & 11: QUBERE HANDLED TODAY & HUMAN TOUCH RATE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Qubere Handled Today */}
            <Card className="p-6 bg-white border border-border space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-brand" />
                  <h3 className="font-extrabold text-base text-ink">QUBERE HANDLED TODAY</h3>
                </div>
                <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                  {summary.qubereHandledToday.automationRatePct}% Automated
                </span>
              </div>

              <p className="text-xs text-ink-muted font-medium">
                <strong className="text-ink font-bold">{summary.qubereHandledToday.totalAutomatedActions} routine operational actions</strong> completed today without human intervention.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-semibold">
                <div className="p-3 bg-surface-muted rounded-xl border border-border">
                  <span className="text-lg font-black text-brand font-mono block">{summary.qubereHandledToday.bookingsTenders}</span>
                  <span className="text-[11px] text-ink-muted">Bookings / Tenders</span>
                </div>
                <div className="p-3 bg-surface-muted rounded-xl border border-border">
                  <span className="text-lg font-black text-brand font-mono block">{summary.qubereHandledToday.customerUpdates}</span>
                  <span className="text-[11px] text-ink-muted">Customer Updates</span>
                </div>
                <div className="p-3 bg-surface-muted rounded-xl border border-border">
                  <span className="text-lg font-black text-brand font-mono block">{summary.qubereHandledToday.appointments}</span>
                  <span className="text-[11px] text-ink-muted">Appointments</span>
                </div>
                <div className="p-3 bg-surface-muted rounded-xl border border-border">
                  <span className="text-lg font-black text-brand font-mono block">{summary.qubereHandledToday.podMatches}</span>
                  <span className="text-[11px] text-ink-muted">POD Matches</span>
                </div>
                <div className="p-3 bg-surface-muted rounded-xl border border-border">
                  <span className="text-lg font-black text-brand font-mono block">{summary.qubereHandledToday.invoiceMatches}</span>
                  <span className="text-[11px] text-ink-muted">Invoice Matches</span>
                </div>
              </div>
            </Card>

            {/* Operating Performance & Human Touch Rate */}
            <Card className="p-6 bg-white border border-border space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center space-x-2">
                  <TrendingDown className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-base text-ink">HUMAN TOUCH RATE & PERFORMANCE</h3>
                </div>
                <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  ↓ {summary.humanTouchRate.improvementPts} pts over 30 days
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-surface-muted rounded-xl border border-border">
                  <span className="text-[10px] text-ink-muted font-bold block uppercase">TODAY</span>
                  <span className="text-xl font-black text-brand font-mono">{summary.humanTouchRate.todayPct}%</span>
                </div>
                <div className="p-3 bg-surface-muted rounded-xl border border-border">
                  <span className="text-[10px] text-ink-muted font-bold block uppercase">7 DAYS</span>
                  <span className="text-xl font-black text-ink font-mono">{summary.humanTouchRate.sevenDaysPct}%</span>
                </div>
                <div className="p-3 bg-surface-muted rounded-xl border border-border">
                  <span className="text-[10px] text-ink-muted font-bold block uppercase">30 DAYS</span>
                  <span className="text-xl font-black text-ink font-mono">{summary.humanTouchRate.thirtyDaysPct}%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-border font-semibold">
                <div className="flex justify-between">
                  <span className="text-ink-muted">On-Time Delivery:</span>
                  <span className="text-emerald-700 font-bold">{summary.operatingPerformance.onTimeDeliveryPct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Customer On Promise:</span>
                  <span className="text-emerald-700 font-bold">{summary.operatingPerformance.customerOnPromisePct}%</span>
                </div>
              </div>
            </Card>
          </div>

          <ModifyDecisionModal
            item={modifyingItem}
            isOpen={isModifyOpen}
            onClose={() => {
              setIsModifyOpen(false);
              setModifyingItem(null);
            }}
            onApproveModified={async (itemId, note) => {
              if (modifyingItem) {
                await handleExecuteAction(itemId, "approve", modifyingItem.itemType, note);
              }
            }}
          />
        </main>
      </div>
    </div>
  );
}
