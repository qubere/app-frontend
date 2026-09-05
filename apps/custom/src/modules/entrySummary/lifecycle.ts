/**
 * Audit / filing-state-machine / event-bus wiring for the entry-summary API
 * routes (U14). Kept as a shared helper so the three write routes
 * (generate/approve/export) don't each re-derive the same plumbing.
 *
 * Deviations, documented rather than silently made:
 *  - ShipmentEventBus's ShipmentEventType union has no entry-summary-specific
 *    members. Rather than widen a shared, heavily-consumed union for a single
 *    new feature, this module reuses "USER_FIELD_UPDATED" for
 *    generate/approve (a field on the shipment's filing record changed) and
 *    "FILING_SUBMITTED" for a delivered export (closest existing semantic
 *    match to "this entry summary left the building"). The specific action is
 *    always recorded in the event payload (`entrySummaryAction`) so nothing
 *    is actually lost, only the type discriminator is coarser than ideal.
 *  - The filing state machine transition is skipped entirely (not attempted,
 *    not defaulted) when the shipment has no CustomsFiling row yet, per the
 *    issue's own instruction.
 */

import { createAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { applyTransition, canTransition, type FilingTransition } from "@/modules/filings/filingStateMachine";
import { ShipmentEventBus } from "@/modules/events/shipmentEventBus";
import type { EntrySummaryDraft } from "./model";
import type { ValidationResult } from "./validation/engine";

export interface LifecycleContext {
  accountId: string;
  userId: string;
  shipmentId: string;
  filingId: string | null;
}

async function maybeTransitionFiling(ctx: LifecycleContext, transition: FilingTransition): Promise<string | null> {
  if (!ctx.filingId) return null;
  const filing = await db.customsFiling.findFirst({ where: { id: ctx.filingId, accountId: ctx.accountId }, select: { filingStatus: true } });
  if (!filing) return null;
  if (!canTransition(filing.filingStatus, transition)) return null;
  const next = applyTransition(filing.filingStatus, transition);
  await db.customsFiling.update({ where: { id: ctx.filingId }, data: { filingStatus: next } });
  return next;
}

export async function recordDraftGenerated(
  ctx: LifecycleContext,
  params: { version: number; blockingCount: number; warningCount: number; isExportable: boolean }
): Promise<void> {
  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "entry_summary.draft.generated",
    entity: "EntrySummaryDraft",
    entityId: `${ctx.shipmentId}:v${params.version}`,
    metadata: { shipmentId: ctx.shipmentId, filingId: ctx.filingId, ...params },
  });

  await maybeTransitionFiling(ctx, params.isExportable ? "validate.pass" : "validate.fail");

  await ShipmentEventBus.logEvent({
    shipmentId: ctx.shipmentId,
    accountId: ctx.accountId,
    eventType: "USER_FIELD_UPDATED",
    triggeredBy: ctx.userId,
    payload: { entrySummaryAction: "draft.generated", version: params.version, blockingCount: params.blockingCount },
  });
}

export async function recordDraftApproved(
  ctx: LifecycleContext,
  params: { version: number; draft: EntrySummaryDraft; validation: ValidationResult }
): Promise<void> {
  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "entry_summary.draft.approved",
    entity: "EntrySummaryDraft",
    entityId: `${ctx.shipmentId}:v${params.version}`,
    metadata: { shipmentId: ctx.shipmentId, filingId: ctx.filingId, version: params.version },
  });

  await maybeTransitionFiling(ctx, "broker.approve");

  if (ctx.filingId) {
    const existing = await db.filingSnapshot.findUnique({ where: { filingId: ctx.filingId } });
    const approvedAt = new Date().toISOString();
    const entrySummaryDraft = {
      version: params.version,
      draftData: params.draft as unknown,
      validationData: params.validation as unknown,
      approvedAt,
      approvedBy: ctx.userId,
    };
    if (existing) {
      const snapshotData = { ...(existing.snapshotData as Record<string, unknown>), entrySummaryDraft };
      await db.filingSnapshot.update({ where: { filingId: ctx.filingId }, data: { snapshotData: snapshotData as object } });
    }
    // No `else`: if a filing has never been transmitted, it has no
    // FilingSnapshot row yet, and creating one here would be inventing the
    // other required fields (shipment/lineItems/documents/currency/
    // filingHeader) that FilingService.transmitFiling is responsible for
    // populating for real. The approved draft is still fully durable on
    // EntrySummaryDraft itself either way.
  }

  await ShipmentEventBus.logEvent({
    shipmentId: ctx.shipmentId,
    accountId: ctx.accountId,
    eventType: "USER_FIELD_UPDATED",
    triggeredBy: ctx.userId,
    payload: { entrySummaryAction: "draft.approved", version: params.version },
  });
}

export async function recordExportDispatched(
  ctx: LifecycleContext,
  params: { exportId: string; filerProfileName: string; format: string; delivered: boolean; payloadHash: string }
): Promise<void> {
  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "entry_summary.export.dispatched",
    entity: "FilerExport",
    entityId: params.exportId,
    metadata: {
      shipmentId: ctx.shipmentId,
      filerProfileName: params.filerProfileName,
      format: params.format,
      payloadHash: params.payloadHash,
    },
  });

  if (params.delivered) {
    await maybeTransitionFiling(ctx, "transmit.queue");
    await ShipmentEventBus.logEvent({
      shipmentId: ctx.shipmentId,
      accountId: ctx.accountId,
      eventType: "FILING_SUBMITTED",
      triggeredBy: ctx.userId,
      payload: { entrySummaryAction: "export.delivered", exportId: params.exportId, format: params.format },
    });
  }
}

export async function recordExportFailed(
  ctx: LifecycleContext,
  params: { exportId: string; error: string }
): Promise<void> {
  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "entry_summary.export.failed",
    entity: "FilerExport",
    entityId: params.exportId,
    success: false,
    metadata: { shipmentId: ctx.shipmentId, error: params.error },
  });
}
