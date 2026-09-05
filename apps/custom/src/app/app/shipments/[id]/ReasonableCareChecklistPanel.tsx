import { CheckCircle2, XCircle, AlertTriangle, MinusCircle, ClipboardCheck } from "lucide-react";
import type { ReasonableCareEvaluation, ChecklistResult, OverallResult } from "@/modules/compliance/reasonableCare";

const RESULT_STYLE: Record<ChecklistResult, string> = {
  Pass: "text-emerald-700 bg-emerald-50 border-emerald-200",
  Fail: "text-red-700 bg-red-50 border-red-200",
  NeedsReview: "text-amber-700 bg-amber-50 border-amber-200",
  NotEvaluated: "text-ink-muted bg-surface-muted border-border",
};

const RESULT_ICON: Record<ChecklistResult, typeof CheckCircle2> = {
  Pass: CheckCircle2,
  Fail: XCircle,
  NeedsReview: AlertTriangle,
  NotEvaluated: MinusCircle,
};

const RESULT_LABEL: Record<ChecklistResult, string> = {
  Pass: "Pass",
  Fail: "Fail",
  NeedsReview: "Needs review",
  NotEvaluated: "Not evaluated",
};

const OVERALL_STYLE: Record<OverallResult, string> = {
  Pass: "text-emerald-700 bg-emerald-50 border-emerald-200",
  Fail: "text-red-700 bg-red-50 border-red-200",
  NeedsReview: "text-amber-700 bg-amber-50 border-amber-200",
};

/**
 * Renders the 5-item reasonable-care checklist (`evaluateReasonableCare`) for a
 * shipment. Display-only — the same evaluation is embedded in the exported
 * reasonable-care defense package. A check that could not be performed shows
 * "Not evaluated", never a default pass.
 */
export function ReasonableCareChecklistPanel({ evaluation }: { evaluation: ReasonableCareEvaluation | null }) {
  if (!evaluation) return null;

  const { checklistItems, overallResult, riskScore, evaluatedCount } = evaluation;

  return (
    <div className="bg-white p-5 rounded-3xl border border-border shadow-2xs">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted">Reasonable-care review</h2>
        <span className="text-[11px] text-ink-muted">
          19 U.S.C. 1484 — recomputed from current shipment data
        </span>
      </div>

      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-xl bg-surface-muted border border-border flex items-center justify-center shrink-0">
          <ClipboardCheck className="w-4 h-4 text-ink-muted" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-ink">Care checklist</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${OVERALL_STYLE[overallResult]}`}>
              {overallResult === "NeedsReview" ? "Needs review" : overallResult}
            </span>
            <span className="text-[11px] text-ink-muted">
              risk score {riskScore} · {evaluatedCount} of {checklistItems.length} checks performed
            </span>
          </div>

          <ul className="mt-2.5 space-y-1.5">
            {checklistItems.map((c, i) => {
              const Icon = RESULT_ICON[c.result];
              return (
                <li key={i} className="flex items-start gap-2 text-[11px]">
                  <span
                    className={`mt-0.5 shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border font-semibold ${RESULT_STYLE[c.result]}`}
                  >
                    <Icon className="w-3 h-3" />
                    {RESULT_LABEL[c.result]}
                  </span>
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{c.item}:</span>{" "}
                    <span className="text-ink-muted/90">{c.evidence}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
