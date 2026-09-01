"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck, Landmark, ScrollText, Loader2, Play } from "lucide-react";
import {
  mapEmbargoResult,
  mapPgaResult,
  mapReconResult,
  type CheckResult,
  type CheckStatus,
} from "./complianceCheckResults";

interface ComplianceChecksPanelProps {
  shipmentId: string;
  /** Embargo screening inputs, resolved from the shipment on the server. */
  embargoInputs: {
    countryOfOrigin: string | null;
    transshipmentPort: string | null;
    manufacturerLocation: string | null;
  };
  /** Rows already persisted for this shipment, for the initial (pre-run) state. */
  initial: {
    pgaRequirementCount: number;
    openReconciliationIssues: number;
    criticalReconciliationIssues: number;
  };
  /** `ai.use` -- embargo + PGA screening. */
  canRunAiChecks: boolean;
  /** `shipments.manage` -- reconciliation. */
  canRunReconciliation: boolean;
}

const STATUS_STYLE: Record<CheckStatus, string> = {
  clear: "text-emerald-700 bg-emerald-50 border-emerald-200",
  attention: "text-amber-700 bg-amber-50 border-amber-200",
  blocked: "text-red-700 bg-red-50 border-red-200",
  "not-screened": "text-ink-muted bg-surface-muted border-border",
  "not-run": "text-ink-muted bg-surface-muted border-border",
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  clear: "Clear",
  attention: "Action needed",
  blocked: "Blocked",
  "not-screened": "Not screened",
  "not-run": "Not run",
};

export function ComplianceChecksPanel({
  shipmentId,
  embargoInputs,
  initial,
  canRunAiChecks,
  canRunReconciliation,
}: ComplianceChecksPanelProps) {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const [embargo, setEmbargo] = useState<CheckResult>({
    status: "not-run",
    headline: "Screen origin, transshipment and manufacturer against OFAC / UFLPA rules.",
  });
  const [pga, setPga] = useState<CheckResult>(
    initial.pgaRequirementCount > 0
      ? {
          status: "attention",
          headline: `${initial.pgaRequirementCount} partner-government-agency requirement${initial.pgaRequirementCount === 1 ? "" : "s"} on record.`,
        }
      : { status: "not-run", headline: "Screen line items against FDA, FCC and EPA rules." }
  );
  const [recon, setRecon] = useState<CheckResult>(
    initial.openReconciliationIssues > 0
      ? {
          status: initial.criticalReconciliationIssues > 0 ? "blocked" : "attention",
          headline: `${initial.openReconciliationIssues} open reconciliation issue${initial.openReconciliationIssues === 1 ? "" : "s"}${initial.criticalReconciliationIssues > 0 ? ` (${initial.criticalReconciliationIssues} critical)` : ""}.`,
        }
      : { status: "not-run", headline: "Compare document fields across the shipment for mismatches." }
  );

  async function run(
    key: string,
    fn: () => Promise<Response>,
    set: (r: CheckResult) => void,
    map: (body: unknown) => CheckResult
  ) {
    setRunning(key);
    setErrors((e) => ({ ...e, [key]: null }));
    try {
      const res = await fn();
      const data = await res.json().catch(() => null);
      if (!res.ok && res.status !== 503) {
        throw new Error(data?.error?.message || `Request failed (${res.status})`);
      }
      set(map(data));
      // Persisted rows (PgaRequirement / ReconciliationIssue) feed the readiness
      // ribbon and exceptions drawer -- refresh the server component so they update.
      router.refresh();
    } catch (err) {
      setErrors((e) => ({ ...e, [key]: err instanceof Error ? err.message : "Something went wrong" }));
    } finally {
      setRunning(null);
    }
  }

  const rows = [
    {
      key: "embargo",
      icon: ShieldCheck,
      title: "Embargo screening",
      result: embargo,
      enabled: canRunAiChecks,
      disabledReason: canRunAiChecks ? undefined : "Requires the ai.use permission.",
      onRun: () =>
        run(
          "embargo",
          () =>
            fetch("/api/screening/embargo", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(embargoInputs),
            }),
          setEmbargo,
          mapEmbargoResult
        ),
    },
    {
      key: "pga",
      icon: Landmark,
      title: "PGA screening",
      result: pga,
      enabled: canRunAiChecks,
      disabledReason: canRunAiChecks ? undefined : "Requires the ai.use permission.",
      onRun: () =>
        run(
          "pga",
          () =>
            fetch("/api/pga/screen", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ shipmentId }),
            }),
          setPga,
          mapPgaResult
        ),
    },
    {
      key: "recon",
      icon: ScrollText,
      title: "Reconciliation",
      result: recon,
      enabled: canRunReconciliation,
      disabledReason: canRunReconciliation ? undefined : "Requires the shipments.manage permission.",
      onRun: () =>
        run(
          "recon",
          () =>
            fetch("/api/reconcile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ shipmentId }),
            }),
          setRecon,
          mapReconResult
        ),
    },
  ];

  return (
    <div className="bg-white p-5 rounded-3xl border border-border shadow-2xs">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted">Compliance checks</h2>
        <span className="text-[11px] text-ink-muted">Run on demand — results feed the readiness ribbon</span>
      </div>

      <ul className="divide-y divide-border">
        {rows.map((row) => {
          const Icon = row.icon;
          const isRunning = running === row.key;
          return (
            <li key={row.key} className="py-3 flex items-start gap-3">
              <span className="w-8 h-8 rounded-xl bg-surface-muted border border-border flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-ink-muted" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{row.title}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[row.result.status]}`}
                  >
                    {STATUS_LABEL[row.result.status]}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">{row.result.headline}</p>
                {row.result.detail && <p className="text-[11px] text-ink-muted/80 mt-0.5">{row.result.detail}</p>}
                {errors[row.key] && <p className="text-[11px] text-red-600 mt-1">{errors[row.key]}</p>}
              </div>
              <button
                onClick={row.onRun}
                disabled={!row.enabled || isRunning || running !== null}
                title={row.disabledReason}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-muted border border-border text-xs font-bold text-ink hover:bg-white hover:border-brand disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {row.result.status === "not-run" ? "Run" : "Re-run"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
