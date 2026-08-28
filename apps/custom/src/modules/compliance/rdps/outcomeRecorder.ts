// Continuous Party Monitoring (RDPS) -- per-candidate outcome recording.
//
// Calls the EXACT canonical rescreenParty() every ordinary Party Master
// rescreen uses -- never a second matcher. rescreenParty() already persists
// a new RestrictedPartyScreeningResult and (via persistScreeningRun ->
// evaluateAndQueue) already queues a PARTY_RESCREEN_HIT/PAL_RESCREEN_HIT
// ComplianceNotification whenever the FRESH result is HIT/REVIEW_REQUIRED --
// regardless of whether that's a worsening transition. This module does NOT
// call evaluateAndQueue a second time; doing so would double-send the same
// alert. What it adds on top is RDPS-specific: an immutable RdpsPartyOutcome
// evidence row, and -- only when the transition is a genuine WORSENING
// relative to the party's prior status -- a Task/Exception so it surfaces
// in the Exceptions queue, not just an inbox notification.
import { db } from "@/lib/db";
import type { CandidateReason } from "../../agents/compliance/restrictedParty/candidateGeneration";
import { rescreenParty, STATUS_SEVERITY, worseStatus } from "../../agents/compliance/restrictedParty/partyScreeningLifecycle";
import type { RestrictedPartyScreeningStatus } from "../../agents/compliance/restrictedParty/types";
import { createExceptionItem } from "@/lib/exceptions/createException";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { recordUsageEvent } from "@/lib/billing/telemetry";

export interface RecordRdpsOutcomeInput {
  runId: string;
  accountId: string;
  partyId: string;
  candidateReasons: CandidateReason[];
  /** ReferenceDataChangeSet ids that produced this party as a DELTA_IMPACT candidate. Omitted/empty for FULL_POPULATION/MANUAL/TARGETED runs. */
  triggeringChangeSetIds?: string[];
}

/**
 * Deterministic previous->new classification for a Continuous Party
 * Monitoring outcome (spec: UNCHANGED_CLEAR/UNCHANGED_REVIEW/UNCHANGED_HIT,
 * NEW_REVIEW/NEW_HIT, ESCALATED, RISK_REDUCED/CLEARED, ERROR). A missing
 * prior summary is treated as CLEAR baseline, matching isWorseningTransition
 * below -- a first-ever HIT/REVIEW_REQUIRED must still classify as NEW_*,
 * not UNCHANGED_*.
 */
export type RdpsTransitionType =
  | "UNCHANGED_CLEAR"
  | "UNCHANGED_REVIEW"
  | "UNCHANGED_HIT"
  | "NEW_REVIEW"
  | "NEW_HIT"
  | "ESCALATED"
  | "RISK_REDUCED"
  | "CLEARED"
  | "ERROR"
  | "SKIPPED"
  | "PARTIAL";

const RISK_RANK: Record<"CLEAR" | "REVIEW_REQUIRED" | "HIT", number> = { CLEAR: 0, REVIEW_REQUIRED: 1, HIT: 2 };

export function classifyRdpsTransition(
  previous: RestrictedPartyScreeningStatus | null,
  fresh: RestrictedPartyScreeningStatus
): RdpsTransitionType {
  if (fresh === "ERROR") return "ERROR";
  if (fresh === "SKIPPED") return "SKIPPED";
  if (fresh === "PARTIAL") return "PARTIAL";

  const baselineRaw = previous ?? "CLEAR";
  const baseline: "CLEAR" | "REVIEW_REQUIRED" | "HIT" = baselineRaw in RISK_RANK ? (baselineRaw as any) : "CLEAR";
  const baselineRank = RISK_RANK[baseline];
  const freshRank = RISK_RANK[fresh];

  if (freshRank === baselineRank) return `UNCHANGED_${fresh}` as RdpsTransitionType;
  if (freshRank > baselineRank) {
    if (fresh === "HIT" && baseline === "REVIEW_REQUIRED") return "ESCALATED";
    return fresh === "HIT" ? "NEW_HIT" : "NEW_REVIEW";
  }
  // freshRank < baselineRank: risk decreased.
  return fresh === "CLEAR" ? "CLEARED" : "RISK_REDUCED";
}

export interface RdpsOutcomeRecord {
  outcomeId: string;
  previousStatus: RestrictedPartyScreeningStatus | null;
  newStatus: RestrictedPartyScreeningStatus | null;
  isWorsening: boolean;
  errored: boolean;
}

/**
 * A transition counts as worsening only when the fresh status is strictly
 * worse than the prior one -- a repeat HIT->HIT rescreen (already alerted on
 * by rescreenParty's own notification path) is not re-flagged here, and a
 * party with no prior summary (never screened before) is treated as if its
 * baseline were CLEAR, so a first-ever HIT/REVIEW_REQUIRED still counts.
 */
function isWorseningTransition(previous: RestrictedPartyScreeningStatus | null, fresh: RestrictedPartyScreeningStatus): boolean {
  const baseline = previous ?? "CLEAR";
  return worseStatus(fresh, baseline) === fresh && STATUS_SEVERITY[fresh] > STATUS_SEVERITY[baseline];
}

function exceptionSeverityFor(status: RestrictedPartyScreeningStatus): string {
  return status === "HIT" ? "Critical" : "High";
}

/**
 * Records one RDPS candidate's outcome for a run. Fail-closed: if
 * rescreenParty itself throws, an outcome row is STILL written with
 * errorMessage set and errored:true returned -- never silently skipped,
 * never treated as CLEAR. Callers must count an errored outcome toward
 * RdpsRun.erroredCount and must never let a run with erroredCount > 0
 * finish as COMPLETED.
 */
export async function recordRdpsOutcome(input: RecordRdpsOutcomeInput): Promise<RdpsOutcomeRecord> {
  const { runId, accountId, partyId, candidateReasons, triggeringChangeSetIds = [] } = input;

  const [priorSummary, activeApproval] = await Promise.all([
    db.partyScreeningSummary.findUnique({ where: { partyId }, select: { screeningStatus: true } }),
    db.partyScreeningApproval.findFirst({ where: { accountId, partyId, status: "PRE_APPROVED" }, select: { id: true } }),
  ]);
  const previousStatus = (priorSummary?.screeningStatus as RestrictedPartyScreeningStatus | undefined) ?? null;
  const hadActivePreApproval = activeApproval !== null;

  try {
    const rescreenResult = await rescreenParty(accountId, partyId);
    const newStatus = rescreenResult.overallStatus;
    const primaryResult = rescreenResult.results.find((r) => r.passType === "PARTY_NAME") ?? rescreenResult.results[0];
    const worsening = isWorseningTransition(previousStatus, newStatus);

    let exceptionItemId: string | null = null;
    if (worsening && (newStatus === "HIT" || newStatus === "REVIEW_REQUIRED")) {
      try {
        const exception = await createExceptionItem({
          accountId,
          category: "COMPLIANCE",
          type: "rdps_worsening_transition",
          severity: exceptionSeverityFor(newStatus),
          description: `Continuous Party Monitoring detected a worsening screening transition for this party: ${previousStatus ?? "never screened"} -> ${newStatus}.`,
          status: "Open",
        });
        exceptionItemId = exception.id;
      } catch (err) {
        console.error(`[rdps] Failed to create worsening exception for party ${partyId}, run ${runId}:`, err);
      }

      try {
        await createAuditLog({
          accountId,
          action: AuditAction.RDPS_WORSENING_DETECTED,
          entity: "Party",
          entityId: partyId,
          source: "SYSTEM",
          metadata: { runId, previousStatus, newStatus, candidateReasons },
        });
      } catch (err) {
        console.error(`[rdps] Failed to write worsening audit log for party ${partyId}, run ${runId}:`, err);
      }
    }

    const outcome = await db.rdpsPartyOutcome.create({
      data: {
        runId,
        accountId,
        partyId,
        candidateReasons,
        previousStatus: previousStatus ?? undefined,
        newStatus,
        transitionType: classifyRdpsTransition(previousStatus, newStatus),
        triggeringChangeSetIds,
        isWorsening: worsening,
        hadActivePreApproval,
        screeningResultId: primaryResult?.id ?? null,
        exceptionItemId,
      },
    });

    try {
      await recordUsageEvent({
        accountId,
        eventCode: "RDPS_RESCREEN_COMPLETED",
        quantity: 1,
        unit: "party",
        sourceFunction: "recordRdpsOutcome",
        sourceAgent: "RDPS Continuous Monitoring",
        automated: true,
        success: true,
        idempotencyKey: `billing:rdps:${runId}:${partyId}`,
        metadata: { runId, partyId, previousStatus, newStatus, isWorsening: worsening },
      });
    } catch (billingError) {
      console.error("Failed to record RDPS billing usage", billingError);
    }

    return { outcomeId: outcome.id, previousStatus, newStatus, isWorsening: worsening, errored: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const outcome = await db.rdpsPartyOutcome.create({
      data: {
        runId,
        accountId,
        partyId,
        candidateReasons,
        previousStatus: previousStatus ?? undefined,
        // newStatus is required (non-nullable) -- ERROR is the honest status
        // for "we don't actually know," never CLEAR (that would be a false
        // clear, exactly what fail-closed exists to prevent).
        newStatus: "ERROR",
        transitionType: "ERROR",
        triggeringChangeSetIds,
        isWorsening: false,
        hadActivePreApproval,
        errorMessage,
      },
    });

    try {
      await recordUsageEvent({
        accountId,
        eventCode: "RDPS_RESCREEN_COMPLETED",
        quantity: 1,
        unit: "party",
        sourceFunction: "recordRdpsOutcome",
        sourceAgent: "RDPS Continuous Monitoring",
        automated: true,
        success: false,
        idempotencyKey: `billing:rdps:${runId}:${partyId}`,
        metadata: { runId, partyId, errorMessage },
      });
    } catch (billingError) {
      console.error("Failed to record RDPS billing usage (errored outcome)", billingError);
    }

    return { outcomeId: outcome.id, previousStatus, newStatus: null, isWorsening: false, errored: true };
  }
}
