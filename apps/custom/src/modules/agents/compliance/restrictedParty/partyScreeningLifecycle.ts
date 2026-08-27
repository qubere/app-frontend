// Restricted / Denied-Party Screening -- Party Master lifecycle.
//
// rescreenParty resolves the party's current-effective name/address/contact
// (status ACTIVE, primary-then-most-recent -- the same selection pattern
// already used across PartyName/PartyAddress/PartyContact elsewhere), runs
// the name pass and (if a contact exists) a separate contact pass, persists
// both, and upserts PartyScreeningSummary. screeningStatus takes the worse
// of the two pass outcomes (HIT > REVIEW_REQUIRED > PARTIAL > ERROR >
// SKIPPED > CLEAR).
//
// Stale detection is identity-change-driven, not clock-driven: no fixed
// rescreen interval/TTL exists anywhere in this codebase. markStaleIfChanged
// recomputes the input hash and compares it to PartyScreeningSummary --
// a mismatch flips screeningStatus to STALE (an async re-screen is triggered
// on next read/explicit trigger, never forced synchronously into the write
// path that's calling this).
import { db } from "@/lib/db";
import type { RestrictedPartyScreeningStatus as PrismaRPSStatus } from "@prisma/client";
import { runRestrictedPartyScreening } from "./restrictedPartyScreening";
import { persistScreeningRun, type PersistedRestrictedPartyResult } from "./persistResult";
import { computeIdentityHash, loadCurrentIdentity, type Tx } from "./partyIdentity";
import type { RestrictedPartyScreeningOptions, RestrictedPartyScreeningStatus } from "./types";

/** Exported for reuse by the RDPS outcome recorder (modules/compliance/rdps/outcomeRecorder.ts), which needs the exact same worst-of-two-outcomes rollup rescreenParty already uses to decide whether a fresh rescreen is a worsening transition. */
export const STATUS_SEVERITY: Record<RestrictedPartyScreeningStatus, number> = {
  HIT: 5,
  REVIEW_REQUIRED: 4,
  PARTIAL: 3,
  ERROR: 2,
  SKIPPED: 1,
  CLEAR: 0,
};

export function worseStatus(a: RestrictedPartyScreeningStatus, b: RestrictedPartyScreeningStatus): RestrictedPartyScreeningStatus {
  return STATUS_SEVERITY[a] >= STATUS_SEVERITY[b] ? a : b;
}

export class PartyHasNoActiveNameError extends Error {
  constructor(partyId: string) {
    super(`Party ${partyId} has no active name to screen.`);
    this.name = "PartyHasNoActiveNameError";
  }
}

export interface RescreenPartyResult {
  overallStatus: RestrictedPartyScreeningStatus;
  results: PersistedRestrictedPartyResult[];
}

export async function rescreenParty(accountId: string, partyId: string, options?: RestrictedPartyScreeningOptions): Promise<RescreenPartyResult> {
  const identity = await loadCurrentIdentity(db, accountId, partyId);
  if (!identity) throw new PartyHasNoActiveNameError(partyId);

  // PARTY_MASTER is never eligible for pre-approval *reuse* (see
  // REUSE_ELIGIBLE_SOURCES in preApproval.ts), but a party can still have a
  // PRE_APPROVED approval on file from prior shipment/line reuse -- if so, a
  // fresh HIT/REVIEW_REQUIRED here is a PAL re-screen exception, not an
  // ordinary Party Master re-screen exception.
  const activeApproval = await db.partyScreeningApproval.findFirst({
    where: { accountId, partyId, status: "PRE_APPROVED" },
    select: { id: true },
  });

  const input = { accountId, source: "PARTY_MASTER" as const, partyId, identity, ...options };
  const runResult = await runRestrictedPartyScreening(input);
  const persisted = await persistScreeningRun(input, runResult, {
    notificationTypeOverride: activeApproval ? "PAL_RESCREEN_HIT" : undefined,
  });

  const overallStatus = persisted.map((p) => p.status as RestrictedPartyScreeningStatus).reduce(worseStatus, "CLEAR");
  const primaryResult = persisted.find((p) => p.passType === "PARTY_NAME") ?? persisted[0];
  const currentInputHash = computeIdentityHash(identity);

  await db.partyScreeningSummary.upsert({
    where: { partyId },
    create: {
      partyId,
      accountId,
      screeningStatus: overallStatus as PrismaRPSStatus,
      lastScreenedAt: new Date(),
      lastScreeningResultId: primaryResult.id,
      currentInputHash,
    },
    update: {
      screeningStatus: overallStatus as PrismaRPSStatus,
      lastScreenedAt: new Date(),
      lastScreeningResultId: primaryResult.id,
      currentInputHash,
    },
  });

  return { overallStatus, results: persisted };
}

/**
 * Called from identity-fact write paths (PartyName/PartyAddress/PartyContact
 * mutations) inside their own transaction. A no-op when the party has never
 * been screened -- there is nothing to go stale. Best-effort: never throws,
 * so a screening-summary hiccup can't block an unrelated party edit.
 */
export async function markStaleIfChanged(tx: Tx, accountId: string, partyId: string): Promise<void> {
  try {
    const summary = await tx.partyScreeningSummary.findUnique({ where: { partyId } });
    if (!summary || summary.screeningStatus === "STALE") return;

    const identity = await loadCurrentIdentity(tx, accountId, partyId);
    if (!identity) return;

    const freshHash = computeIdentityHash(identity);
    if (freshHash !== summary.currentInputHash) {
      await tx.partyScreeningSummary.update({ where: { partyId }, data: { screeningStatus: "STALE" } });
    }
  } catch {
    // Best-effort -- staleness bookkeeping must never fail the caller's mutation.
  }
}
