import { db } from "@qubere/db";

export interface LogAuditEventParams {
  accountId: string;
  userId?: string;
  actorUserId?: string;
  effectiveUserId?: string;
  impersonationSessionId?: string;
  reason?: string;
  action: string;
  entity: string;
  entityId: string;
  resourceType?: string;
  resourceId?: string;
  clientId?: string;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  source?: string;
  metadata?: Record<string, any> | null;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  success?: boolean;
}

export async function logAuditEvent(params: LogAuditEventParams): Promise<void> {
  try {
    const {
      accountId,
      userId,
      actorUserId,
      effectiveUserId,
      impersonationSessionId,
      reason,
      action,
      entity,
      entityId,
      resourceType,
      resourceId,
      clientId,
      oldValue,
      newValue,
      source = "UI",
      metadata,
      ipAddress,
      userAgent,
      requestId,
      success = true,
    } = params;

    // Default primary userId to effectiveUserId or userId if available
    const primaryUserId = effectiveUserId || userId || actorUserId || null;

    await db.auditLog.create({
      data: {
        accountId,
        userId: primaryUserId,
        actorUserId: actorUserId || null,
        effectiveUserId: effectiveUserId || primaryUserId,
        impersonationSessionId: impersonationSessionId || null,
        reason: reason || null,
        action,
        entity,
        entityId,
        resourceType: resourceType || entity,
        resourceId: resourceId || entityId,
        clientId: clientId || null,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : undefined,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : undefined,
        source,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        requestId: requestId || null,
        success,
      },
    });
  } catch (error) {
    // Audit logging should fail closed for error logging, but avoid crashing critical business operations
    console.error("Failed to write immutable audit log entry:", error);
  }
}
