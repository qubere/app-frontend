// Restricted / Denied-Party Screening -- Party-level Pre-Approval gate.
//
// A PartyScreeningApproval is a reviewer-granted permission to reuse a
// Party's already-satisfied screening obligation -- for the exact approved
// identity snapshot (partyVersion + screeningInputHash) only -- instead of
// re-running the local matcher, in eligible reuse contexts only.
//
// Deliberately distinct from RestrictedPartyDisposition (a reviewer's
// judgment about ONE candidate match; see suppression.ts): the two must
// never be conflated or auto-derived from one another.
//
// Fail-closed throughout: any lookup/validation error, or any unmet
// condition, resolves to "not applied -- run normal RPS." An approval is
// never implicitly granted, and forceRescreen always bypasses this gate
// (with the bypass itself audited).
import { db } from "@/lib/db";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { computeIdentityHash, loadCurrentIdentity } from "./partyIdentity";
import { getLatestReferenceDataPublishedAt, hasNewerPublishedReferenceData } from "./restrictedPartyRepository";
import type { RestrictedPartyScreeningSource } from "./types";

/**
 * Screening contexts where pre-approval reuse may ever apply. PARTY_MASTER
 * (create/update/manual rescreen) is deliberately excluded -- a brand-new or
 * edited party must always run full RPS. LINE/PUBLIC_API/COPILOT are not
 * wired for reuse today (line-level RPS is unwired, the public API must stay
 * always-fresh absent an explicit account policy, and Copilot must never
 * infer/bypass on its own) -- NOT_APPLICABLE rather than force-fit.
 */
const REUSE_ELIGIBLE_SOURCES: ReadonlySet<RestrictedPartyScreeningSource> = new Set([
  "SHIPMENT",
  "COMMUNITY_SCREENING",
]);

export interface PreApprovalGateResult {
  applied: boolean;
  reason: string;
  /** Set whenever a PRE_APPROVED approval row was found and evaluated -- including when it turned out invalid/stale -- so callers can label *which* approval a negative reason refers to. Only ever absent when no approval row was found at all (or the eligibility/forceRescreen checks short-circuited before any lookup). */
  approvalId?: string;
}

export interface CheckPreApprovalGateParams {
  accountId: string;
  partyId: string | null | undefined;
  source: RestrictedPartyScreeningSource;
  forceRescreen?: boolean;
  userId?: string | null;
  requestId?: string;
  /**
   * Whether a successful reuse or a failed lookup gets written to AuditLog.
   * Defaults to true -- every real screening call site (shipment/line reuse)
   * must audit what actually happened. Pass false only for read-only status
   * checks (e.g. rendering a "is this still valid" badge, or answering a
   * Copilot question) where no screening obligation is actually being
   * satisfied by this call -- such a check must not be recorded as if a
   * reuse occurred.
   */
  audit?: boolean;
}

/** The gate itself. Called from shared RPS orchestration only -- never from a separate matcher. */
export async function checkPreApprovalGate(params: CheckPreApprovalGateParams): Promise<PreApprovalGateResult> {
  const { accountId, partyId, source, forceRescreen, userId, requestId, audit = true } = params;

  if (forceRescreen) {
    if (partyId && audit) {
      await createAuditLog({
        accountId,
        userId: userId ?? null,
        action: AuditAction.PARTY_SCREENING_PRE_APPROVAL_BYPASSED_FORCE_RESCREEN,
        entity: "Party",
        entityId: partyId,
        source: "SYSTEM",
        metadata: { screeningSource: source },
        requestId,
      });
    }
    return { applied: false, reason: "forceRescreen requested; pre-approval bypassed and normal screening will run." };
  }

  if (!partyId) return { applied: false, reason: "No partyId to check for pre-approval." };
  if (!REUSE_ELIGIBLE_SOURCES.has(source)) {
    return { applied: false, reason: `Screening source ${source} is not eligible for pre-approval reuse.` };
  }

  try {
    const approval = await db.partyScreeningApproval.findFirst({
      where: { accountId, partyId, status: "PRE_APPROVED" },
      orderBy: { approvedAt: "desc" },
    });
    if (!approval) return { applied: false, reason: "No active pre-approval exists for this party." };
    if (approval.revokedAt) return { applied: false, reason: "Pre-approval has been revoked.", approvalId: approval.id };
    if (approval.expiresAt && approval.expiresAt.getTime() <= Date.now()) {
      return { applied: false, reason: "Pre-approval has expired.", approvalId: approval.id };
    }

    const party = await db.party.findFirst({ where: { id: partyId, accountId }, select: { currentVersion: true } });
    if (!party) return { applied: false, reason: "Party not found for this account.", approvalId: approval.id };
    if (party.currentVersion !== approval.partyVersion) {
      return {
        applied: false,
        reason: "Party has changed since pre-approval was granted (version mismatch).",
        approvalId: approval.id,
      };
    }

    const identity = await loadCurrentIdentity(db, accountId, partyId);
    if (!identity) {
      return {
        applied: false,
        reason: "Party has no active identity to compare against pre-approval.",
        approvalId: approval.id,
      };
    }
    if (computeIdentityHash(identity) !== approval.screeningInputHash) {
      return {
        applied: false,
        reason: "Party identity has changed since pre-approval was granted (identity-hash mismatch).",
        approvalId: approval.id,
      };
    }

    if (approval.referenceDataAsOf && (await hasNewerPublishedReferenceData(approval.referenceDataAsOf))) {
      return {
        applied: false,
        reason: "Reference watchlist data has been updated since pre-approval was granted.",
        approvalId: approval.id,
      };
    }

    if (audit) {
      await createAuditLog({
        accountId,
        userId: userId ?? null,
        action: AuditAction.PARTY_SCREENING_PRE_APPROVAL_REUSED,
        entity: "Party",
        entityId: partyId,
        source: "SYSTEM",
        metadata: { approvalId: approval.id, screeningSource: source },
        requestId,
      });
    }

    return { applied: true, reason: "Valid pre-approval found; local matcher reuse applied.", approvalId: approval.id };
  } catch (error) {
    if (audit) {
      try {
        await createAuditLog({
          accountId,
          userId: userId ?? null,
          action: AuditAction.PARTY_SCREENING_PRE_APPROVAL_CHECK_INVALID,
          entity: "Party",
          entityId: partyId,
          source: "SYSTEM",
          metadata: { screeningSource: source, error: error instanceof Error ? error.message : String(error) },
          requestId,
        });
      } catch {
        // Best-effort -- an audit-logging failure must never mask the fail-closed result below.
      }
    }
    return { applied: false, reason: "Pre-approval lookup failed; failing closed to normal screening." };
  }
}

export class PartyNotFoundForApprovalError extends Error {
  constructor(partyId: string) {
    super(`Party ${partyId} was not found for this account.`);
    this.name = "PartyNotFoundForApprovalError";
  }
}

export class PartyHasNoActiveIdentityForApprovalError extends Error {
  constructor(partyId: string) {
    super(`Party ${partyId} has no active identity to approve.`);
    this.name = "PartyHasNoActiveIdentityForApprovalError";
  }
}

export class PreApprovalNotFoundError extends Error {
  constructor(approvalId: string) {
    super(`Pre-approval ${approvalId} was not found for this account.`);
    this.name = "PreApprovalNotFoundError";
  }
}

export interface CreatePreApprovalParams {
  accountId: string;
  partyId: string;
  approvedByUserId: string;
  reason?: string | null;
  expiresAt?: Date | null;
  sourceScreeningResultId?: string | null;
  requestId?: string;
}

/**
 * Grants pre-approval reuse for a Party's *current* identity snapshot.
 * Snapshots partyVersion, the identity hash, and the current reference-data
 * watermark at approval time -- reuse becomes invalid the moment any of
 * those move on (see checkPreApprovalGate). Never rewrites Party Master data.
 */
export async function createPreApproval(params: CreatePreApprovalParams) {
  const { accountId, partyId, approvedByUserId, reason, expiresAt, sourceScreeningResultId, requestId } = params;

  const party = await db.party.findFirst({ where: { id: partyId, accountId }, select: { id: true, currentVersion: true } });
  if (!party) throw new PartyNotFoundForApprovalError(partyId);

  const identity = await loadCurrentIdentity(db, accountId, partyId);
  if (!identity) throw new PartyHasNoActiveIdentityForApprovalError(partyId);

  const screeningInputHash = computeIdentityHash(identity);
  const referenceDataAsOf = await getLatestReferenceDataPublishedAt();

  const approval = await db.partyScreeningApproval.create({
    data: {
      accountId,
      partyId,
      status: "PRE_APPROVED",
      partyVersion: party.currentVersion,
      screeningInputHash,
      sourceScreeningResultId: sourceScreeningResultId ?? null,
      approvedByUserId,
      reason: reason ?? null,
      expiresAt: expiresAt ?? null,
      referenceDataAsOf,
    },
  });

  await createAuditLog({
    accountId,
    userId: approvedByUserId,
    action: AuditAction.PARTY_SCREENING_PRE_APPROVAL_CREATED,
    entity: "Party",
    entityId: partyId,
    source: "UI",
    metadata: { approvalId: approval.id, expiresAt: approval.expiresAt, reason: approval.reason },
    requestId,
  });

  return approval;
}

export interface RevokePreApprovalParams {
  accountId: string;
  approvalId: string;
  revokedByUserId: string;
  reason?: string | null;
  requestId?: string;
}

export async function revokePreApproval(params: RevokePreApprovalParams) {
  const { accountId, approvalId, revokedByUserId, reason, requestId } = params;

  const approval = await db.partyScreeningApproval.findFirst({ where: { id: approvalId, accountId } });
  if (!approval) throw new PreApprovalNotFoundError(approvalId);
  if (approval.status === "REVOKED") return approval;

  const updated = await db.partyScreeningApproval.update({
    where: { id: approvalId },
    data: { status: "REVOKED", revokedByUserId, revokedAt: new Date(), reason: reason ?? approval.reason },
  });

  await createAuditLog({
    accountId,
    userId: revokedByUserId,
    action: AuditAction.PARTY_SCREENING_PRE_APPROVAL_REVOKED,
    entity: "Party",
    entityId: approval.partyId,
    source: "UI",
    metadata: { approvalId: approval.id, reason: reason ?? null },
    requestId,
  });

  return updated;
}
