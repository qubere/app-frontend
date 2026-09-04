// Queues (never sends) a ComplianceNotification for one RPS screening
// result, transactionally alongside the result itself. Sending happens later,
// asynchronously, via ComplianceNotificationDispatcher. This module never
// mutates RestrictedPartyScreeningResult.
import { Prisma, type ComplianceNotificationType, type PrismaClient } from "@prisma/client";
import { createAuditLog, AuditAction } from "@/lib/audit";
import type { RestrictedPartyScreeningStatus } from "@/modules/agents/compliance/restrictedParty/types";
import { shouldSendRpsNotification } from "./eligibility";

export type Tx = Prisma.TransactionClient | PrismaClient;

export interface EvaluateAndQueueParams {
  accountId: string;
  screeningResultId: string;
  status: RestrictedPartyScreeningStatus;
  notificationType: ComplianceNotificationType;
  shipmentId?: string | null;
  partyId?: string | null;
  complianceExecutionId?: string | null;
  createdByUserId?: string | null;
  requestId?: string;
}

/** Idempotent by construction: a second call for the same (screeningResultId, notificationType) collides on the ComplianceNotification unique constraint and is treated as already-queued, not an error. */
export async function evaluateAndQueue(tx: Tx, params: EvaluateAndQueueParams): Promise<void> {
  const {
    accountId,
    screeningResultId,
    status,
    notificationType,
    shipmentId,
    partyId,
    complianceExecutionId,
    createdByUserId,
    requestId,
  } = params;

  const config = await tx.accountScreeningConfig.findUnique({ where: { accountId } });
  const eligibility = shouldSendRpsNotification(config, status, notificationType);

  if (!eligibility.eligible) {
    if (eligibility.reason === "SUPPRESSED") {
      await createAuditLog({
        accountId,
        userId: createdByUserId ?? null,
        action: AuditAction.RPS_NOTIFICATION_SUPPRESSED,
        entity: "RestrictedPartyScreeningResult",
        entityId: screeningResultId,
        source: "SYSTEM",
        metadata: { notificationType, reason: eligibility.reason },
        requestId,
      });
    }
    return;
  }

  try {
    await tx.complianceNotification.create({
      data: {
        accountId,
        notificationType,
        channel: "EMAIL",
        screeningResultId,
        complianceExecutionId: complianceExecutionId ?? null,
        shipmentId: shipmentId ?? null,
        partyId: partyId ?? null,
        recipients: eligibility.recipients,
        deliveryStatus: "PENDING",
        queuedAt: new Date(),
        createdByUserId: createdByUserId ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return; // Already queued for this (screeningResultId, notificationType) -- not an error.
    }
    throw error;
  }

  await createAuditLog({
    accountId,
    userId: createdByUserId ?? null,
    action: AuditAction.RPS_NOTIFICATION_QUEUED,
    entity: "RestrictedPartyScreeningResult",
    entityId: screeningResultId,
    source: "SYSTEM",
    metadata: { notificationType, recipientCount: eligibility.recipients.length },
    requestId,
  });
}
