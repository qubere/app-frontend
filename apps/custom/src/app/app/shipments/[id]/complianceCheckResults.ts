/**
 * Pure mappers from the raw /api/screening/embargo, /api/pga/screen and
 * /api/reconcile response bodies to the compact status a broker sees on the
 * shipment "Compliance checks" panel. Kept out of the component so the
 * status logic is unit-testable.
 */

export type CheckStatus = "clear" | "attention" | "blocked" | "not-run" | "not-screened";

export interface CheckResult {
  status: CheckStatus;
  headline: string;
  detail?: string;
}

export function mapEmbargoResult(body: unknown): CheckResult {
  const r = (body as { embargoResult?: Record<string, unknown> } | null)?.embargoResult;
  if (!r || r.status === "NOT_SCREENED") {
    return {
      status: "not-screened",
      headline: (r?.actionRequired as string) || "No embargo rules are loaded.",
    };
  }
  if (r.isEmbargoed) {
    const matched = Array.isArray(r.matchedRules) ? r.matchedRules.length : 0;
    return {
      status: "blocked",
      headline: `${matched} embargo rule match. ${(r.actionRequired as string) || ""}`.trim(),
    };
  }
  return { status: "clear", headline: "No OFAC / UFLPA embargo match." };
}

export function mapPgaResult(body: unknown): CheckResult {
  const r = (body as { pgaScreening?: Record<string, unknown> } | null)?.pgaScreening;
  if (!r || r.requiresPgaFiling === null || r.requiresPgaFiling === undefined) {
    return {
      status: "not-screened",
      headline: (r?.notScreenedReason as string) || "Nothing to screen.",
    };
  }
  const flagged = Array.isArray(r.flaggedAgencies) ? (r.flaggedAgencies as string[]) : [];
  const screened = Array.isArray(r.agenciesScreened) ? (r.agenciesScreened as string[]) : [];
  if (r.requiresPgaFiling) {
    const count = Number(r.pgaFlagsCount) || flagged.length;
    return {
      status: "attention",
      headline: `${count} requirement${count === 1 ? "" : "s"} — ${flagged.join(", ")}.`,
      detail: screened.length ? `Screened ${screened.join(", ")}.` : undefined,
    };
  }
  return { status: "clear", headline: "No FDA / FCC / EPA filing required." };
}

export function mapReconResult(body: unknown): CheckResult {
  const r = (body as { reconciliation?: Record<string, unknown> } | null)?.reconciliation;
  const issues = Number(r?.issuesCount) || 0;
  const critical = Number(r?.criticalCount) || 0;
  switch (r?.status) {
    case "BLOCKED":
      return { status: "blocked", headline: `${critical} critical mismatch${critical === 1 ? "" : "es"} of ${issues}.` };
    case "WARNINGS":
      return { status: "attention", headline: `${issues} mismatch${issues === 1 ? "" : "es"} to review.` };
    case "INCOMPLETE": {
      const skipped = Array.isArray(r.skippedChecks) ? r.skippedChecks.length : 0;
      return { status: "not-screened", headline: `Partial — ${skipped} check(s) skipped (missing documents).` };
    }
    default:
      return { status: "clear", headline: "Document fields reconcile." };
  }
}
