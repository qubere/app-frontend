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
import { CorroborationConflictResolver } from "../resolution/corroborationConflictResolver";
import { PromotionPolicyEngine, type PromotionDecision } from "../promotion/promotionPolicyEngine";
import { MaterializerRegistry, type MaterializationResult } from "../promotion/materializers";
import { ShipmentEventBus } from "../../../modules/events/shipmentEventBus";

export interface PipelineExecutionResult {
  runId: string;
  isNewRun: boolean;
  totalEvidenceCount: number;
  proposalsCount: number;
  promotedCount: number;
  decisions: PromotionDecision[];
  materializations: MaterializationResult[];
}

export class HydrationWorker {
  /**
   * Executes the universal hydration pipeline for an accepted parse context.
   */
  public static async processDocumentHydration(
    accountId: string,
    ctx: RawExtractionContext,
    options: { shipmentId?: string; mapperModelVersion?: string; mapperPromptVersion?: string } = {}
  ): Promise<PipelineExecutionResult> {
    const modelVer = options.mapperModelVersion || "gpt-4o";
    const promptVer = options.mapperPromptVersion || "v1.0";

    // 1. Evidence Extraction & Persistence
    const evidenceFields = await EvidenceLedgerService.persistEvidenceLedger(ctx);
    const atomicItems = evidenceFields.map((f) => ({
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
    });

    // 3. Structured LLM Mapping
    const proposals = StructuredFieldMapper.mapEvidenceToProposals(atomicItems);

    // Persist proposals to HydrationCandidate table
    await HydrationRunEngine.persistProposals(run.id, accountId, proposals);

    // 4. Multi-document Corroboration & Conflict Resolution
    const docMap = new Map();
    docMap.set(ctx.documentId, proposals);
    const resolvedCandidates = CorroborationConflictResolver.resolveShipmentProposals(docMap);

    // 5. Governed Policy Evaluation & 6. Allowlisted Materialization
    const decisions: PromotionDecision[] = [];
    const materializations: MaterializationResult[] = [];

    for (const resCand of resolvedCandidates) {
      const decision = await PromotionPolicyEngine.evaluateCandidate(options.shipmentId, resCand);
      decisions.push(decision);

      if (decision.shouldPromote) {
        const matRes = await MaterializerRegistry.materializeDecision(accountId, options.shipmentId, decision);
        materializations.push(matRes);
      }
    }

    const promotedCount = materializations.filter((m) => m.success).length;

    // 7. Emit DOCUMENT_HYDRATION_PROMOTED Event
    if (options.shipmentId) {
      await ShipmentEventBus.logEvent({
        shipmentId: options.shipmentId,
        eventType: "DOCUMENT_HYDRATION_PROMOTED",
        triggeredBy: "SYSTEM",
        payload: {
          documentId: ctx.documentId,
          parseVersionId: ctx.parseVersionId,
          promotedCount,
          runId: run.id,
        },
      });
    }

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
   * Recomputes facts upon document detach/reattach from surviving evidence candidates without clobbering human locks.
   */
  public static async recomputeShipmentFactsOnDetach(
    accountId: string,
    shipmentId: string,
    detachedDocumentId: string
  ) {
    // Soft delete or clear automatically sourced facts associated with detached document
    await db.fact.deleteMany({
      where: {
        shipmentId,
        documentId: detachedDocumentId,
        sourceType: "EXTRACTED",
      },
    });

    // Recompute current active facts from surviving documents attached to shipment
    const survivingDocs = await db.shipmentDocument.findMany({
      where: { shipmentId, accountId, NOT: { id: detachedDocumentId } },
    });

    return { detachedDocumentId, survivingDocCount: survivingDocs.length };
  }
}
