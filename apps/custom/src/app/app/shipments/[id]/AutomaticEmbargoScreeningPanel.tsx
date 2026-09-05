import { ShieldAlert } from "lucide-react";
import type { AuditCheckResult } from "@/modules/agents/complianceAuditAgent";

export type AutomaticEmbargoStatus = "clear" | "attention" | "blocked" | "not-run";

export interface AutomaticEmbargoFinding {
  ruleName: string;
  severity: AuditCheckResult["severity"];
  details: string;
  lineNumber?: number;
}

export interface AutomaticEmbargoScreeningProps {
  status: AutomaticEmbargoStatus;
  findings: AutomaticEmbargoFinding[];
  lastRunAt: string | null;
}

const STATUS_STYLE: Record<AutomaticEmbargoStatus, string> = {
  clear: "text-emerald-700 bg-emerald-50 border-emerald-200",
  attention: "text-amber-700 bg-amber-50 border-amber-200",
  blocked: "text-red-700 bg-red-50 border-red-200",
  "not-run": "text-ink-muted bg-surface-muted border-border",
};

const STATUS_LABEL: Record<AutomaticEmbargoStatus, string> = {
  clear: "Clear",
  attention: "Attention",
  blocked: "Blocked",
  "not-run": "Not yet run",
};

/**
 * The on-demand "Embargo screening" tile (ComplianceChecksPanel) only checks
 * three shipment-level fields against EmbargoRule. ComplianceAuditAgent runs
 * a broader pass automatically (document upload / field edits): per-line-item
 * country of origin, plus runCountryEmbargoScreening's destination/origin and
 * private-embargo-rule checks. That result was previously only reachable by
 * opening the raw AgentDecision row -- this reads it straight, no new
 * screening logic here.
 */
export function AutomaticEmbargoScreeningPanel({ status, findings, lastRunAt }: AutomaticEmbargoScreeningProps) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-border shadow-2xs">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted">
          Full compliance audit
        </h2>
        <span className="text-[11px] text-ink-muted">
          Runs on upload &amp; shipment edits — per line item, incl. destination &amp; private rules
        </span>
      </div>

      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-xl bg-surface-muted border border-border flex items-center justify-center shrink-0">
          <ShieldAlert className="w-4 h-4 text-ink-muted" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">Compliance Audit Agent</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[status]}`}>
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            {status === "not-run"
              ? "Has not run for this shipment yet — it fires on the next document upload or field edit."
              : `${findings.length} finding${findings.length === 1 ? "" : "s"}${lastRunAt ? ` · last run ${new Date(lastRunAt).toLocaleString()}` : ""}.`}
          </p>

          {findings.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {findings.map((f, i) => (
                <li key={i} className="text-[11px] text-ink-muted/90 border-l-2 border-border pl-2">
                  <span className="font-semibold text-ink">
                    {f.ruleName}
                    {f.lineNumber ? ` (line ${f.lineNumber})` : ""}:
                  </span>{" "}
                  {f.details}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
