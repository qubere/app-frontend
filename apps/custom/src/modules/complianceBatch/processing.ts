// Bulk Compliance Screening -- per-record processing. Calls only the
// *canonical* RPS and License Determination services (never reimplements
// matching/rule logic) -- mirrors communityScreening/evaluator.ts. A
// per-record exception is caught and recorded as a technical ERROR; it
// never throws out to the dispatcher so one bad record never fails the
// whole batch (prompt section 22, CONTINUE_VALID_RECORDS).
import { db } from "@/lib/db";
import type { BatchRecord } from "@prisma/client";
import { runRestrictedPartyScreening } from "@/modules/agents/compliance/restrictedParty/restrictedPartyScreening";
import { persistScreeningRun } from "@/modules/agents/compliance/restrictedParty/persistResult";
import type { RestrictedPartyScreeningInput } from "@/modules/agents/compliance/restrictedParty/types";
import { runLicenseDetermination } from "@/modules/licenses/determinationService";
import { getAccountEmbargoConfig } from "@/modules/agents/compliance/embargo/embargoRepository";
import { doEmbargoCheck } from "@/modules/agents/compliance/embargo/doEmbargoCheck";
import type { EmbargoCheckContext } from "@/modules/agents/compliance/embargo/types";
import { ClassificationService } from "@/modules/classification/classification.service";
import { recordComplianceExecution } from "@/modules/compliance/executionHistory";
import { recordUsageEvent } from "@/lib/billing/telemetry";
import type { Prisma } from "@prisma/client";
import {
  createPreApproval,
  PartyNotFoundForApprovalError,
  PartyHasNoActiveIdentityForApprovalError,
} from "@/modules/agents/compliance/restrictedParty/preApproval";
import { aggregateRecordComplianceStatus, type ServiceOutcome } from "./aggregation";
import type { CanonicalComplianceRequest, PreApprovedPartyImportRow } from "./types";

/** PRE_APPROVED_PARTY_IMPORT rows never touch RPS/License/Embargo/Classification -- each one is just a call to the same createPreApproval() the one-at-a-time API uses (see preApproval.ts), so partyId existence/identity/reference-data checks all happen there, not here. */
async function processPreApprovedPartyImportRecord(
  accountId: string,
  record: BatchRecord,
  batchCreatedByUserId: string | null
): Promise<void> {
  const input = record.normalizedInput as unknown as PreApprovedPartyImportRow;
  let complianceStatus: "PASSED" | "FAILED" | "ERROR" = "PASSED";
  let errorCode: string | null = null;
  let errorMessage: string | null = null;

  try {
    await createPreApproval({
      accountId,
      partyId: input.partyId,
      approvedByUserId: batchCreatedByUserId ?? "system",
      reason: input.reason,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      requestId: record.correlationId,
    });
  } catch (err) {
    if (err instanceof PartyNotFoundForApprovalError || err instanceof PartyHasNoActiveIdentityForApprovalError) {
      complianceStatus = "FAILED";
      errorCode = err.name;
      errorMessage = err.message;
    } else {
      complianceStatus = "ERROR";
      errorCode = "PROCESSING_ERROR";
      errorMessage = err instanceof Error ? err.message : String(err);
    }
  }

  await db.batchRecord.update({
    where: { id: record.id },
    data: {
      processingStatus: complianceStatus === "ERROR" ? "ERROR" : "COMPLETED",
      complianceStatus,
      errorCode,
      errorMessage,
      completedAt: new Date(),
    },
  });
}

export async function processBatchRecord(accountId: string, record: BatchRecord): Promise<void> {
  const batch = await db.complianceBatch.findUnique({
    where: { id: record.batchId },
    select: { batchType: true, createdByUserId: true },
  });

  if (batch?.batchType === "PRE_APPROVED_PARTY_IMPORT") {
    return processPreApprovedPartyImportRecord(accountId, record, batch.createdByUserId);
  }

  const input = record.normalizedInput as unknown as CanonicalComplianceRequest;

  const outcomes: ServiceOutcome[] = [];
  let rpsResultId: string | null = null;
  let licenseDeterminationResultId: string | null = null;
  let rpsComplianceExecutionId: string | null = null;
  let licenseComplianceExecutionId: string | null = null;
  let embargoStatus: string | null = null;
  let embargoEvidence: Record<string, unknown> | null = null;
  let embargoComplianceExecutionId: string | null = null;
  let classificationStatus: string | null = null;
  let classificationHtsCode: string | null = null;
  let classificationAgentDecisionId: string | null = null;
  let classificationComplianceExecutionId: string | null = null;
  let errorCode: string | null = null;
  let errorMessage: string | null = null;

  try {
    if (input.serviceFlags.partyScreening && input.party) {
      const rpsInput: RestrictedPartyScreeningInput = {
        accountId,
        source: "BULK_COMPLIANCE_SCREENING",
        externalReference: record.id,
        identity: input.party,
      };
      const runResult = await runRestrictedPartyScreening(rpsInput);
      const persisted = await persistScreeningRun(rpsInput, runResult);

      // Worst-severity pass wins, exactly as communityScreening/evaluator.ts.
      const severity: Record<string, number> = { HIT: 5, REVIEW_REQUIRED: 4, PARTIAL: 3, ERROR: 2, SKIPPED: 1, CLEAR: 0 };
      let worst: (typeof persisted)[number] | undefined;
      for (const p of persisted) {
        if (!worst || (severity[p.status] ?? 0) > (severity[worst.status] ?? 0)) worst = p;
      }

      rpsResultId = worst?.id ?? null;
      outcomes.push({ enabled: true, status: worst?.status ?? "ERROR" });

      if (worst) {
        rpsComplianceExecutionId = await recordComplianceExecution({
          accountId,
          executionType: "RESTRICTED_PARTY_SCREENING",
          status: worst.status === "ERROR" ? "FAILED" : "COMPLETED",
          correlationId: worst.correlationId,
          source: "BATCH",
          resultRefType: "RestrictedPartyScreeningResult",
          resultRefId: worst.id,
          finalStatus: worst.status,
        });
      }
    }

    if (input.serviceFlags.licenseScreening && input.classification) {
      const determination = await runLicenseDetermination({
        accountId,
        operationType: input.operationType,
        classification: input.classification,
        complianceCountry: input.complianceCountry,
        destinationCountry: input.destinationCountry,
        originCountry: input.originCountry,
        conditions: input.conditions ?? undefined,
        quantity: input.quantity,
        value: input.value,
        currency: input.currency,
        transactionId: input.transactionId,
        correlationId: input.correlationId,
        source: "BULK_COMPLIANCE_SCREENING",
      });
      licenseDeterminationResultId = determination.id;
      licenseComplianceExecutionId = determination.complianceExecutionId;
      outcomes.push({ enabled: true, status: determination.outcome.status });
    }

    if (input.serviceFlags.embargoScreening && input.complianceCountry && input.destinationCountry) {
      const accountConfig = await getAccountEmbargoConfig(accountId);
      const ctx: EmbargoCheckContext = {
        accountId,
        // doEmbargoCheck never reads shipmentId itself -- only a caller that
        // persists EmbargoUsageHeader/Line would, which this batch domain
        // deliberately skips (same trick as communityScreening/evaluator.ts).
        shipmentId: record.id,
        screeningLevel: "TRANSACTION",
        complianceCountry: input.complianceCountry,
        targetCountry: input.destinationCountry,
        type: "D",
        militaryEndUse: input.conditions?.militaryEndUser === "TRUE",
        screeningDate: new Date(),
        accountConfig,
      };
      const result = await doEmbargoCheck(ctx);
      embargoStatus = result.result;
      embargoEvidence = {
        matcher: result.matcher,
        ruleId: result.ruleId ?? null,
        reason: result.reason ?? null,
        evidence: result.evidence ?? null,
      };
      outcomes.push({ enabled: true, status: embargoStatus });

      embargoComplianceExecutionId = await recordComplianceExecution({
        accountId,
        executionType: "EMBARGO_SCREENING",
        status: embargoStatus === "ERROR" ? "FAILED" : "COMPLETED",
        correlationId: input.correlationId,
        source: "BATCH",
        countryChecked: input.destinationCountry,
        finalStatus: embargoStatus,
      });
    }

    if (input.serviceFlags.productClassification && input.product) {
      const batch = await db.complianceBatch.findUnique({
        where: { id: record.batchId },
        select: { createdByUserId: true },
      });

      const classification = await ClassificationService.classifyProduct(accountId, batch?.createdByUserId ?? "system", {
        productDescription: input.product.description,
        materialComposition: input.product.materialComposition ?? undefined,
        functionUsage: input.product.functionUsage ?? undefined,
        principalUse: input.product.principalUse ?? undefined,
        partNumber: input.product.partNumber ?? undefined,
        brandModel: input.product.brandModel ?? undefined,
        countryOfOrigin: input.originCountry ?? undefined,
      });

      classificationStatus = classification.status;
      classificationHtsCode = classification.proposedClassification?.htsCode ?? null;
      classificationAgentDecisionId = classification.agentDecisionId ?? null;
      outcomes.push({ enabled: true, status: classificationStatus });

      classificationComplianceExecutionId = await recordComplianceExecution({
        accountId,
        executionType: "CLASSIFICATION",
        status: classificationStatus === "REVIEW_REQUIRED" ? "PARTIAL" : "COMPLETED",
        correlationId: input.correlationId,
        source: "BATCH",
        resultRefType: classificationAgentDecisionId ? "AgentDecision" : undefined,
        resultRefId: classificationAgentDecisionId ?? undefined,
        finalStatus: classificationStatus,
      });
    }
  } catch (err) {
    errorCode = "PROCESSING_ERROR";
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const complianceStatus = errorMessage ? "ERROR" : aggregateRecordComplianceStatus(outcomes);

  await db.batchRecord.update({
    where: { id: record.id },
    data: {
      processingStatus: errorMessage ? "ERROR" : "COMPLETED",
      complianceStatus,
      rpsResultId,
      licenseDeterminationResultId,
      embargoStatus,
      embargoEvidence: (embargoEvidence ?? undefined) as Prisma.InputJsonValue | undefined,
      classificationStatus,
      classificationHtsCode,
      classificationAgentDecisionId,
      rpsComplianceExecutionId,
      licenseComplianceExecutionId,
      embargoComplianceExecutionId,
      classificationComplianceExecutionId,
      errorCode,
      errorMessage,
      completedAt: new Date(),
    },
  });

  try {
    await recordUsageEvent({
      accountId,
      eventCode: "BULK_COMPLIANCE_BATCH_RECORD_SCREENED",
      quantity: 1,
      unit: "record",
      sourceFunction: "processBatchRecord",
      automated: true,
      success: !errorMessage,
      idempotencyKey: `billing:bulk-compliance:${record.batchId}:${record.id}`,
      metadata: { batchId: record.batchId, recordId: record.id, complianceStatus },
    });
  } catch (billingError) {
    console.error("Failed to record bulk compliance screening billing usage", billingError);
  }
}
