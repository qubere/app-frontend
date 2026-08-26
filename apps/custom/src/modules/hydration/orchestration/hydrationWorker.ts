/**
 * Hydration Worker & Orchestration Service — LLM Universal Field Hydration
 *
 * End-to-end pipeline execution:
 * 1. Evidence Extraction & Persistence
 * 2. Hydration Run Creation & Idempotency Tracking
 * 3. Structured LLM Mapping
 * 4. Multi-document Corroboration & Conflict Resolution
 * 5. Governed Policy Evaluation
 * 6. Allowlisted Materialization
 * 7. DOCUMENT_HYDRATION_PROMOTED Event Emission
 */

import { db } from "@qubere/db";
import type { RawExtractionContext } from "../evidence/universalEvidenceExtractor";
import { EvidenceLedgerService } from "../evidence/evidenceLedgerService";
import { HydrationRunEngine } from "../engine/hydrationRunEngine";
import { StructuredFieldMapper } from "../mapper/structuredFieldMapper";
import {
  CorroborationConflictResolver,
  candidateIdentityKey,
} from "../resolution/corroborationConflictResolver";
import { PromotionPolicyEngine, type PromotionDecision } from "../promotion/promotionPolicyEngine";
import { MaterializerRegistry, type MaterializationResult } from "../promotion/materializers";
import { RolloutController } from "../rollout/rolloutController";
import { createExceptionItem } from "@/lib/exceptions/createException";
import { ShipmentEventBus } from "../../../modules/events/shipmentEventBus";
import { HydrationLogger } from "../logging/hydrationLogger";

export interface PipelineExecutionResult {
  runId: string;
  isNewRun: boolean;
  totalEvidenceCount: number;
  proposalsCount: number;
  promotedCount: number;
  decisions: PromotionDecision[];
  materializations: MaterializationResult[];
  skippedReason?: string;
}

export interface ProcessHydrationOptions {
  shipmentId?: string;
  mapperModelVersion?: string;
  mapperPromptVersion?: string;
  mode?: "shadow" | "live";
  dataMode?: "PRODUCTION" | "DEMO" | "SANDBOX";
}

export class HydrationWorker {
  /**
   * Executes the universal hydration pipeline for an accepted parse context.
   */
  public static async processDocumentHydration(
    accountId: string,
    ctx: RawExtractionContext,
    options: ProcessHydrationOptions = {}
  ): Promise<PipelineExecutionResult> {
    HydrationLogger.info(`Processing document hydration for doc ${ctx.documentId}`, {
      accountId,
      documentId: ctx.documentId,
      shipmentId: options.shipmentId,
      mode: options.mode,
    });

    // A3 check: Rollout kill switch check
    if (!RolloutController.isHydrationEngineEnabled(accountId)) {
      HydrationLogger.warn(`Hydration engine disabled for account ${accountId}`, { accountId });
      return {
        runId: `disabled_${ctx.documentId}`,
        isNewRun: false,
        totalEvidenceCount: 0,
        proposalsCount: 0,
        promotedCount: 0,
        decisions: [],
        materializations: [],
        skippedReason: "ROLLOUT_DISABLED",
      };
    }

    const modelVer = options.mapperModelVersion || "deterministic-alias-v1";
    const promptVer = options.mapperPromptVersion || "none";
    const executionMode = options.mode || "live";

    // 1. Evidence Extraction & Persistence
    const evidenceFields = await EvidenceLedgerService.persistEvidenceLedger(ctx, accountId);
    const atomicItems = evidenceFields.map((f) => ({
      id: f.id,
      stableKey: f.fieldName,
      rawLabel: f.fieldName,
      rawValue: f.value,
      documentId: f.documentId,
      parseVersionId: ctx.parseVersionId,
      pageNumber: f.pageNumber || 1,
      confidence: f.confidence || 95,
      source: f.source,
      status: "OBSERVED" as const,
    }));

    // 2. Hydration Run Creation & Idempotency Tracking
    const { run, isNew } = await HydrationRunEngine.createOrGetRun({
      accountId,
      shipmentId: options.shipmentId,
      documentId: ctx.documentId,
      activeParseVersionId: ctx.parseVersionId,
      mapperModelVersion: modelVer,
      mapperPromptVersion: promptVer,
      dataMode: options.dataMode,
    });

    // 3. Structured LLM Mapping
    const proposals = StructuredFieldMapper.mapEvidenceToProposals(atomicItems);

    // Persist proposals to HydrationCandidate table
    const createdCandidates = await HydrationRunEngine.persistProposals(run.id, accountId, proposals);
    const candidateIdMap = new Map<string, string>(
      createdCandidates.map((c: any) => [
        candidateIdentityKey(c.fieldDefinitionKey, c.targetEntityRef || null),
        c.id,
      ])
    );

    // 4. Multi-document Corroboration & Conflict Resolution
    const docMap = new Map();
    docMap.set(ctx.documentId, proposals);
    const resolvedCandidates = CorroborationConflictResolver.resolveShipmentProposals(docMap, candidateIdMap);

    // 5. Governed Policy Evaluation & 6. Allowlisted Materialization
    const decisions: PromotionDecision[] = [];
    const materializations: MaterializationResult[] = [];

    // Fetch current shipment version for optimistic concurrency (CAS) check
    let currentShipmentVersion: number | undefined;
    if (options.shipmentId) {
      const shp = await db.shipment.findFirst({
        where: { id: options.shipmentId, accountId },
        select: { version: true },
      });
      currentShipmentVersion = shp?.version;
    }

    for (const resCand of resolvedCandidates) {
      const decision = await PromotionPolicyEngine.evaluateCandidate(options.shipmentId, resCand, accountId);
      decisions.push(decision);

      // C4 check: Handle visible candidate conflict records
      if (resCand.status === "CONFLICT" && options.shipmentId) {
        await createExceptionItem({
          accountId,
          shipmentId: options.shipmentId,
          fieldKey: resCand.proposal.targetFieldKey,
          category: "DATA_MISMATCH",
          type: "FIELD_CONFLICT",
          severity: "Critical",
          description: resCand.conflictReason || "Contradictory values detected across documents.",
        }).catch((err) => {
          HydrationLogger.error("Failed to write conflict exception record", err, { accountId, shipmentId: options.shipmentId });
        });
      }

      if (decision.shouldPromote) {
        // E1 check: Thread execution mode & expectedVersion to materializer
        const matRes = await MaterializerRegistry.materializeDecision(
          accountId,
          options.shipmentId,
          decision,
          { mode: executionMode, expectedVersion: currentShipmentVersion }
        );
        materializations.push(matRes);
        if (
          matRes.success &&
          matRes.materialized !== false &&
          matRes.materializer === "ShipmentScalarMaterializer" &&
          typeof currentShipmentVersion === "number"
        ) {
          currentShipmentVersion += 1;
        }
      }
    }

    const promotedCount = materializations.filter((m) => m.success && m.materialized !== false).length;

    // 7. Emit DOCUMENT_HYDRATION_PROMOTED Event
    if (options.shipmentId && executionMode === "live") {
      await ShipmentEventBus.logEvent({
        shipmentId: options.shipmentId,
        eventType: "DOCUMENT_HYDRATION_PROMOTED",
        accountId,
        payload: {
          documentId: ctx.documentId,
          parseVersionId: ctx.parseVersionId,
          promotedCount,
          runId: run.id,
        },
      });
    }

    HydrationLogger.info(`Completed document hydration for run ${run.id}`, {
      runId: run.id,
      accountId,
      promotedCount,
      totalProposals: proposals.length,
    });

    return {
      runId: run.id,
      isNewRun: isNew,
      totalEvidenceCount: evidenceFields.length,
      proposalsCount: proposals.length,
      promotedCount,
      decisions,
      materializations,
    };
  }

  /**
   * Recomputes shipment facts when a document is detached or removed.
   *
   * Invariant #3: Raw evidence is immutable; facts sourced from the detached document
   * are superseded (`supersededAt = now()`) unless human-locked.
   * Surviving candidates for affected fields are re-evaluated and promoted if qualified.
   */
  public static async recomputeShipmentFactsOnDetach(
    accountId: string,
    shipmentId: string,
    detachedDocumentId: string
  ): Promise<{ detachedDocumentId: string; supersededFactsCount: number; recomputedPromotionsCount: number }> {
    HydrationLogger.info(`Recomputing shipment facts on document detach`, { accountId, shipmentId, detachedDocumentId });

    // Verify tenant ownership of shipment
    const shipment = await db.shipment.findFirst({
      where: { id: shipmentId, accountId },
      select: { id: true, version: true },
    });

    if (!shipment) {
      throw new Error(`Shipment '${shipmentId}' not found for account '${accountId}'.`);
    }

    // 1. Mark non-human-locked facts from the detached document as superseded
    const factsToSupersede = await db.fact.findMany({
      where: {
        shipmentId,
        documentId: detachedDocumentId,
        isHumanLocked: false,
        supersededAt: null,
      },
    });

    const affectedFields = Array.from(new Set(factsToSupersede.map((f) => f.field)));

    if (factsToSupersede.length > 0) {
      await db.fact.updateMany({
        where: {
          id: { in: factsToSupersede.map((f) => f.id) },
        },
        data: {
          supersededAt: new Date(),
        },
      });
    }

    let recomputedPromotionsCount = 0;

    // 2. For each affected field, evaluate surviving document candidates
    for (const fieldKey of affectedFields) {
      // Check if field is human-locked by another fact
      const humanLock = await db.fact.findFirst({
        where: { shipmentId, field: fieldKey, isHumanLocked: true, supersededAt: null },
      });

      if (humanLock) {
        continue; // Human lock survives untouched
      }

      // Fetch top surviving candidate from surviving documents
      const survivingCandidate = await db.hydrationCandidate.findFirst({
        where: {
          shipmentId,
          fieldDefinitionKey: fieldKey,
          documentId: { not: detachedDocumentId },
          status: "PROPOSED",
        },
        orderBy: { mappingConfidence: "desc" },
      });

      if (survivingCandidate) {
        const resolvedCandidate = {
          proposal: {
            targetFieldKey: survivingCandidate.fieldDefinitionKey,
            targetEntityRef: survivingCandidate.targetEntityRef,
            sourceExtractionFieldIds: survivingCandidate.sourceExtractionFieldIds,
            evidenceReferences: [{ documentId: survivingCandidate.documentId, parseVersionId: "surviving", rawLabel: fieldKey, rawValue: String(survivingCandidate.rawValue) }],
            proposedValue: survivingCandidate.rawValue,
            mappingConfidence: survivingCandidate.mappingConfidence ?? 90,
            relationConfidence: null,
            reasoning: survivingCandidate.reasonCodes.join("; "),
            status: "PROPOSED" as const,
            abstainReason: null,
          },
          corroboratingDocumentIds: [survivingCandidate.documentId],
          corroborationScore: 0,
          calibratedScore: survivingCandidate.mappingConfidence ?? 90,
          status: "PROMOTED" as const,
        };

        const decision = await PromotionPolicyEngine.evaluateCandidate(shipmentId, resolvedCandidate, accountId);
        if (decision.shouldPromote) {
          const matRes = await MaterializerRegistry.materializeDecision(accountId, shipmentId, decision, {
            mode: "live",
            expectedVersion: shipment.version,
          });
          if (matRes.success && matRes.materialized !== false) {
            recomputedPromotionsCount++;
          }
        }
      }
    }

    return {
      detachedDocumentId,
      supersededFactsCount: factsToSupersede.length,
      recomputedPromotionsCount,
    };
  }
}
