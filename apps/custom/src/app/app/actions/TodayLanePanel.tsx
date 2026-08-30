"use client";

import Link from "next/link";
import { ArrowUpRight, ShieldAlert, Scale, DollarSign, CheckCircle2 } from "lucide-react";
import type { TodayLane, TodayLaneSummary, TodaySeverity } from "@/modules/today/todayLanes";

const SEVERITY_DOT: Record<TodaySeverity, string> = {
  critical: "bg-red-500",
  high: "bg-amber-400",
  normal: "bg-gray-300",
};

const SEVERITY_LABEL: Record<TodaySeverity, string> = {
  critical: "Critical",
  high: "High",
  normal: "Normal",
};

const LANE_META: Record<
  Exclude<TodayLane, "operations">,
  { title: string; blurb: string; cta: string; Icon: typeof Scale }
> = {
  compliance: {
    title: "Compliance",
    blurb:
      "Open review-queue findings and screening hits across every shipment. Resolve them in the Compliance workspace, where the disposition and audit trail live.",
    cta: "Open in Compliance",
    Icon: Scale,
  },
  billing: {
    title: "Billing",
    blurb:
      "Open billing exceptions and revenue-leakage alerts. Resolve or waive them in the Billing workspace.",
    cta: "Open in Billing",
    Icon: DollarSign,
  },
};

export function TodayLanePanel({
  summary,
  lane,
}: {
  summary: TodayLaneSummary | null;
  lane: Exclude<TodayLane, "operations">;
}) {
  const meta = LANE_META[lane];

  if (!summary || summary.groups.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-border shadow-2xs p-10 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-ink">Nothing open in {meta.title}</h3>
        <p className="text-xs text-ink-muted max-w-sm mx-auto mt-1">{meta.blurb}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-white rounded-2xl border border-border shadow-2xs p-4">
        <div className="w-9 h-9 rounded-xl bg-surface-muted border border-border flex items-center justify-center shrink-0">
          <meta.Icon className="w-4 h-4 text-brand" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">
            {summary.openCount} open {meta.title.toLowerCase()} item{summary.openCount === 1 ? "" : "s"}
            {summary.criticalCount > 0 && (
              <span className="ml-2 text-red-600">· {summary.criticalCount} critical</span>
            )}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">{meta.blurb}</p>
        </div>
      </div>

      {summary.groups.map((group) => (
        <div key={group.key} className="bg-white rounded-2xl border border-border shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface-muted/50">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[group.severity]}`} />
              <span className="text-sm font-bold text-ink truncate">{group.label}</span>
              {group.clientName && (
                <span className="text-xs text-ink-muted truncate">· {group.clientName}</span>
              )}
            </div>
            <span className="text-[11px] font-bold text-ink-muted shrink-0">
              {group.items.length} item{group.items.length === 1 ? "" : "s"}
            </span>
          </div>

          <ul className="divide-y divide-border">
            {group.items.map((item) => (
              <li key={item.id} className="px-4 py-3 flex items-start gap-3">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${SEVERITY_DOT[item.severity]}`}
                  title={SEVERITY_LABEL[item.severity]}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{item.summary}</p>
                </div>
                <Link
                  href={item.href}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-brand hover:bg-brand/10 transition-colors"
                >
                  {meta.cta}
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="flex items-center gap-1.5 text-[11px] text-ink-muted px-1">
        <ShieldAlert className="w-3.5 h-3.5" />
        Resolving and waiving happen in the {meta.title} workspace so the disposition is recorded against its audit trail.
      </p>
    </div>
  );
}
