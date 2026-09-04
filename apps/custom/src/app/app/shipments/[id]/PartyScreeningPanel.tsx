import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import type { RestrictedPartyDispositionStatus, RestrictedPartyScreeningStatus } from "@prisma/client";

export interface PartyScreeningRow {
  shipmentPartyId: string;
  role: string;
  partyName: string;
  partyId: string | null;
  status: RestrictedPartyScreeningStatus | "NOT_SCREENED";
  screeningDate: string | null;
  hitCount: number;
  redFlagCount: number;
  dispositionStatus: RestrictedPartyDispositionStatus | null;
}

const STATUS_STYLE: Record<PartyScreeningRow["status"], string> = {
  CLEAR: "text-emerald-700 bg-emerald-50 border-emerald-200",
  HIT: "text-red-700 bg-red-50 border-red-200",
  REVIEW_REQUIRED: "text-amber-700 bg-amber-50 border-amber-200",
  PARTIAL: "text-amber-700 bg-amber-50 border-amber-200",
  SKIPPED: "text-ink-muted bg-surface-muted border-border",
  ERROR: "text-red-700 bg-red-50 border-red-200",
  STALE: "text-ink-muted bg-surface-muted border-border",
  NOT_SCREENED: "text-ink-muted bg-surface-muted border-border",
};

const STATUS_LABEL: Record<PartyScreeningRow["status"], string> = {
  CLEAR: "Clear",
  HIT: "Hit",
  REVIEW_REQUIRED: "Review required",
  PARTIAL: "Partial",
  SKIPPED: "Skipped",
  ERROR: "Error",
  STALE: "Stale",
  NOT_SCREENED: "Not yet screened",
};

const DISPOSITION_LABEL: Record<RestrictedPartyDispositionStatus, string> = {
  PENDING: "Pending review",
  CONFIRMED_MATCH: "Reviewed: confirmed match",
  FALSE_POSITIVE: "Reviewed: false positive",
  APPROVED: "Reviewed: approved",
  BLOCKED: "Reviewed: blocked",
  REQUEST_MORE_INFORMATION: "Reviewed: more information requested",
};

/**
 * Restricted-party screening runs automatically (ComplianceAuditAgent, on
 * document upload / shipment field edits) but its results previously only
 * surfaced on the account-wide Compliance workspace, keyed by party -- there
 * was no way to see from a shipment's own page whether its shipper/consignee/
 * notify party came back with a hit. This is the read-only surface for that;
 * screening itself is still triggered from the pipeline or from the Party
 * Master page (rescreen button), not from here.
 */
export function PartyScreeningPanel({ rows }: { rows: PartyScreeningRow[] }) {
  const hasAttention = rows.some((r) => r.status === "HIT" || r.status === "REVIEW_REQUIRED" || r.status === "ERROR");

  return (
    <div className="bg-white p-5 rounded-3xl border border-border shadow-2xs">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted">Party screening</h2>
        <span className="text-[11px] text-ink-muted">
          Runs automatically on upload &amp; shipment edits — via Compliance Audit Agent
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-ink-muted py-2">No transaction parties are attached to this shipment yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.shipmentPartyId} className="py-3 flex items-start gap-3">
              <span className="w-8 h-8 rounded-xl bg-surface-muted border border-border flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4 text-ink-muted" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{row.partyName}</span>
                  <span className="text-[11px] text-ink-muted uppercase tracking-wide">{row.role}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[row.status]}`}
                  >
                    {STATUS_LABEL[row.status]}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  {row.status === "NOT_SCREENED"
                    ? "Not yet screened against OFAC / BIS / UFLPA reference lists."
                    : `${row.hitCount} match${row.hitCount === 1 ? "" : "es"}, ${row.redFlagCount} red flag${row.redFlagCount === 1 ? "" : "s"}${row.screeningDate ? ` · last screened ${new Date(row.screeningDate).toLocaleString()}` : ""}.`}
                </p>
                {row.dispositionStatus && (
                  <p className="text-[11px] text-ink-muted/80 mt-0.5">{DISPOSITION_LABEL[row.dispositionStatus]}</p>
                )}
              </div>
              {row.partyId && (
                <Link
                  href={`/app/parties/${row.partyId}`}
                  className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-lg bg-surface-muted border border-border text-xs font-bold text-ink hover:bg-white hover:border-brand transition-colors"
                >
                  View
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {hasAttention && (
        <p className="text-[11px] text-red-600 mt-3">
          One or more transaction parties need review before this shipment can be filed — see the linked Party
          Master record for the matched entry and disposition action.
        </p>
      )}
    </div>
  );
}
