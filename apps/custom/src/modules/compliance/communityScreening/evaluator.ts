// Per-party evaluation: calls the *canonical* RPS and Embargo engines --
// never reimplements matching/normalization. A per-row exception is caught
// and recorded as ERROR; it never throws out to the caller so one bad row
// never fails the whole batch.
import { db } from "@/lib/db";
import type { CommunityScreeningPartyResult, Prisma } from "@prisma/client";
import { runRestrictedPartyScreening } from "@/modules/agents/compliance/restrictedParty/restrictedPartyScreening";
import { persistScreeningRun } from "@/modules/agents/compliance/restrictedParty/persistResult";
import { checkPreApprovalGate } from "@/modules/agents/compliance/restrictedParty/preApproval";
import type { RestrictedPartyScreeningInput } from "@/modules/agents/compliance/restrictedParty/types";
import { getAccountEmbargoConfig } from "@/modules/agents/compliance/embargo/embargoRepository";
import { doEmbargoCheck } from "@/modules/agents/compliance/embargo/doEmbargoCheck";
import type { EmbargoCheckContext } from "@/modules/agents/compliance/embargo/types";
import { aggregatePartyStatus } from "./aggregation";
import type {
  CommunityScreeningChecksEnabled,
  CommunityScreeningFindingCategory,
  CommunityScreeningOverrides,
} from "./types";

export interface EvaluatePartyRowParams {
  accountId: string;
  runId: string;
  checksEnabled: CommunityScreeningChecksEnabled;
  overrides?: CommunityScreeningOverrides | null;
  complianceCountry?: string | null;
  requestedByUserId?: string | null;
  requestId?: string;
}

interface RpsOutcome {
  enabled: boolean;
  status: string | null;
  resultId: string | null;
  /** True when at least one denied-party candidate match was found, independent of any red-flag hit. */
  matchFound: boolean;
  /** True when at least one red-flag word hit was found, independent of any denied-party match. */
  redFlagFound: boolean;
  category: CommunityScreeningFindingCategory | null;
}

interface EmbargoOutcome {
  enabled: boolean;
  status: string | null;
  evidence: Record<string, unknown> | null;
}

async function evaluateRestrictedParty(
  row: CommunityScreeningPartyResult,
  params: EvaluatePartyRowParams
): Promise<RpsOutcome> {
  const gate = await checkPreApprovalGate({
    accountId: params.accountId,
    partyId: row.partyId,
    source: "COMMUNITY_SCREENING",
    userId: params.requestedByUserId,
    requestId: params.requestId,
  });

  if (gate.applied) {
    // Deliberately distinct from an ordinary CLEAR (no-match) result -- a
    // PRE_APPROVED_REUSE never ran the local matcher for this identity, so
    // it must never be presented as if it did. See preApproval.ts.
    return {
      enabled: true,
      status: "PRE_APPROVED_REUSE",
      resultId: gate.approvalId ?? null,
      matchFound: false,
      redFlagFound: false,
      category: "PAL_SUPPRESSED",
    };
  }

  const input: RestrictedPartyScreeningInput = {
    accountId: params.accountId,
    source: "COMMUNITY_SCREENING",
    partyId: row.partyId,
    externalReference: row.externalReference ?? row.id,
    identity: {
      name: row.snapshotName,
      address: row.snapshotAddress,
      city: row.snapshotCity,
      country: row.snapshotCountry,
    },
    nameThreshold: params.overrides?.nameThreshold,
    addressThreshold: params.overrides?.addressThreshold,
    countryMatchRequired: params.overrides?.countryMatchRequired,
    redFlagCheckEnabled: params.overrides?.redFlagCheckEnabled,
  };

  const wasPreviouslyPreApproved = !gate.applied && Boolean(gate.approvalId);

  const runResult = await runRestrictedPartyScreening(input);
  const persisted = await persistScreeningRun(input, runResult, {
    notificationTypeOverride: wasPreviouslyPreApproved ? "PAL_RESCREEN_HIT" : undefined,
    createdByUserId: params.requestedByUserId,
    requestId: params.requestId,
  });

  const severity: Record<string, number> = { HIT: 5, REVIEW_REQUIRED: 4, PARTIAL: 3, ERROR: 2, SKIPPED: 1, CLEAR: 0 };
  let worst: (typeof persisted)[number] | undefined;
  for (const p of persisted) {
    if (!worst || (severity[p.status] ?? 0) > (severity[worst.status] ?? 0)) worst = p;
  }

  const status = worst?.status ?? "ERROR";
  // Tracked across every pass (party-name + contact-name), not just the
  // worst-severity pass -- a denied-party match or red-flag hit on either
  // pass is a real finding and must never be dropped by the severity
  // collapse above.
  const matchFound = persisted.some((p) => ((p as { hitCount?: number }).hitCount ?? 0) > 0);
  const redFlagFound = persisted.some((p) => ((p as { redFlagCount?: number }).redFlagCount ?? 0) > 0);

  let category: CommunityScreeningFindingCategory;
  if (status === "ERROR") category = "SYSTEM_ERROR";
  else if (status === "SKIPPED") category = "SKIPPED";
  else if (matchFound) category = status === "HIT" ? "CONFIRMED_MATCH" : "POTENTIAL_DENIED_PARTY_MATCH";
  else if (redFlagFound) category = "RED_FLAG_ONLY";
  else category = "NO_MATCH";

  return { enabled: true, status, resultId: worst?.id ?? null, matchFound, redFlagFound, category };
}

async function evaluateEmbargo(
  row: CommunityScreeningPartyResult,
  params: EvaluatePartyRowParams
): Promise<EmbargoOutcome> {
  const complianceCountry = params.complianceCountry;
  const targetCountry = row.snapshotCountry;

  if (!complianceCountry || !targetCountry) {
    return {
      enabled: true,
      status: "SKIPPED",
      evidence: { reason: "Missing compliance country or party country for embargo screening" },
    };
  }

  const accountConfig = await getAccountEmbargoConfig(params.accountId);

  const ctx: EmbargoCheckContext = {
    accountId: params.accountId,
    // Community Screening never persists EmbargoUsageHeader/Line -- doEmbargoCheck
    // itself never reads shipmentId, only the caller does for that persistence,
    // which this feature deliberately skips. The run's own id satisfies the type.
    shipmentId: params.runId,
    partyId: row.partyId ?? undefined,
    screeningLevel: "PARTY",
    complianceCountry,
    targetCountry,
    type: "O",
    screeningDate: new Date(),
    accountConfig,
  };

  const result = await doEmbargoCheck(ctx);
  return {
    enabled: true,
    status: result.result,
    evidence: {
      matcher: result.matcher,
      ruleId: result.ruleId ?? null,
      reason: result.reason ?? null,
      evidence: result.evidence ?? null,
    },
  };
}

/**
 * A denied-party match and a red-flag hit are independent findings (see
 * types.ts) -- when both are present on the same failed row, both must be
 * named, never collapsed to a single generic "Restricted Party: HIT".
 */
function describeRestrictedPartyFailure(rps: RpsOutcome): string | null {
  if (!rps.status || !["HIT", "REVIEW_REQUIRED"].includes(rps.status)) return null;

  const parts: string[] = [];
  if (rps.matchFound) {
    parts.push(rps.status === "HIT" ? "Restricted Party: Confirmed Match" : "Restricted Party: Potential Match (Review Required)");
  }
  if (rps.redFlagFound) {
    parts.push("Restricted Party: Red Flag");
  }
  return parts.length > 0 ? parts.join("; ") : `Restricted Party: ${rps.status}`;
}

export async function evaluateParty(
  row: CommunityScreeningPartyResult,
  params: EvaluatePartyRowParams
): Promise<void> {
  let rps: RpsOutcome = { enabled: false, status: null, resultId: null, matchFound: false, redFlagFound: false, category: null };
  let embargo: EmbargoOutcome = { enabled: false, status: null, evidence: null };
  let errorMessage: string | null = null;

  try {
    if (params.checksEnabled.restrictedParty) {
      rps = await evaluateRestrictedParty(row, params);
    }
    if (params.checksEnabled.embargo) {
      embargo = await evaluateEmbargo(row, params);
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  const aggregateStatus = errorMessage
    ? "ERROR"
    : aggregatePartyStatus({
        restrictedParty: { enabled: rps.enabled, status: rps.status },
        embargo: { enabled: embargo.enabled, status: embargo.status },
      });

  await db.communityScreeningPartyResult.update({
    where: { id: row.id },
    data: {
      restrictedPartyStatus: rps.status,
      restrictedPartyResultId: rps.resultId,
      restrictedPartyMatchFound: rps.enabled ? rps.matchFound : null,
      restrictedPartyRedFlagFound: rps.enabled ? rps.redFlagFound : null,
      restrictedPartyFindingCategory: rps.category,
      embargoStatus: embargo.status,
      embargoEvidence: (embargo.evidence ?? undefined) as Prisma.InputJsonValue | undefined,
      aggregateStatus,
      errorMessage,
      failureReason:
        aggregateStatus === "FAILED"
          ? [describeRestrictedPartyFailure(rps), embargo.status === "HIT" ? "Embargo: HIT" : null]
              .filter(Boolean)
              .join("; ") || null
          : null,
      evaluatedAt: new Date(),
    },
  });
}
