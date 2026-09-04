import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";
import { createAuditLog } from "@qubere/decisions";
import { evaluateAutonomyPolicy } from "../../autonomy/services/policyEngineService";
import { evaluateCarriersForShipment } from "../../carriers/services/carrierSelectionService";
import { publishTransportationEvent } from "../../events/services/eventService";
import { queueTmsMemoryEvent } from "../../../lib/inngest/functions/tmsMemoryExtraction";
import { emitTmsBillingEvent } from "../../../lib/billingTelemetry";

const MAX_CASCADE_ATTEMPTS = 5;

export interface CreateTenderInput {
  shipmentId?: string;
  freightQuoteId?: string;
  carrierId: string;
  idempotencyKey?: string;
  cascadeAttempt?: number;
  selectionEvidence?: Record<string, unknown>;
}

export interface RespondTenderInput {
  tenderId: string;
  accept: boolean;
  rejectionReason?: string;
}

function systemContext(accountId: string): AccountContext {
  return {
    accountId,
    userId: "system_cron",
    actorUserId: "system_cron",
    effectiveUserId: "system_cron",
    clerkUserId: "system_cron",
    email: "system@qubere.internal",
    isImpersonating: false,
    isPlatformAdmin: false,
    platformRoles: [],
    accountName: "System",
    accountSlug: "system",
    accountType: "ENTERPRISE",
    dataMode: "LIVE",
    membershipId: "system",
    roleIds: [],
    roleNames: [],
    permissions: [],
    authorizedClientIds: [],
    isAllClients: true,
    memberships: [],
    account: {
      id: accountId,
      name: "System",
      slug: "system",
      type: "ENTERPRISE",
      status: "ACTIVE",
      createdAt: new Date(0),
    },
  };
}

async function validateTenderReferences(ctx: AccountContext, input: CreateTenderInput) {
  const [shipment, carrier, quote] = await Promise.all([
    input.shipmentId
      ? db.shipment.findFirst({
          where: { id: input.shipmentId, accountId: ctx.accountId, deletedAt: null },
          select: { id: true, transportMode: true },
        })
      : Promise.resolve(null),
    db.carrier.findFirst({
      where: { id: input.carrierId, accountId: ctx.accountId },
      select: { id: true, status: true, insuranceOnFile: true },
    }),
    input.freightQuoteId
      ? db.freightQuote.findFirst({
          where: { id: input.freightQuoteId, accountId: ctx.accountId },
          select: { id: true, shipmentId: true, carrierId: true, approvalState: true, validUntil: true },
        })
      : Promise.resolve(null),
  ]);

  if (input.shipmentId && !shipment) throw new Error("Shipment not found in this account.");
  if (!carrier || carrier.status !== "ACTIVE") throw new Error("Carrier is not active in this account.");
  if (!carrier.insuranceOnFile) throw new Error("Carrier insurance has not been verified.");
  if (input.freightQuoteId && !quote) throw new Error("Freight quote not found in this account.");
  if (
    quote &&
    quote.approvalState !== "AUTO_APPROVED" &&
    quote.approvalState !== "APPROVED"
  ) {
    throw new Error("Freight quote must be approved before tendering.");
  }
  if (quote?.validUntil && quote.validUntil < new Date()) throw new Error("Freight quote has expired.");
  if (quote?.shipmentId && input.shipmentId && quote.shipmentId !== input.shipmentId) {
    throw new Error("Freight quote does not belong to the requested shipment.");
  }
  if (quote?.carrierId && quote.carrierId !== input.carrierId) {
    throw new Error("Freight quote belongs to a different carrier.");
  }

  return { shipment, carrier, quote };
}

/**
 * Creates a tender proposal. A DRAFT is deliberately not marked SENT: only a
 * carrier-provider acknowledgement may make that transition.
 */
export async function createTenderDraft(ctx: AccountContext, input: CreateTenderInput) {
  await validateTenderReferences(ctx, input);

  if (input.idempotencyKey) {
    const existingTender = await db.tender.findFirst({
      where: { accountId: ctx.accountId, idempotencyKey: input.idempotencyKey },
    });
    if (existingTender) return { tender: existingTender, wasIdempotent: true, dispatched: false };
  }

  let tender;
  try {
    tender = await db.tender.create({
      data: {
        accountId: ctx.accountId,
        shipmentId: input.shipmentId ?? null,
        freightQuoteId: input.freightQuoteId ?? null,
        carrierId: input.carrierId,
        status: "DRAFT",
        idempotencyKey: input.idempotencyKey ?? null,
        cascadeAttempt: input.cascadeAttempt ?? 0,
        sentByUserId: ctx.userId,
        history: [
          {
            status: "DRAFT",
            timestamp: new Date().toISOString(),
            byUserId: ctx.userId,
            reason: "Tender proposed; awaiting provider delivery",
          },
        ],
      },
    });
  } catch (error) {
    const isUniqueConflict =
      !!input.idempotencyKey &&
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002";
    if (!isUniqueConflict) throw error;

    const concurrentTender = await db.tender.findFirst({
      where: { accountId: ctx.accountId, idempotencyKey: input.idempotencyKey },
    });
    if (!concurrentTender) throw error;
    return { tender: concurrentTender, wasIdempotent: true, dispatched: false };
  }

  const decision = await db.agentDecision.create({
    data: {
      accountId: ctx.accountId,
      shipmentId: input.shipmentId ?? null,
      agentName: "Tender Dispatch Agent",
      decisionSummary: `Tender draft proposed for carrier ${input.carrierId}; no carrier message has been sent.`,
      confidence: 90,
      triageState: "NEEDS_HUMAN_REVIEW",
      autoApproved: false,
      status: "Review Required",
      evidenceItems: input.selectionEvidence
        ? [{
            field: "carrierSelection",
            extractedValue: input.carrierId,
            sourceSpan: "Carrier ranking, policy gate, and account operating memory",
            confidence: 95,
            details: input.selectionEvidence,
          }] as any
        : undefined,
    },
  });

  const linkedTender = await db.tender.update({
    where: { id: tender.id },
    data: { agentDecisionId: decision.id },
  });

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "TENDER_DRAFT_CREATED",
    entity: "Tender",
    entityId: tender.id,
    source: "SYSTEM",
    metadata: { carrierId: input.carrierId, idempotencyKey: input.idempotencyKey ?? null },
  });

  await publishTransportationEvent(ctx, {
    entityType: "TENDER",
    entityId: tender.id,
    shipmentId: input.shipmentId ?? null,
    eventType: "TENDER_DRAFTED",
    source: "SYSTEM",
    payload: { tenderId: tender.id, carrierId: input.carrierId, dispatched: false },
  });

  return { tender: linkedTender, wasIdempotent: false, dispatched: false };
}

/** @deprecated Use createTenderDraft. Kept as a compatibility adapter. */
export const createAndSendTender = createTenderDraft;

/** Provider callback boundary: only a confirmed carrier delivery can move a
 * draft to SENT and create billable dispatch telemetry. */
export async function markTenderDispatched(ctx: AccountContext, tenderId: string, providerMessageId: string) {
  if (!providerMessageId.trim()) throw new Error("Provider message id is required");
  const tender = await db.tender.findFirst({ where: { id: tenderId, accountId: ctx.accountId } });
  if (!tender) throw new Error("Tender not found in this account.");
  if (tender.status === "SENT") return tender;
  if (tender.status !== "DRAFT") throw new Error(`Cannot dispatch tender in status '${tender.status}'.`);

  const now = new Date();
  const history = Array.isArray(tender.history) ? tender.history : [];
  const updated = await db.tender.update({
    where: { id: tender.id },
    data: {
      status: "SENT",
      sentAt: now,
      history: [...history, { status: "SENT", timestamp: now.toISOString(), providerMessageId }],
    },
  });
  if (tender.shipmentId) {
    await emitTmsBillingEvent({
      accountId: ctx.accountId,
      shipmentId: tender.shipmentId,
      eventCode: "TMS_TENDER_DISPATCHED",
      idempotencyKey: `billing:tms:tender:${tender.id}`,
      sourceFunction: "markTenderDispatched",
      sourceAgent: "Tender Dispatch Agent",
      metadata: { tenderId: tender.id, carrierId: tender.carrierId, providerMessageId },
    });
  }
  return updated;
}

export async function respondToTender(ctx: AccountContext, input: RespondTenderInput) {
  const tender = await db.tender.findFirst({
    where: { accountId: ctx.accountId, id: input.tenderId },
  });

  if (!tender) throw new Error(`Tender ${input.tenderId} not found.`);
  if (tender.status !== "SENT") throw new Error(`Cannot respond to tender in status '${tender.status}'.`);
  if (tender.expiresAt && tender.expiresAt <= new Date()) {
    throw new Error(`Tender ${input.tenderId} has expired.`);
  }
  if (!input.accept && !input.rejectionReason?.trim()) {
    throw new Error("A rejection reason is required.");
  }

  const now = new Date();
  const status = input.accept ? "ACCEPTED" : "REJECTED";
  const history = Array.isArray(tender.history) ? tender.history : [];

  const updatedTender = await db.$transaction(async (tx) => {
    const transition = await tx.tender.updateMany({
      where: { id: tender.id, accountId: ctx.accountId, status: "SENT" },
      data: {
        status,
        respondedAt: now,
        history: [
          ...history,
          { status, timestamp: now.toISOString(), rejectionReason: input.rejectionReason ?? null },
        ],
      },
    });
    if (transition.count !== 1) throw new Error("Tender was changed by another request.");

    if (input.accept && tender.shipmentId) {
      await tx.tender.updateMany({
        where: {
          accountId: ctx.accountId,
          shipmentId: tender.shipmentId,
          id: { not: tender.id },
          status: { in: ["DRAFT", "SENT"] },
        },
        data: { status: "CANCELLED" },
      });
    }

    return tx.tender.findUniqueOrThrow({ where: { id: tender.id } });
  });

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: input.accept ? "TENDER_ACCEPTED" : "TENDER_REJECTED",
    entity: "Tender",
    entityId: tender.id,
    source: "API",
    metadata: { rejectionReason: input.rejectionReason ?? null },
  });

  await queueTmsMemoryEvent({
    kind: "TENDER_OUTCOME_RECORDED",
    accountId: ctx.accountId,
    tenderId: tender.id,
  }).catch((error) => console.error("[TMS memory] Failed to enqueue tender outcome", error));

  await publishTransportationEvent(ctx, {
    entityType: "TENDER",
    entityId: tender.id,
    shipmentId: tender.shipmentId,
    eventType: input.accept ? "TENDER_ACCEPTED" : "TENDER_REJECTED",
    source: "API",
    payload: { tenderId: tender.id, carrierId: tender.carrierId, rejectionReason: input.rejectionReason ?? null },
  });

  if (!input.accept) await triggerFallbackCascade(ctx, updatedTender);
  return updatedTender;
}

export async function sweepExpiredTenders(callerCtx?: AccountContext) {
  const now = new Date();
  const expiredTenders = await db.tender.findMany({
    where: {
      status: "SENT",
      expiresAt: { lt: now },
      ...(callerCtx ? { accountId: callerCtx.accountId } : {}),
    },
    select: {
      id: true,
      accountId: true,
      shipmentId: true,
      carrierId: true,
      freightQuoteId: true,
      history: true,
      cascadeAttempt: true,
    },
  });

  let expiredCount = 0;
  for (const tender of expiredTenders) {
    const ctx = callerCtx ?? systemContext(tender.accountId);
    const existingHistory = Array.isArray(tender.history) ? tender.history : [];
    const transition = await db.tender.updateMany({
      where: { id: tender.id, accountId: tender.accountId, status: "SENT" },
      data: {
        status: "EXPIRED",
        history: [
          ...existingHistory,
          { status: "EXPIRED", timestamp: now.toISOString(), reason: "Tender response timeout" },
        ],
      },
    });
    if (transition.count !== 1) continue;

    await queueTmsMemoryEvent({
      kind: "TENDER_OUTCOME_RECORDED",
      accountId: tender.accountId,
      tenderId: tender.id,
    }).catch((error) => console.error("[TMS memory] Failed to enqueue tender expiry", error));

    await createAuditLog({
      accountId: tender.accountId,
      userId: "system_cron",
      action: "TENDER_EXPIRED",
      entity: "Tender",
      entityId: tender.id,
      source: "SYSTEM",
      metadata: { carrierId: tender.carrierId, expiredAt: now },
    });
    await publishTransportationEvent(ctx, {
      entityType: "TENDER",
      entityId: tender.id,
      shipmentId: tender.shipmentId,
      eventType: "TENDER_EXPIRED",
      source: "SYSTEM",
      payload: { tenderId: tender.id, carrierId: tender.carrierId },
    });
    await triggerFallbackCascade(ctx, tender);
    expiredCount++;
  }

  return { expiredCount };
}

export async function triggerFallbackCascade(
  ctx: AccountContext,
  failedTender: {
    id: string;
    accountId: string;
    carrierId: string | null;
    shipmentId?: string | null;
    freightQuoteId?: string | null;
    cascadeAttempt?: number | null;
  }
) {
  if (failedTender.accountId !== ctx.accountId) throw new Error("Tender does not belong to this account.");
  if (!failedTender.shipmentId) return null;

  const cascadeAttempt = (failedTender.cascadeAttempt ?? 0) + 1;
  if (cascadeAttempt > MAX_CASCADE_ATTEMPTS) {
    return createCarrierException(ctx, failedTender.shipmentId, "Maximum carrier fallback attempts reached.");
  }

  const shipment = await db.shipment.findFirst({
    where: { id: failedTender.shipmentId, accountId: ctx.accountId, deletedAt: null },
    select: { transportMode: true },
  });
  const mode = shipment?.transportMode?.trim();
  if (!mode) return createCarrierException(ctx, failedTender.shipmentId, "Shipment transport mode is missing.");

  const rejected = await db.tender.findMany({
    where: {
      accountId: ctx.accountId,
      shipmentId: failedTender.shipmentId,
      status: { in: ["REJECTED", "EXPIRED"] },
    },
    select: { carrierId: true },
  });
  const excludedCarrierIds = Array.from(
    new Set([failedTender.carrierId, ...rejected.map((item) => item.carrierId)].filter(Boolean) as string[])
  );

  const rankedCarriers = await evaluateCarriersForShipment(ctx, {
    mode,
    requireInsurance: true,
    requireSafetyCheck: true,
    shipmentId: failedTender.shipmentId,
    excludeCarrierIds: excludedCarrierIds,
  });
  const nextCarrier = rankedCarriers.find((carrier) => carrier.isEligible);
  if (!nextCarrier) {
    return createCarrierException(ctx, failedTender.shipmentId, "No verified eligible fallback carrier is available.");
  }

  const policy = await evaluateAutonomyPolicy(
    ctx,
    {
      actionType: "AUTO_TENDER",
      confidenceScore: Math.round(nextCarrier.score),
      requiredInputsPresent: true,
      dataFresh: true,
      reversible: true,
      carrierApproved: true,
      insuranceValid: nextCarrier.hasInsurance,
    },
    "Tender Dispatch Agent"
  );
  if (!policy.allowed) {
    return createCarrierException(
      ctx,
      failedTender.shipmentId,
      `Fallback recommendation requires review: ${policy.reason ?? "policy blocked"}.`
    );
  }

  const result = await createTenderDraft(ctx, {
    shipmentId: failedTender.shipmentId,
    freightQuoteId: failedTender.freightQuoteId ?? undefined,
    carrierId: nextCarrier.carrierId,
    idempotencyKey: `fallback-${failedTender.id}-${cascadeAttempt}`,
    cascadeAttempt,
    selectionEvidence: {
      carrierName: nextCarrier.carrierName,
      score: nextCarrier.score,
      scoreBreakdown: nextCarrier.scoreBreakdown,
      memoryAdjustment: nextCarrier.scoreBreakdown.accountMemory,
    },
  });

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "TENDER_FALLBACK_DRAFTED",
    entity: "Tender",
    entityId: result.tender.id,
    source: "SYSTEM",
    metadata: { failedTenderId: failedTender.id, fallbackCarrierId: nextCarrier.carrierId, cascadeAttempt },
  });
  return result.tender;
}

async function createCarrierException(ctx: AccountContext, shipmentId: string, description: string) {
  const code = `TENDER_CARRIER_REQUIRED:${shipmentId}`;
  const existing = await db.exceptionItem.findFirst({
    where: { accountId: ctx.accountId, shipmentId, code, status: { in: ["Open", "OPEN"] } },
  });
  if (existing) return existing;

  return db.exceptionItem.create({
    data: {
      accountId: ctx.accountId,
      shipmentId,
      code,
      type: "NO_CARRIER_AVAILABLE",
      category: "TRANSPORTATION",
      severity: "Critical",
      description,
      requiredAction: "Review carrier eligibility and send a tender manually through a configured provider.",
      blocking: true,
      status: "Open",
      sourceAgent: "Tender Dispatch Agent",
    },
  });
}

export async function autoDispatchTender(
  ctx: AccountContext,
  shipmentId: string,
  options: { mode?: string; equipment?: string; freightQuoteId?: string } = {}
) {
  const shipment = await db.shipment.findFirst({
    where: { id: shipmentId, accountId: ctx.accountId, deletedAt: null },
    select: { id: true, transportMode: true },
  });
  if (!shipment) return { dispatched: false, reason: "Shipment not found in this account." };

  const mode = options.mode?.trim() || shipment.transportMode?.trim();
  if (!mode) return { dispatched: false, reason: "Shipment transport mode is required." };

  const rankedCarriers = await evaluateCarriersForShipment(ctx, {
    mode,
    equipment: options.equipment,
    requireInsurance: true,
    requireSafetyCheck: true,
    shipmentId,
  });
  const topCarrier = rankedCarriers.find((carrier) => carrier.isEligible);
  if (!topCarrier) return { dispatched: false, reason: "No verified eligible carriers found." };

  const policyResult = await evaluateAutonomyPolicy(
    ctx,
    {
      actionType: "AUTO_TENDER",
      confidenceScore: Math.round(topCarrier.score),
      requiredInputsPresent: true,
      dataFresh: true,
      reversible: true,
      carrierApproved: true,
      insuranceValid: topCarrier.hasInsurance,
    },
    "Tender Dispatch Agent"
  );
  if (!policyResult.allowed) {
    const decision = await db.agentDecision.create({
      data: {
        accountId: ctx.accountId,
        shipmentId,
        agentName: "Tender Dispatch Agent",
        decisionSummary: `Auto-tender blocked by policy: ${policyResult.reason ?? "review required"}.`,
        confidence: Math.round(topCarrier.score),
        triageState: "NEEDS_HUMAN_REVIEW",
        autoApproved: false,
        status: "Review Required",
        blockedReason: policyResult.reason,
      },
    });
    return { dispatched: false, decision, carrier: topCarrier, reason: policyResult.reason };
  }

  const result = await createTenderDraft(ctx, {
    shipmentId,
    freightQuoteId: options.freightQuoteId,
    carrierId: topCarrier.carrierId,
    idempotencyKey: `auto-${shipmentId}-${topCarrier.carrierId}`,
    selectionEvidence: {
      carrierName: topCarrier.carrierName,
      score: topCarrier.score,
      scoreBreakdown: topCarrier.scoreBreakdown,
      memoryAdjustment: topCarrier.scoreBreakdown.accountMemory,
    },
  });

  return {
    dispatched: false,
    tender: result.tender,
    carrier: topCarrier,
    reason: "Tender draft created. Carrier delivery is not configured, so no tender was sent.",
  };
}
