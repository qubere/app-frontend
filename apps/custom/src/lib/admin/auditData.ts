import { db } from "@/lib/db";
import type { AccountContext } from "@/lib/auth";

export interface FormattedAuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata: unknown;
  reason?: string | null;
  createdAt: string;
  userEmail: string | null;
  actorEmail?: string | null;
  effectiveEmail?: string | null;
  formattedActorText: string;
  isImpersonated: boolean;
}

export interface SettingsAuditData {
  auditLogs: FormattedAuditLog[];
}

export async function getSettingsAuditData(ctx: AccountContext): Promise<SettingsAuditData> {
  const auditLogs = await db.auditLog.findMany({
    where: { accountId: ctx.accountId },
    include: {
      user: true,
      actorUser: true,
      effectiveUser: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return {
    auditLogs: auditLogs.map((log) => {
      const effectiveUser = log.effectiveUser || log.user;
      const actorUser = log.actorUser;

      const effectiveText = effectiveUser
        ? [effectiveUser.firstName, effectiveUser.lastName].filter(Boolean).join(" ") || effectiveUser.email
        : "System";

      const actorText = actorUser
        ? [actorUser.firstName, actorUser.lastName].filter(Boolean).join(" ") || actorUser.email
        : null;

      const isImpersonated = Boolean(actorUser && actorUser.id !== effectiveUser?.id);

      const formattedActorText = isImpersonated
        ? `${effectiveText} (impersonated by ${actorText})`
        : effectiveText;

      return {
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        metadata: log.metadata,
        reason: log.reason,
        createdAt: log.createdAt.toISOString(),
        userEmail: effectiveUser?.email ?? null,
        actorEmail: actorUser?.email ?? null,
        effectiveEmail: effectiveUser?.email ?? null,
        formattedActorText,
        isImpersonated,
      };
    }),
  };
}
