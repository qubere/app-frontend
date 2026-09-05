"use client";

import Link from "next/link";
import { AlertOctagon, ShieldAlert, Info, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatBlockId } from "./EntrySummaryProvenancePopover";

export interface EntrySummaryFindingLike {
  code: string;
  severity: "BLOCKING" | "WARNING" | "INFO";
  blocks: string[];
  lineNumber?: number;
  message: string;
  remediation: { label: string; anchor: string };
}

const SEVERITY_BADGE: Record<EntrySummaryFindingLike["severity"], "danger" | "warning" | "info"> = {
  BLOCKING: "danger",
  WARNING: "warning",
  INFO: "info",
};

const SEVERITY_ICON: Record<EntrySummaryFindingLike["severity"], typeof AlertOctagon> = {
  BLOCKING: AlertOctagon,
  WARNING: ShieldAlert,
  INFO: Info,
};

/**
 * Renders `ValidationResult.findings` (engine.ts) — already sorted
 * BLOCKING-first by the server. Remediation links point at the shipment
 * workspace, since every 7501 rule fixes the underlying shipment data, not
 * the draft itself (rules7501.ts's own remediation.label says as much:
 * "Fix on the shipment workspace").
 */
export function EntrySummaryValidationPanel({
  findings,
  blockingCount,
  warningCount,
  shipmentId,
}: {
  findings: EntrySummaryFindingLike[];
  blockingCount: number;
  warningCount: number;
  shipmentId: string;
}) {
  if (findings.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 flex items-center gap-2.5 text-emerald-800">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <p className="text-xs font-semibold">No validation findings — this draft is clean.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink">Validation Findings</h3>
        <div className="flex items-center gap-2">
          {blockingCount > 0 && <Badge variant="danger">{blockingCount} blocking</Badge>}
          {warningCount > 0 && <Badge variant="warning">{warningCount} warning{warningCount === 1 ? "" : "s"}</Badge>}
          {blockingCount === 0 && warningCount === 0 && <Badge variant="info">Info only</Badge>}
        </div>
      </div>
      <div className="divide-y divide-border">
        {findings.map((f, idx) => {
          const Icon = SEVERITY_ICON[f.severity];
          return (
            <div key={`${f.code}-${idx}`} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      f.severity === "BLOCKING" ? "text-red-500" : f.severity === "WARNING" ? "text-amber-500" : "text-blue-500"
                    }`}
                  />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] font-bold text-ink-muted">{f.code}</span>
                      <Badge variant={SEVERITY_BADGE[f.severity]}>{f.severity}</Badge>
                      {f.lineNumber != null && (
                        <span className="text-[10px] font-bold text-ink-muted">Line {f.lineNumber}</span>
                      )}
                    </div>
                    <p className="text-xs text-ink">{f.message}</p>
                    {f.blocks.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {f.blocks.map((b) => (
                          <span key={b} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-surface-muted border border-border text-ink-muted">
                            {formatBlockId(b)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <Link
                  href={`/app/shipments/${shipmentId}${f.remediation.anchor}`}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg border border-border bg-surface-muted hover:bg-white text-[10px] font-bold text-brand whitespace-nowrap"
                >
                  {f.remediation.label}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
