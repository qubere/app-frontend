// Formal compliance override -- service layer.
//
// A ComplianceFormalOverride is explicitly distinct from a domain reviewer
// disposition (RestrictedPartyDisposition, ClassificationDecision.decisionStatus
// = OVERRIDDEN): it is a separate, reason-mandatory, RBAC-gated decision that
// layers on top of an existing result WITHOUT ever erasing or editing it. It
// must never be reachable from an LLM/agent path -- only from an explicit,
// authenticated, permissioned human action (createFormalOverride requires a
// concrete overriddenByUserId; there is no anonymous/system-initiated path).
import { db } from "@/lib/db";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { logAgentError } from "@/modules/agents/agentLogger";
import type { ComplianceFormalOverride } from "@prisma/client";

export interface CreateFormalOverrideInput {
  accountId: string;
  executionId?: string | null;
  resultRefType: string;
  resultRefId: string;
  originalDecision: string;
  overrideDecision: string;
  reason: string;
  overriddenByUserId: string;
  requestId?: string | null;
}

export class FormalOverrideValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormalOverrideValidationError";
  }
}

/**
 * Creates one immutable ComplianceFormalOverride row. Throws
 * FormalOverrideValidationError (never silently no-ops) when the reason is
 * empty or no human user id is supplied -- this is the one place in the
 * override lifecycle where failing loudly is correct, since a route caller
 * must be able to reject the request with a 400, not silently succeed.
 */
export async function createFormalOverride(
  input: CreateFormalOverrideInput
): Promise<ComplianceFormalOverride> {
  const reason = input.reason?.trim();
  if (!reason) {
    throw new FormalOverrideValidationError("A non-empty reason is required to create a formal override.");
  }
  if (!input.overriddenByUserId?.trim()) {
    throw new FormalOverrideValidationError(
      "A formal override must be created by an authenticated human user -- no LLM/system-initiated path exists."
    );
  }
  if (!input.resultRefType?.trim() || !input.resultRefId?.trim()) {
    throw new FormalOverrideValidationError("resultRefType and resultRefId are required.");
  }

  if (input.executionId) {
    const execution = await db.complianceExecution.findFirst({
      where: { id: input.executionId, accountId: input.accountId },
      select: { id: true },
    });
    if (!execution) {
      throw new FormalOverrideValidationError(`ComplianceExecution '${input.executionId}' not found.`);
    }
  }

  const override = await db.complianceFormalOverride.create({
    data: {
      accountId: input.accountId,
      executionId: input.executionId ?? null,
      resultRefType: input.resultRefType,
      resultRefId: input.resultRefId,
      originalDecision: input.originalDecision,
      overrideDecision: input.overrideDecision,
      reason,
      overriddenByUserId: input.overriddenByUserId,
    },
  });

  // Defense-in-depth traceability -- best-effort, never lets an AuditLog
  // write failure roll back or mask the override itself.
  try {
    await createAuditLog({
      accountId: input.accountId,
      userId: input.overriddenByUserId,
      action: AuditAction.DECISION_OVERRIDDEN,
      entity: "ComplianceFormalOverride",
      entityId: override.id,
      source: "UI",
      requestId: input.requestId ?? null,
      metadata: {
        resultRefType: input.resultRefType,
        resultRefId: input.resultRefId,
        executionId: input.executionId ?? null,
        originalDecision: input.originalDecision,
        overrideDecision: input.overrideDecision,
      },
    });
  } catch (err) {
    logAgentError("Compliance Formal Override", override.id, "createAuditLog (create)", err);
  }

  return override;
}

export interface RevokeFormalOverrideInput {
  id: string;
  accountId: string;
  revokedByUserId: string;
  revokedReason: string;
  requestId?: string | null;
}

/**
 * Sets the revoked fields on an existing ComplianceFormalOverride. Never
 * deletes the row -- immutability of the override history is required even
 * once revoked, so a revoked override remains fully visible/auditable.
 */
export async function revokeFormalOverride(
  input: RevokeFormalOverrideInput
): Promise<ComplianceFormalOverride> {
  const revokedReason = input.revokedReason?.trim();
  if (!revokedReason) {
    throw new FormalOverrideValidationError("A non-empty revokedReason is required to revoke a formal override.");
  }
  if (!input.revokedByUserId?.trim()) {
    throw new FormalOverrideValidationError(
      "A formal override revocation must be performed by an authenticated human user."
    );
  }

  const existing = await db.complianceFormalOverride.findFirst({
    where: { id: input.id, accountId: input.accountId },
  });
  if (!existing) {
    throw new FormalOverrideValidationError(`ComplianceFormalOverride '${input.id}' not found.`);
  }
  if (existing.revokedAt) {
    throw new FormalOverrideValidationError(`ComplianceFormalOverride '${input.id}' is already revoked.`);
  }

  const revoked = await db.complianceFormalOverride.update({
    where: { id: input.id },
    data: {
      revokedByUserId: input.revokedByUserId,
      revokedAt: new Date(),
      revokedReason,
    },
  });

  try {
    await createAuditLog({
      accountId: input.accountId,
      userId: input.revokedByUserId,
      action: AuditAction.DECISION_OVERRIDDEN,
      entity: "ComplianceFormalOverride",
      entityId: revoked.id,
      source: "UI",
      requestId: input.requestId ?? null,
      metadata: {
        revoked: true,
        resultRefType: revoked.resultRefType,
        resultRefId: revoked.resultRefId,
        revokedReason,
      },
    });
  } catch (err) {
    logAgentError("Compliance Formal Override", revoked.id, "createAuditLog (revoke)", err);
  }

  return revoked;
}
