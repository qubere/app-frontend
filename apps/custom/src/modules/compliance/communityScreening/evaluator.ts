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
import type { CommunityScreeningChecksEnabled, CommunityScreeningOverrides } from "./types";

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
    return { enabled: true, status: "CLEAR", resultId: null };
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

  return { enabled: true, status: worst?.status ?? "ERROR", resultId: worst?.id ?? null };
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

export async function evaluateParty(
  row: CommunityScreeningPartyResult,
  params: EvaluatePartyRowParams
): Promise<void> {
  let rps: RpsOutcome = { enabled: false, status: null, resultId: null };
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
      embargoStatus: embargo.status,
      embargoEvidence: (embargo.evidence ?? undefined) as Prisma.InputJsonValue | undefined,
      aggregateStatus,
      errorMessage,
      failureReason:
        aggregateStatus === "FAILED"
          ? [
              rps.status && ["HIT", "REVIEW_REQUIRED"].includes(rps.status) ? `Restricted Party: ${rps.status}` : null,
              embargo.status === "HIT" ? "Embargo: HIT" : null,
            ]
              .filter(Boolean)
              .join("; ") || null
          : null,
      evaluatedAt: new Date(),
    },
  });
}
