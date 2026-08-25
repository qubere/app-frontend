"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bot, AlertTriangle, ArrowUpRight, CheckCircle2, Sparkles, Clock,
  ChevronDown, ChevronUp, ShieldAlert, Building2, MapPin,
  Check
} from "lucide-react";
import { Card, Button } from "@/components/ui";
import type { WorkQueueItem } from "@/modules/operations/services/operationsSummaryService";

interface AgenticDecisionCardProps {
  item: WorkQueueItem;
  onExecuteAction: (
    itemId: string,
    action: "approve" | "reject" | "resolve",
    itemType: "EXCEPTION" | "DECISION" | "APPROVAL",
    note?: string
  ) => Promise<void>;
  onOpenModify?: (item: WorkQueueItem) => void;
  executingId?: string | null;
}

export function AgenticDecisionCard({
  item,
  onExecuteAction,
  onOpenModify,
  executingId,
}: AgenticDecisionCardProps) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [resolvedState, setResolvedState] = useState<"APPROVED" | "REJECTED" | null>(null);

  const isExecuting = executingId === item.id;
  const isCritical = item.severity === "CRITICAL";
  const isNeedsInput = item.decisionState === "AI_NEEDS_INPUT";

  const handleAction = async (action: "approve" | "reject" | "resolve", note?: string) => {
    try {
      await onExecuteAction(item.id, action, item.itemType, note);
      setResolvedState(action === "reject" ? "REJECTED" : "APPROVED");
    } catch (err) {
      console.error("Failed to execute action:", err);
    }
  };

  if (resolvedState) {
    return (
      <Card className="p-6 bg-emerald-50/50 border border-emerald-200 transition-all shadow-2xs space-y-2">
        <div className="flex items-center space-x-3 text-emerald-900">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <h4 className="font-extrabold text-sm tracking-tight">
              Action Executed & Saved to Audit Log
            </h4>
            <p className="text-xs text-emerald-700 font-medium">
              Shipment <span className="font-mono font-bold">{item.shipmentNumber}</span> updated. Qubere is continuing automated execution monitoring.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={`p-6 space-y-5 transition-all shadow-2xs border bg-white ${
        isCritical
          ? "border-red-200 ring-1 ring-red-100"
          : isNeedsInput
          ? "border-amber-300 bg-amber-50/10"
          : "border-border hover:border-brand/30"
      }`}
    >
      {/* 1. SEVERITY + SPECIFIC WORK ITEM TYPE & URGENCY HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Severity Badge */}
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
              isCritical
                ? "bg-red-100 text-red-900 border-red-300"
                : "bg-amber-100 text-amber-900 border-amber-300"
            }`}
          >
            {item.severity}
          </span>

          {/* Specific Domain Work Item Type */}
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-black uppercase tracking-wide bg-surface-muted text-ink border border-border">
            {item.specificType}
          </span>

          {/* Agent Status Badge */}
          <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 text-[10px] font-bold">
            <Bot className="w-3 h-3 text-brand" />
            <span>
              {isNeedsInput
                ? "AI NEEDS INPUT"
                : item.decisionState === "AI_RESOLVED"
                ? "AI RESOLVED"
                : "AI NEEDS APPROVAL"}
            </span>
          </div>
        </div>

        {/* Prominent Urgency / Time-to-Act Block */}
        <div className="flex items-center space-x-2">
          <Clock className={`w-3.5 h-3.5 ${isCritical ? "text-red-600" : "text-amber-600"}`} />
          <span
            className={`text-xs font-mono font-black tracking-tight px-3 py-1 rounded-full border ${
              isCritical
                ? "bg-red-50 text-red-800 border-red-200"
                : "bg-amber-50 text-amber-900 border-amber-200"
            }`}
          >
            {item.timeToActFormatted || item.urgencyLabel}
          </span>
        </div>
      </div>

      {/* 2. SHIPMENT CONTEXT */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-surface-muted/50 p-3 rounded-xl border border-border/80">
        <div className="flex items-center space-x-3">
          <Link
            href={`/shipments/${item.shipmentId}`}
            className="font-mono font-black text-sm text-brand hover:underline inline-flex items-center space-x-1 cursor-pointer"
          >
            <span>{item.shipmentNumber}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
          <span className="text-ink-muted">|</span>
          <div className="flex items-center space-x-1.5 font-semibold text-ink">
            <MapPin className="w-3.5 h-3.5 text-ink-muted shrink-0" />
            <span>{item.routeText}</span>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 font-bold text-ink-muted">
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span>{item.customerName}</span>
        </div>
      </div>

      {/* 3. OPERATIONAL PROBLEM TITLE & SUBTEXT */}
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-extrabold text-lg text-ink tracking-tight">
            {item.operationalTitle}
          </h3>
          {item.legalBasis && (
            <span className="px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-200 text-[10px] font-mono font-bold shrink-0">
              Legal basis: {item.legalBasis}
            </span>
          )}
        </div>
        <p className="text-xs text-ink-muted font-medium leading-relaxed">
          {item.subtext}
        </p>
      </div>

      {/* 4. MISSING INPUT EXPLANATION (IF AI NEEDS INPUT) */}
      {isNeedsInput && item.missingInputExplanation && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1">
          <div className="flex items-center space-x-2 text-amber-900 font-extrabold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Qubere Needs Human Input to Proceed</span>
          </div>
          <p className="text-amber-800 font-medium leading-relaxed pl-6">
            {item.missingInputExplanation}
          </p>
        </div>
      )}

      {/* 5. WHAT HAPPENED & WHY IT MATTERS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-3.5 rounded-xl bg-surface-muted/40 border border-border space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted block">
            WHAT HAPPENED
          </span>
          <p className="font-medium text-ink leading-relaxed">{item.whatHappened}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-muted/40 border border-border space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted block">
            WHY IT MATTERS
          </span>
          <p className="font-medium text-ink leading-relaxed">{item.whyItMatters}</p>
        </div>
      </div>

      {/* 6. QUBERE RECOMMENDATION & BUSINESS RATIONALE (HERO BOX) */}
      <div className="p-4 rounded-xl bg-blue-50/60 border border-brand/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded-md bg-brand text-white flex items-center justify-center">
              <Sparkles className="w-3 h-3" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider text-brand">
              QUBERE RECOMMENDS
            </span>
          </div>
        </div>

        <p className="font-bold text-sm text-ink leading-snug">
          {item.qubereRecommends}
        </p>

        {item.whyRecommends && (
          <div className="pt-2 border-t border-brand/10 space-y-0.5 text-xs">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted block">
              WHY QUBERE RECOMMENDS IT
            </span>
            <p className="text-ink-muted font-medium leading-relaxed">
              {item.whyRecommends}
            </p>
          </div>
        )}
      </div>

      {/* 7. COMPACT IMPACT SUMMARY ROW */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted block">
          OPERATIONAL IMPACT SUMMARY
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 text-xs">
          <div className="p-2 bg-white rounded-lg border border-border text-center space-y-0.5 shadow-2xs">
            <span className="text-[9px] font-bold text-ink-muted block uppercase">SCHEDULE</span>
            <span className="font-extrabold text-ink block">{item.impact.schedule || "None"}</span>
          </div>

          <div className="p-2 bg-white rounded-lg border border-border text-center space-y-0.5 shadow-2xs">
            <span className="text-[9px] font-bold text-ink-muted block uppercase">COST IMPACT</span>
            <span className={`font-extrabold font-mono block ${item.impact.costUsd || item.impact.exposureUsd ? "text-red-700" : "text-emerald-700"}`}>
              {item.impact.costUsd !== undefined
                ? `$${item.impact.costUsd}`
                : item.impact.exposureUsd !== undefined
                ? `$${item.impact.exposureUsd}/day`
                : "$0"}
            </span>
          </div>

          {item.impact.marginShift && (
            <div className="p-2 bg-white rounded-lg border border-border text-center space-y-0.5 shadow-2xs">
              <span className="text-[9px] font-bold text-ink-muted block uppercase">MARGIN</span>
              <span className="font-extrabold text-amber-800 font-mono block">
                {item.impact.marginShift}
              </span>
            </div>
          )}

          <div className="p-2 bg-white rounded-lg border border-border text-center space-y-0.5 shadow-2xs">
            <span className="text-[9px] font-bold text-ink-muted block uppercase">CUSTOMER</span>
            <span className="font-extrabold text-ink block">
              {item.impact.customerImpact || "On track"}
            </span>
          </div>

          <div className="p-2 bg-white rounded-lg border border-border text-center space-y-0.5 shadow-2xs">
            <span className="text-[9px] font-bold text-ink-muted block uppercase">STATUS</span>
            <span className="font-extrabold text-red-700 block">
              {item.impact.customsImpact || "Blocked"}
            </span>
          </div>
        </div>
      </div>

      {/* 8. CONFIDENCE & EXPANDABLE EVIDENCE ACCORDION */}
      <div className="border border-border/80 rounded-xl bg-surface-muted/30 overflow-hidden">
        <div
          onClick={() => setShowEvidence(!showEvidence)}
          className="p-3 flex items-center justify-between text-xs font-semibold text-ink cursor-pointer hover:bg-surface-muted/60 transition-all select-none"
        >
          <div className="flex items-center space-x-3">
            <span className="text-ink-muted">Confidence:</span>
            {item.ruleConfidence !== undefined && (
              <span className="font-mono font-bold text-ink bg-white px-2 py-0.5 rounded border border-border">
                Rule: <strong className="text-emerald-700">100%</strong>
              </span>
            )}
            <span className="font-mono font-bold text-ink bg-white px-2 py-0.5 rounded border border-border">
              Recommendation: <strong className="text-brand">{item.recommendationConfidence}%</strong> • {item.confidenceLevel || "High"}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowEvidence(!showEvidence);
            }}
            className="flex items-center space-x-1 text-xs text-brand font-bold cursor-pointer hover:underline"
          >
            <span>{showEvidence ? "Hide Evidence" : "View Evidence & Sources"}</span>
            {showEvidence ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showEvidence && (
          <div className="p-3.5 border-t border-border bg-white space-y-3 text-xs animate-in fade-in duration-150">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted block">
              EVIDENCE PROVENANCE & DATA SOURCES
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {item.evidence && item.evidence.length > 0 ? (
                item.evidence.map((ev, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-surface-muted/50 border border-border/60 space-y-0.5">
                    <span className="text-[10px] font-bold text-ink-muted block">{ev.label}</span>
                    <span className="font-bold text-ink block font-mono">{ev.value}</span>
                    {ev.source && (
                      <span className="text-[9px] text-ink-muted block">Src: {ev.source}</span>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-full text-ink-muted">No additional evidence items recorded.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 9. AFTER APPROVAL SYSTEM STEPS */}
      <div className="p-3.5 bg-surface-muted/50 border border-border/80 rounded-xl space-y-2 text-xs">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand block">
          AFTER APPROVAL, QUBERE WILL
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-semibold text-ink">
          {item.afterApproval.map((step, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 10. PRIMARY & SECONDARY ACTION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
        <div className="flex items-center space-x-2 text-xs text-ink-muted font-medium">
          <ShieldAlert className="w-4 h-4 text-ink-muted shrink-0" />
          <span>Qubere Status: {item.agentStatusText}</span>
        </div>

        <div className="flex items-center space-x-2 flex-wrap">
          {/* Modify Action Button */}
          {item.allowModify && onOpenModify && (
            <Button
              variant="outline"
              size="sm"
              disabled={isExecuting}
              onClick={() => onOpenModify(item)}
              className="cursor-pointer"
            >
              Modify Action
            </Button>
          )}

          {/* Single View Shipment Link (No Duplication) */}
          <Link href={`/shipments/${item.shipmentId}`}>
            <Button variant="outline" size="sm" className="cursor-pointer">
              View Shipment
            </Button>
          </Link>

          {/* Contextual Reject Button if permitted */}
          {item.allowReject && (
            <Button
              variant="secondary"
              size="sm"
              disabled={isExecuting}
              onClick={() => handleAction("reject", `Rejected action for ${item.shipmentNumber}`)}
              className="cursor-pointer"
            >
              Reject
            </Button>
          )}

          {/* Primary Action Button */}
          <Button
            variant="primary"
            size="sm"
            disabled={isExecuting}
            onClick={() => handleAction("approve", `Approved ${item.primaryActionLabel}`)}
            className="cursor-pointer shadow-2xs font-extrabold px-4"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            <span>{isExecuting ? "Executing..." : item.primaryActionLabel}</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
