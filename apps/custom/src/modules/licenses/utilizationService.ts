// Utilization ledger posting (prompt sections 33-36). LicenseEvent rows are
// immutable and event-sourced; this module is the ONLY writer of
// LicenseEvent/LicenseLine ledger totals so duplicate-detection and
// concurrency control are enforced in exactly one place.
//
// Concurrency: every post runs inside a Serializable transaction and uses
// LicenseLine.version as an optimistic-concurrency token (read-then-CAS
// update), so two concurrent posts against the same line can never silently
// lose an update -- Prisma's Serializable isolation will raise a
// transaction-conflict error on the loser, which callers should retry.
//
// Duplicate detection: the unique constraint on LicenseEvent
// (accountId, licenseLineId, eventType, transactionId, transactionLineId)
// is the source of truth. A caller retrying the same source event (e.g. an
// at-least-once webhook/queue redelivery) gets the original event back
// instead of double-counting.
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { recordUsageEvent } from "@/lib/billing/telemetry";
import { Decimal } from "@/lib/tariff/decimal";
import type { LicenseEventType } from "@prisma/client";

export class LicenseEventConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LicenseEventConflictError";
  }
}

export interface PostLicenseEventInput {
  accountId: string;
  licenseLineId: string;
  eventType: LicenseEventType;
  quantityDelta?: number | string;
  valueDelta?: number | string;
  sourceSystem?: string | null;
  sourceEventId?: string | null;
  transactionId?: string | null;
  transactionLineId?: string | null;
  shipmentId?: string | null;
  reason?: string | null;
  userId?: string | null;
}

/** Which ledger counter an event type increments. RENEWAL/EXPIRATION/UPDATE affect no counter directly. */
function counterFor(eventType: LicenseEventType): "committed" | "shipped" | "none" {
  switch (eventType) {
    case "ORDER_COMMITMENT":
    case "ASSIGNMENT":
      return "committed";
    case "SHIPMENT":
      return "shipped";
    case "RELEASE":
    case "REVERSAL":
      return "committed";
    default:
      return "none";
  }
}

export async function postLicenseEvent(input: PostLicenseEventInput) {
  // Idempotent replay: if this exact source event was already posted, return it as-is.
  const existing = await db.licenseEvent.findFirst({
    where: {
      accountId: input.accountId,
      licenseLineId: input.licenseLineId,
      eventType: input.eventType,
      transactionId: input.transactionId ?? null,
      transactionLineId: input.transactionLineId ?? null,
    },
  });
  if (existing) {
    return { event: existing, deduped: true };
  }

  const quantityDelta = new Decimal(input.quantityDelta ?? 0);
  const valueDelta = new Decimal(input.valueDelta ?? 0);
  const counter = counterFor(input.eventType);
  const isDecrement = input.eventType === "RELEASE" || input.eventType === "REVERSAL";

  const result = await db.$transaction(
    async (tx) => {
      const line = await tx.licenseLine.findFirst({
        where: { id: input.licenseLineId, accountId: input.accountId },
      });
      if (!line) {
        throw new LicenseEventConflictError(`License line ${input.licenseLineId} not found for this account.`);
      }

      const signedQuantity = isDecrement ? quantityDelta.negated() : quantityDelta;
      const signedValue = isDecrement ? valueDelta.negated() : valueDelta;

      const nextCommittedQuantity =
        counter === "committed" ? new Decimal(line.committedQuantity).plus(signedQuantity) : new Decimal(line.committedQuantity);
      const nextCommittedValue =
        counter === "committed" ? new Decimal(line.committedValue).plus(signedValue) : new Decimal(line.committedValue);
      const nextShippedQuantity =
        counter === "shipped" ? new Decimal(line.shippedQuantity).plus(signedQuantity) : new Decimal(line.shippedQuantity);
      const nextShippedValue =
        counter === "shipped" ? new Decimal(line.shippedValue).plus(signedValue) : new Decimal(line.shippedValue);

      const quantityAfter = nextCommittedQuantity.plus(nextShippedQuantity);
      const valueAfter = nextCommittedValue.plus(nextShippedValue);

      // CAS: only update if the version hasn't moved since we read it.
      const updateResult = await tx.licenseLine.updateMany({
        where: { id: line.id, version: line.version },
        data: {
          committedQuantity: nextCommittedQuantity,
          committedValue: nextCommittedValue,
          shippedQuantity: nextShippedQuantity,
          shippedValue: nextShippedValue,
          version: { increment: 1 },
        },
      });
      if (updateResult.count === 0) {
        throw new LicenseEventConflictError(
          `License line ${line.id} was modified concurrently; retry the event post.`
        );
      }

      const event = await tx.licenseEvent.create({
        data: {
          accountId: input.accountId,
          licenseLineId: input.licenseLineId,
          eventType: input.eventType,
          quantityDelta: signedQuantity,
          valueDelta: signedValue,
          sourceSystem: input.sourceSystem ?? null,
          sourceEventId: input.sourceEventId ?? null,
          transactionId: input.transactionId ?? null,
          transactionLineId: input.transactionLineId ?? null,
          shipmentId: input.shipmentId ?? null,
          reason: input.reason ?? null,
          postedByUserId: input.userId ?? null,
          quantityAfter,
          valueAfter,
        },
      });

      return { event, deduped: false };
    },
    { isolationLevel: "Serializable" }
  );

  await createAuditLog({
    accountId: input.accountId,
    userId: input.userId ?? null,
    action: "LICENSE_EVENT_POSTED",
    entity: "LicenseEvent",
    entityId: result.event.id,
    source: "API",
    metadata: { eventType: input.eventType, licenseLineId: input.licenseLineId },
  });

  // Idempotent replays (deduped) already billed on first post -- never double-count.
  if (!result.deduped) {
    try {
      await recordUsageEvent({
        accountId: input.accountId,
        eventCode: "LICENSE_UTILIZATION_EVENT_POSTED",
        quantity: 1,
        unit: "event",
        sourceFunction: "postLicenseEvent",
        userId: input.userId ?? undefined,
        shipmentId: input.shipmentId ?? undefined,
        success: true,
        automated: false,
        idempotencyKey: `billing:license-event:${result.event.id}`,
        metadata: { eventType: input.eventType, licenseLineId: input.licenseLineId },
      });
    } catch (billingError) {
      console.error("Failed to record License Utilization billing usage", billingError);
    }
  }

  return result;
}

export interface PostLicenseAdjustmentInput {
  accountId: string;
  licenseLineId: string;
  adjustmentType: "INCREASE" | "DECREASE" | "CORRECTION" | "OPENING_BALANCE";
  quantityDelta?: number | string;
  valueDelta?: number | string;
  reason: string;
  relatedEventId?: string | null;
  userId?: string | null;
}

/** Manual, reason-required correction to a line's ledger totals (adjustedQuantity/adjustedValue). */
export async function postLicenseAdjustment(input: PostLicenseAdjustmentInput) {
  if (!input.reason?.trim()) {
    throw new Error("A reason is required to post a license adjustment.");
  }

  const quantityDelta = new Decimal(input.quantityDelta ?? 0);
  const valueDelta = new Decimal(input.valueDelta ?? 0);
  const signedQuantity = input.adjustmentType === "DECREASE" ? quantityDelta.negated() : quantityDelta;
  const signedValue = input.adjustmentType === "DECREASE" ? valueDelta.negated() : valueDelta;

  const adjustment = await db.$transaction(
    async (tx) => {
      const line = await tx.licenseLine.findFirst({ where: { id: input.licenseLineId, accountId: input.accountId } });
      if (!line) throw new LicenseEventConflictError(`License line ${input.licenseLineId} not found for this account.`);

      const quantityBefore = new Decimal(line.adjustedQuantity);
      const valueBefore = new Decimal(line.adjustedValue);
      const quantityAfter = quantityBefore.plus(signedQuantity);
      const valueAfter = valueBefore.plus(signedValue);

      const updateResult = await tx.licenseLine.updateMany({
        where: { id: line.id, version: line.version },
        data: { adjustedQuantity: quantityAfter, adjustedValue: valueAfter, version: { increment: 1 } },
      });
      if (updateResult.count === 0) {
        throw new LicenseEventConflictError(`License line ${line.id} was modified concurrently; retry the adjustment.`);
      }

      return tx.licenseAdjustment.create({
        data: {
          accountId: input.accountId,
          licenseLineId: input.licenseLineId,
          adjustmentType: input.adjustmentType,
          quantityDelta: signedQuantity,
          valueDelta: signedValue,
          reason: input.reason,
          relatedEventId: input.relatedEventId ?? null,
          quantityBefore,
          quantityAfter,
          valueBefore,
          valueAfter,
          postedByUserId: input.userId ?? null,
        },
      });
    },
    { isolationLevel: "Serializable" }
  );

  await createAuditLog({
    accountId: input.accountId,
    userId: input.userId ?? null,
    action: "LICENSE_ADJUSTMENT_POSTED",
    entity: "LicenseAdjustment",
    entityId: adjustment.id,
    source: "API",
    metadata: { adjustmentType: input.adjustmentType, licenseLineId: input.licenseLineId },
  });

  return adjustment;
}
