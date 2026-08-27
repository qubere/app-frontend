// Continuous Party Monitoring (RDPS) -- recall validation.
//
// This is the release-blocking safety net referenced throughout
// impactAnalysis.ts: the reverse index there is deliberately loose (no
// country gate, both phonetic algorithms always checked) specifically so it
// never *under*-selects relative to the forward matcher -- but "deliberately
// loose" is a design intent, not a guarantee. This module checks that intent
// against reality by replaying a window of reference-data changes through
// BOTH paths and diffing them:
//
//   targeted  = findImpactedParties(entity, index)         (the reverse path RDPS actually runs)
//   ground truth = generateCandidates(party.name, [entity]) (the existing, already-trusted forward matcher)
//
// Any party the forward matcher would have shortlisted but the reverse index
// did not is a silent-recall gap -- exactly the failure mode that makes a
// denied-party screening program worthless. It must never be swallowed.
//
// Ground truth is deliberately never computed by calling findImpactedParties
// a second time -- that would only validate the index against itself.
import { db } from "@/lib/db";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { createExceptionItem } from "@/lib/exceptions/createException";
import { generateCandidates } from "./candidateGeneration";
import { buildPartyIdentityIndex, findImpactedParties, type PartyIdentityIndex } from "./impactAnalysis";
import type { ScreeningEntityWithAddresses } from "./restrictedPartyRepository";

export interface RecallGapDetail {
  partyId: string;
  accountId: string;
  entityId: string;
  entityName: string;
}

export interface RecallValidationResult {
  windowStart: Date;
  windowEnd: Date;
  changedEntityCount: number;
  partyCount: number;
  missedByTargeted: RecallGapDetail[];
  passed: boolean;
}

/**
 * Loads the raw current-effective name for a set of parties -- ground truth
 * needs the actual raw name string (generateCandidates normalizes it itself
 * internally), unlike the reverse index, which only keeps precomputed
 * normalized/phonetic keys.
 */
async function loadPartyRawNames(partyIds: string[]): Promise<Map<string, string>> {
  if (partyIds.length === 0) return new Map();
  const names = await db.partyName.findMany({
    where: { partyId: { in: partyIds }, status: "ACTIVE" },
    orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
    select: { partyId: true, rawName: true },
  });
  const byParty = new Map<string, string>();
  for (const n of names) {
    if (!byParty.has(n.partyId) && n.rawName?.trim()) byParty.set(n.partyId, n.rawName);
  }
  return byParty;
}

/**
 * Ground-truth entity matches for one party's raw name, checked under BOTH
 * phonetic algorithms -- mirrors findImpactedParties' own "don't know which
 * algorithm the account uses" stance, so this stays an apples-to-apples
 * comparison rather than a narrower check that would manufacture false gaps.
 */
function forwardGroundTruthEntityIds(rawName: string, changedEntities: ScreeningEntityWithAddresses[]): Set<string> {
  const entityIds = new Set<string>();
  for (const phoneticAlgorithm of ["DOUBLE_METAPHONE", "METAPHONE2"] as const) {
    const { candidates } = generateCandidates(rawName, changedEntities, { phoneticAlgorithm, continueOnExactMatch: true });
    for (const candidate of candidates) entityIds.add(candidate.entity.id);
  }
  return entityIds;
}

/**
 * Diffs the reverse (targeted) candidate set against the forward (ground
 * truth) one for every changed entity in [windowStart, windowEnd]. When
 * `partyIdSample` is omitted, checks the WHOLE active-party population
 * (exhaustive -- used after every FULL_POPULATION run); pass a bounded
 * sample for the daily scheduled job.
 */
export async function validateRecallForWindow(
  windowStart: Date,
  windowEnd: Date,
  options?: { partyIdSample?: string[] },
): Promise<RecallValidationResult> {
  const changeSets = await db.referenceDataChangeSet.findMany({
    where: { occurredAt: { gte: windowStart, lte: windowEnd } },
    select: { screeningEntityId: true },
    distinct: ["screeningEntityId"],
  });
  const entityIds = changeSets.map((c) => c.screeningEntityId);

  if (entityIds.length === 0) {
    return { windowStart, windowEnd, changedEntityCount: 0, partyCount: 0, missedByTargeted: [], passed: true };
  }

  const changedEntities: ScreeningEntityWithAddresses[] = await db.screeningEntity.findMany({
    where: { id: { in: entityIds } },
    include: { addresses: true, aliases: true },
  });

  const index: PartyIdentityIndex = await buildPartyIdentityIndex();
  const partyIdsToCheck = options?.partyIdSample ?? index.map((entry) => entry.partyId);
  const partyIdsToCheckSet = new Set(partyIdsToCheck);
  const accountByPartyId = new Map(index.map((entry) => [entry.partyId, entry.accountId]));

  // Targeted (reverse) result: entityId -> Set<partyId> impacted, restricted
  // to the population under test.
  const targetedByEntity = new Map<string, Set<string>>();
  const entityNameById = new Map<string, string>();
  for (const entity of changedEntities) {
    entityNameById.set(entity.id, entity.name);
    const matches = findImpactedParties(entity, index).filter((m) => partyIdsToCheckSet.has(m.partyId));
    targetedByEntity.set(
      entity.id,
      new Set(matches.map((m) => m.partyId)),
    );
  }

  const rawNameByPartyId = await loadPartyRawNames(partyIdsToCheck);

  const missedByTargeted: RecallGapDetail[] = [];
  for (const partyId of partyIdsToCheck) {
    const rawName = rawNameByPartyId.get(partyId);
    const accountId = accountByPartyId.get(partyId);
    if (!rawName || !accountId) continue;

    const groundTruthEntityIds = forwardGroundTruthEntityIds(rawName, changedEntities);
    for (const entityId of groundTruthEntityIds) {
      const targetedParties = targetedByEntity.get(entityId);
      if (!targetedParties?.has(partyId)) {
        missedByTargeted.push({ partyId, accountId, entityId, entityName: entityNameById.get(entityId) ?? entityId });
      }
    }
  }

  return {
    windowStart,
    windowEnd,
    changedEntityCount: changedEntities.length,
    partyCount: partyIdsToCheck.length,
    missedByTargeted,
    passed: missedByTargeted.length === 0,
  };
}

/**
 * Records a validation result onto an RdpsRun and, on failure, raises
 * best-effort per-account visibility of the gap.
 *
 * There is no platform-level/tenant-less accountId anywhere in this codebase
 * (ExceptionItem.accountId and CreateAuditLogParams.accountId are both
 * required, non-nullable, real-tenant fields -- confirmed, not assumed) so a
 * single "platform-admin-routed" exception/audit entry as originally
 * envisioned is not representable. RdpsRun.status = FAILED + errorMessage
 * (which needs no accountId) is therefore the primary, always-available
 * failure record and the actual release gate; the createExceptionItem/
 * createAuditLog calls below are best-effort secondary notifications, one
 * per distinct account with a missed party, so affected tenants' compliance
 * teams also see the gap surfaced where they'd look for other RPS exceptions.
 */
export async function recordRecallValidationResult(runId: string, result: RecallValidationResult): Promise<void> {
  if (result.passed) {
    await db.rdpsRun.update({
      where: { id: runId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return;
  }

  const missedPartyIds = Array.from(new Set(result.missedByTargeted.map((m) => m.partyId)));
  const errorMessage = `Recall validation failed for window ${result.windowStart.toISOString()}..${result.windowEnd.toISOString()}: ${result.missedByTargeted.length} targeted-match gap(s) across ${missedPartyIds.length} part${missedPartyIds.length === 1 ? "y" : "ies"}. Missed party IDs: ${missedPartyIds.join(", ")}.`;

  await db.rdpsRun.update({
    where: { id: runId },
    data: { status: "FAILED", completedAt: new Date(), errorMessage },
  });

  const gapsByAccount = new Map<string, RecallGapDetail[]>();
  for (const gap of result.missedByTargeted) {
    const existing = gapsByAccount.get(gap.accountId);
    if (existing) existing.push(gap);
    else gapsByAccount.set(gap.accountId, [gap]);
  }

  for (const [accountId, gaps] of gapsByAccount) {
    const partyIds = Array.from(new Set(gaps.map((g) => g.partyId)));
    try {
      await createExceptionItem({
        accountId,
        category: "COMPLIANCE",
        type: "rdps_recall_gap",
        severity: "Critical",
        description: `RDPS recall validation found ${gaps.length} reference-data match(es) the reverse monitoring index missed for ${partyIds.length} part${partyIds.length === 1 ? "y" : "ies"} in this account (run ${runId}). Affected parties: ${partyIds.join(", ")}.`,
        status: "Open",
      });
    } catch (err) {
      console.error(`[rdps] Failed to create recall-gap exception for account ${accountId}, run ${runId}:`, err);
    }

    try {
      await createAuditLog({
        accountId,
        action: AuditAction.RDPS_RECALL_VALIDATION_FAILED,
        entity: "RdpsRun",
        entityId: runId,
        source: "SYSTEM",
        metadata: { partyIds, gapCount: gaps.length },
      });
    } catch (err) {
      console.error(`[rdps] Failed to write recall-gap audit log for account ${accountId}, run ${runId}:`, err);
    }
  }
}
