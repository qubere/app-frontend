// Canonical License Determination service (prompt section 5) -- the SINGLE
// entry point all callers (API routes, shipment pipeline, Copilot
// explainers) must route through. No caller may compute a determination
// status itself. AI/Copilot integrations may only explain/summarize an
// already-persisted result -- never call this service to have an LLM decide
// the outcome, and never let an LLM shortcut this function.
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { recordUsageEvent } from "@/lib/billing/telemetry";
import { recordComplianceExecution } from "@/modules/compliance/executionHistory";
import { queueLicenseDeterminationReview } from "@/modules/compliance/notifications/licenseNotificationService";
import type { Prisma } from "@prisma/client";
import { resolveLicenseDetermination, type AccountLicenseGates } from "./ruleResolver";
import { applyLicenseExceptionClaim, type LicenseExceptionClaim } from "./exceptionEvaluator";
import type { LicenseControlRuleCandidate, LicenseDeterminationOutcome, LicenseDeterminationRequestInput } from "./types";
import type { LicenseOperationType } from "@prisma/client";

export interface RunLicenseDeterminationOptions {
  exceptionClaim?: LicenseExceptionClaim;
}

export interface LicenseDeterminationRecord {
  id: string;
  outcome: LicenseDeterminationOutcome;
  complianceExecutionId: string | null;
}

async function loadAccountGates(accountId: string): Promise<AccountLicenseGates> {
  const config = await db.accountLicenseConfig.findUnique({ where: { accountId } });
  return {
    licenseDeterminationEnabled: config?.licenseDeterminationEnabled ?? true,
    importControlDeterminationEnabled: config?.importControlDeterminationEnabled ?? false,
    genericExportLicenseDeterminationEnabled: config?.genericExportLicenseDeterminationEnabled ?? true,
  };
}

/** Ships empty today -- this is a cheap no-op query until a real jurisdiction rule dataset is ingested. */
async function loadCandidateRules(operationType: LicenseOperationType): Promise<LicenseControlRuleCandidate[]> {
  const rows = await db.licenseControlRule.findMany({ where: { operationType } });
  return rows.map((row) => ({
    operationType: row.operationType,
    classificationType: row.classificationType,
    classificationValue: row.classificationValue,
    country: row.country,
    decision: row.decision,
    authority: row.authority,
    citation: row.citation,
    ruleVersion: row.ruleVersion,
  }));
}

/**
 * Runs a full License Determination: gates -> classification -> conditions
 * -> generic rule resolution (fail-safe) -> optional explicit license
 * exception claim -> persists LicenseDeterminationResult (base and final
 * decision both preserved) -> records the unified ComplianceExecution audit
 * envelope -> writes an AuditLog entry. Never throws for a business-rule
 * outcome (INCOMPLETE/BLOCKED/etc. are all valid results, not errors); only
 * infrastructure failures (DB down) propagate as exceptions.
 */
export async function runLicenseDetermination(
  input: LicenseDeterminationRequestInput,
  options: RunLicenseDeterminationOptions = {}
): Promise<LicenseDeterminationRecord> {
  const startedAt = new Date();
  const gates = await loadAccountGates(input.accountId);
  const rules = await loadCandidateRules(input.operationType);
  const baseOutcome = resolveLicenseDetermination(input, gates, rules);
  const { outcome, rejectionReason } = applyLicenseExceptionClaim(baseOutcome, options.exceptionClaim);

  const evidence: Record<string, unknown> = {
    ...(outcome.evidence ?? {}),
    ...(rejectionReason ? { exceptionClaimRejected: rejectionReason } : {}),
  };

  const result = await db.licenseDeterminationResult.create({
    data: {
      accountId: input.accountId,
      shipmentId: input.shipmentId ?? null,
      lineItemId: input.lineItemId ?? null,
      productId: input.productId ?? null,
      transactionId: input.transactionId ?? null,
      transactionLineId: input.transactionLineId ?? null,
      operationType: input.operationType,
      complianceCountry: input.complianceCountry ?? null,
      destinationCountry: input.destinationCountry ?? null,
      originCountry: input.originCountry ?? null,
      status: outcome.status,
      baseDecision: outcome.baseDecision,
      finalDecision: outcome.finalDecision,
      exceptionCode: outcome.exceptionCode ?? null,
      exceptionDescription: outcome.exceptionDescription ?? null,
      reason: outcome.reason,
      conditions: (input.conditions as Prisma.InputJsonValue) ?? undefined,
      missingInputs: (outcome.missingInputs as Prisma.InputJsonValue) ?? undefined,
      ruleSource: outcome.ruleSource ?? null,
      ruleVersion: outcome.ruleVersion ?? null,
      evidence: evidence as Prisma.InputJsonValue,
    },
  });

  const completedAt = new Date();
  const complianceExecutionId = await recordComplianceExecution({
    accountId: input.accountId,
    executionType: input.operationType === "IMPORT" ? "IMPORT_CONTROL_DETERMINATION" : "LICENSE_DETERMINATION",
    status: "COMPLETED",
    correlationId: input.correlationId ?? result.id,
    shipmentId: input.shipmentId ?? null,
    lineItemId: input.lineItemId ?? null,
    productId: input.productId ?? null,
    countryRole: input.operationType === "IMPORT" ? "originCountry" : "destinationCountry",
    countryChecked: input.operationType === "IMPORT" ? input.originCountry ?? null : input.destinationCountry ?? null,
    source: (input.source as "UI" | "API" | "SYSTEM" | undefined) ?? "API",
    initiatedByUserId: input.userId ?? null,
    requestSnapshot: { operationType: input.operationType, classification: input.classification, conditions: input.conditions },
    responseSnapshot: { status: outcome.status, baseDecision: outcome.baseDecision, finalDecision: outcome.finalDecision },
    resultRefType: "LicenseDeterminationResult",
    resultRefId: result.id,
    finalStatus: outcome.status,
    finalSummary: outcome.reason,
    rulesetVersion: outcome.ruleVersion ?? null,
    startedAt,
    completedAt,
    durationMs: completedAt.getTime() - startedAt.getTime(),
  });

  if (complianceExecutionId) {
    await db.licenseDeterminationResult.update({
      where: { id: result.id },
      data: { complianceExecutionId },
    });
  }

  await createAuditLog({
    accountId: input.accountId,
    userId: input.userId ?? null,
    action: "LICENSE_DETERMINATION_EXECUTED",
    entity: "LicenseDeterminationResult",
    entityId: result.id,
    source: (input.source as "UI" | "API" | "SYSTEM" | undefined) ?? "API",
    metadata: { status: outcome.status, baseDecision: outcome.baseDecision, finalDecision: outcome.finalDecision },
  });

  try {
    await queueLicenseDeterminationReview(db, {
      accountId: input.accountId,
      licenseDeterminationResultId: result.id,
      status: outcome.status,
      reason: outcome.reason,
      operationType: input.operationType,
      shipmentId: input.shipmentId ?? null,
      productId: input.productId ?? null,
      transactionId: input.transactionId ?? null,
      createdByUserId: input.userId ?? null,
    });
  } catch (notificationError) {
    console.error("Failed to queue License Determination review notification", notificationError);
  }

  try {
    await recordUsageEvent({
      accountId: input.accountId,
      eventCode: "LICENSE_DETERMINATION_COMPLETED",
      quantity: 1,
      unit: "determination",
      sourceFunction: "runLicenseDetermination",
      sourceApi: (input.source as "UI" | "API" | "SYSTEM" | undefined) ?? "API",
      userId: input.userId ?? undefined,
      shipmentId: input.shipmentId ?? undefined,
      success: true,
      automated: true,
      idempotencyKey: `billing:license-determination:${result.id}`,
      metadata: { operationType: input.operationType, status: outcome.status, finalDecision: outcome.finalDecision },
    });
  } catch (billingError) {
    console.error("Failed to record License Determination billing usage", billingError);
  }

  return { id: result.id, outcome, complianceExecutionId };
}

/**
 * Records a reviewer disposition/override on an existing determination.
 * Overrides mutate `reviewerDisposition`/override fields only -- they NEVER
 * touch `baseDecision`, and `finalDecision` is updated on the row only when
 * `newFinalDecision` is explicitly supplied by the caller.
 */
export async function reviewLicenseDetermination(params: {
  accountId: string;
  determinationId: string;
  userId: string;
  disposition: "VERIFIED" | "RETURNED_FOR_INFO" | "OVERRIDDEN";
  reviewReason?: string;
  overrideType?: string;
  overrideReason?: string;
  newFinalDecision?: import("@prisma/client").LicenseDeterminationStatus;
}) {
  const existing = await db.licenseDeterminationResult.findFirst({
    where: { id: params.determinationId, accountId: params.accountId },
  });
  if (!existing) return null;

  const updated = await db.licenseDeterminationResult.update({
    where: { id: params.determinationId },
    data: {
      reviewerDisposition: params.disposition,
      reviewedByUserId: params.userId,
      reviewedAt: new Date(),
      reviewReason: params.reviewReason ?? null,
      ...(params.disposition === "OVERRIDDEN"
        ? {
            overrideType: params.overrideType ?? null,
            overrideReason: params.overrideReason ?? null,
            ...(params.newFinalDecision ? { finalDecision: params.newFinalDecision } : {}),
          }
        : {}),
    },
  });

  await createAuditLog({
    accountId: params.accountId,
    userId: params.userId,
    action: "LICENSE_DETERMINATION_REVIEWED",
    entity: "LicenseDeterminationResult",
    entityId: updated.id,
    source: "UI",
    metadata: { disposition: params.disposition, finalDecision: updated.finalDecision },
    beforeJson: { finalDecision: existing.finalDecision },
    afterJson: { finalDecision: updated.finalDecision },
  });

  return updated;
}
