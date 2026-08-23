import { db } from "@qubere/db";
import { logAuditEvent } from "./audit-service";

export interface ActiveImpersonationContext {
  sessionId: string;
  actorUserId: string;
  actorUserName: string;
  actorEmail: string;
  effectiveUserId: string;
  effectiveUserName: string;
  effectiveEmail: string;
  accountId: string;
  accountName: string;
  reason: string;
  expiresAt: Date;
}

export async function startImpersonationSession(params: {
  actorUserId: string;
  targetAccountId: string;
  targetUserId: string;
  reason: string;
  durationMinutes?: number;
  ipAddress?: string;
  userAgent?: string;
}): Promise<ActiveImpersonationContext> {
  const { actorUserId, targetAccountId, targetUserId, reason, durationMinutes = 60, ipAddress, userAgent } = params;

  if (!reason || reason.trim().length < 5) {
    throw new Error("A valid reason (minimum 5 characters) is required to start impersonation.");
  }

  // 1. Verify actor identity and permissions
  const actor = await db.user.findUnique({
    where: { id: actorUserId },
    include: { platformRoles: { include: { platformRole: true } } },
  });

  if (!actor) {
    throw new Error("Actor user not found.");
  }

  const isPlatformAdmin = actor.platformRoles.some((pr) =>
    ["PLATFORM_ADMIN", "SUPER_ADMIN_READWRITE", "SUPER_ADMIN_WRITE"].includes(pr.platformRole.name)
  );

  if (!isPlatformAdmin) {
    throw new Error("Unauthorized: Only Qubere Super Admin Write users can initiate impersonation.");
  }

  // 2. Verify target user and membership in account
  const targetUser = await db.user.findUnique({
    where: { id: targetUserId },
    include: {
      memberships: {
        where: { accountId: targetAccountId, status: "ACTIVE" },
        include: { account: true },
      },
    },
  });

  if (!targetUser || targetUser.memberships.length === 0) {
    throw new Error("Target user has no active membership in specified organization.");
  }

  const targetAccount = targetUser.memberships[0].account;

  if (!(db as any).impersonationSession?.create) {
    throw new Error("Impersonation database model is not initialized.");
  }

  // 3. Close any active impersonation sessions for this actor
  await (db as any).impersonationSession.updateMany({
    where: { actorUserId, endedAt: null },
    data: { endedAt: new Date() },
  });

  // 4. Create new time-limited session
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  const session = await (db as any).impersonationSession.create({
    data: {
      actorUserId,
      effectiveUserId: targetUserId,
      accountId: targetAccountId,
      reason,
      expiresAt,
    },
  });

  const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
  const targetName = [targetUser.firstName, targetUser.lastName].filter(Boolean).join(" ") || targetUser.email;

  // 5. Audit the impersonation start event
  await logAuditEvent({
    accountId: targetAccountId,
    actorUserId,
    effectiveUserId: targetUserId,
    impersonationSessionId: session.id,
    action: "impersonation.start",
    entity: "ImpersonationSession",
    entityId: session.id,
    resourceType: "User",
    resourceId: targetUserId,
    reason,
    ipAddress,
    userAgent,
    metadata: {
      actorEmail: actor.email,
      targetEmail: targetUser.email,
      durationMinutes,
      expiresAt,
    },
  });

  return {
    sessionId: session.id,
    actorUserId,
    actorUserName: actorName,
    actorEmail: actor.email,
    effectiveUserId: targetUserId,
    effectiveUserName: targetName,
    effectiveEmail: targetUser.email,
    accountId: targetAccountId,
    accountName: targetAccount.name,
    reason,
    expiresAt,
  };
}

export async function endImpersonationSession(params: {
  sessionId?: string;
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<boolean> {
  const { sessionId, actorUserId, ipAddress, userAgent } = params;

  if (!(db as any).impersonationSession?.findFirst) return false;

  const session = await (db as any).impersonationSession.findFirst({
    where: sessionId
      ? { id: sessionId, actorUserId, endedAt: null }
      : { actorUserId, endedAt: null },
  });

  if (!session) return false;

  await (db as any).impersonationSession.update({
    where: { id: session.id },
    data: { endedAt: new Date() },
  });

  await logAuditEvent({
    accountId: session.accountId,
    actorUserId: session.actorUserId,
    effectiveUserId: session.effectiveUserId,
    impersonationSessionId: session.id,
    action: "impersonation.end",
    entity: "ImpersonationSession",
    entityId: session.id,
    reason: "Explicit user exit from impersonation session",
    ipAddress,
    userAgent,
  });

  return true;
}

export async function getActiveImpersonationSession(
  actorUserId: string
): Promise<ActiveImpersonationContext | null> {
  if (!(db as any).impersonationSession?.findFirst) return null;

  const now = new Date();
  const session = await (db as any).impersonationSession.findFirst({
    where: {
      actorUserId,
      endedAt: null,
      expiresAt: { gt: now },
    },
    include: {
      actorUser: true,
      effectiveUser: true,
      account: true,
    },
  });

  if (!session) return null;

  const actorName = [session.actorUser.firstName, session.actorUser.lastName].filter(Boolean).join(" ") || session.actorUser.email;
  const targetName = [session.effectiveUser.firstName, session.effectiveUser.lastName].filter(Boolean).join(" ") || session.effectiveUser.email;

  return {
    sessionId: session.id,
    actorUserId: session.actorUserId,
    actorUserName: actorName,
    actorEmail: session.actorUser.email,
    effectiveUserId: session.effectiveUserId,
    effectiveUserName: targetName,
    effectiveEmail: session.effectiveUser.email,
    accountId: session.accountId,
    accountName: session.account.name,
    reason: session.reason,
    expiresAt: session.expiresAt,
  };
}
