// Restricted / Denied-Party Screening -- persistence.
//
// Writes one immutable RestrictedPartyScreeningResult row per pass, plus its
// matches and red-flag hits, in a single transaction. Never updates an
// existing row -- a re-screen always creates new rows, so history is never
// overwritten. A PENDING RestrictedPartyDisposition is created alongside
// every HIT/REVIEW_REQUIRED result so the reviewer queue has something to
// pick up; CLEAR/SKIPPED/ERROR results get no disposition (nothing to review).
import { db } from "@/lib/db";
import type { ComplianceNotificationType, Prisma, RestrictedPartyScreeningResult } from "@prisma/client";
import type { RestrictedPartyScreeningInput, RestrictedPartyScreeningRunResult } from "./types";
import { RPS_MATCHER_VERSION } from "./types";
import { evaluateAndQueue } from "@/modules/compliance/notifications/notificationService";

export type PersistedRestrictedPartyResult = RestrictedPartyScreeningResult & {
  matches: Prisma.RestrictedPartyMatchGetPayload<{ include: { screeningEntity: { select: { sourcePublishedAt: true } } } }>[];
  redFlagHits: Prisma.RestrictedPartyRedFlagHitGetPayload<Record<string, never>>[];
};

export interface PersistScreeningRunOptions {
  /**
   * Overrides the default notification-type mapping. Set to PAL_RESCREEN_HIT
   * by callers that already know the screened party was previously
   * PRE_APPROVED (see shipmentScreening.ts / partyScreeningLifecycle.ts) --
   * a strictly more specific alert than the default RPS_HIT/RPS_REVIEW_REQUIRED
   * or PARTY_RESCREEN_HIT this function would otherwise pick.
   */
  notificationTypeOverride?: ComplianceNotificationType;
  createdByUserId?: string | null;
  requestId?: string;
}

function defaultNotificationType(
  source: RestrictedPartyScreeningInput["source"],
  status: "HIT" | "REVIEW_REQUIRED"
): ComplianceNotificationType {
  if (source === "PARTY_MASTER") return "PARTY_RESCREEN_HIT";
  return status === "HIT" ? "RPS_HIT" : "RPS_REVIEW_REQUIRED";
}

export async function persistScreeningRun(
  input: RestrictedPartyScreeningInput,
  runResult: RestrictedPartyScreeningRunResult,
  options?: PersistScreeningRunOptions
): Promise<PersistedRestrictedPartyResult[]> {
  return db.$transaction(async (tx) => {
    const created: PersistedRestrictedPartyResult[] = [];

    for (const pass of runResult.passes) {
      const row = await tx.restrictedPartyScreeningResult.create({
        data: {
          accountId: input.accountId,
          correlationId: runResult.correlationId,
          source: input.source,
          shipmentId: input.shipmentId ?? null,
          lineItemId: input.lineItemId ?? null,
          partyId: input.partyId ?? null,
          externalReference: input.externalReference ?? null,
          passType: pass.passType,
          screenedName: pass.screenedName,
          normalizedScreenedName: pass.normalizedScreenedName,
          matcherVersion: RPS_MATCHER_VERSION,
          referenceDataAsOf: pass.referenceDataAsOf,
          screenedAddress: pass.screenedAddress,
          screenedCity: pass.screenedCity,
          screenedCountry: pass.screenedCountry,
          nameThreshold: pass.nameThreshold,
          addressThreshold: pass.addressThreshold,
          countryMatchRequired: pass.countryMatchRequired,
          redFlagCheckEnabled: pass.redFlagCheckEnabled,
          excludeMetaphone: pass.excludeMetaphone,
          phoneticAlgorithm: pass.phoneticAlgorithm,
          continueOnExactMatch: pass.continueOnExactMatch,
          exactMatchFound: pass.exactMatchFound,
          alternateScreeningEnabled: pass.alternateScreeningEnabled,
          alternateScreeningRan: pass.alternateScreeningRan,
          alternateScreeningReason: pass.alternateScreeningReason,
          status: pass.status,
          hitCount: pass.matches.filter((m) => !m.suppressedByApprovedParty).length,
          redFlagCount: pass.redFlagHits.length,
          matchesTruncated: pass.matchesTruncated,
          errorCode: pass.errorCode,
          errorMessage: pass.errorMessage,
          screeningInputHash: pass.screeningInputHash,
          screeningDate: input.screeningDate ?? new Date(),
          screeningDurationMs: pass.screeningDurationMs,
          matches: {
            create: pass.matches.map((m) => ({
              sequence: m.sequence,
              screeningEntityId: m.screeningEntityId,
              matchedName: m.matchedName,
              matchedAddress: m.matchedAddress,
              normalizedMatchedName: m.normalizedMatchedName,
              matchedTokens: m.matchedTokens,
              nameScore: m.nameScore,
              addressScore: m.addressScore,
              matchMethod: m.matchMethod,
              countryMatch: m.countryMatch,
              sourceList: m.sourceList,
              entityType: m.entityType,
              programCodes: m.programCodes,
              citation: m.citation,
              agency: m.agency,
              effectiveDate: m.effectiveDate,
              expirationDate: m.expirationDate,
              suppressedByApprovedParty: m.suppressedByApprovedParty,
              suppressingDispositionId: m.suppressingDispositionId,
            })),
          },
          redFlagHits: {
            create: pass.redFlagHits.map((h) => ({
              keywordRuleId: h.keywordRuleId,
              matchedWord: h.matchedWord,
            })),
          },
          ...(pass.status === "HIT" || pass.status === "REVIEW_REQUIRED"
            ? { disposition: { create: { accountId: input.accountId, status: "PENDING" } } }
            : {}),
        },
        include: {
          matches: { include: { screeningEntity: { select: { sourcePublishedAt: true } } } },
          redFlagHits: true,
        },
      });
      created.push(row);

      if (row.status === "HIT" || row.status === "REVIEW_REQUIRED") {
        await evaluateAndQueue(tx, {
          accountId: input.accountId,
          screeningResultId: row.id,
          status: row.status,
          notificationType: options?.notificationTypeOverride ?? defaultNotificationType(input.source, row.status),
          shipmentId: input.shipmentId ?? null,
          partyId: input.partyId ?? null,
          createdByUserId: options?.createdByUserId ?? null,
          requestId: options?.requestId,
        });
      }
    }

    return created;
  });
}
