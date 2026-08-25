/**
 * Shadow Backfill & Migration Runner — LLM Universal Field Hydration
 *
 * Re-hydrates stored active parse contexts through the universal hydration engine
 * without re-OCR, producing migration diff reports comparing proposed values against
 * existing canonical `Fact` records.
 */

import { db } from "@qubere/db";
import type { RawExtractionContext } from "../evidence/universalEvidenceExtractor";
import { HydrationWorker, type PipelineExecutionResult } from "../orchestration/hydrationWorker";
import { HydrationLogger } from "../logging/hydrationLogger";

export interface MigrationDiffReport {
  documentId: string;
  parseVersionId: string;
  totalEvidenceExtracted: number;
  totalProposalsGenerated: number;
  totalPromotions: number;
  matchingLegacyFactsCount: number;
  newCandidatesDiscoveredCount: number;
  conflictsWithLegacyCount: number;
  diffItems: Array<{
    fieldKey: string;
    proposedValue: unknown;
    legacyFactValue?: string;
    diffStatus: "MATCH" | "NEW_DISCOVERY" | "LEGACY_CONFLICT";
  }>;
}

export class ShadowBackfillRunner {
  /**
   * Runs a stored active parse context through universal hydration in shadow mode.
   * Safe non-mutating dry run.
   */
  public static async runShadowBackfill(
    accountId: string,
    ctx: RawExtractionContext,
    shipmentId?: string,
    dataMode?: "PRODUCTION" | "DEMO" | "SANDBOX"
  ): Promise<MigrationDiffReport> {
    HydrationLogger.info(`Starting shadow backfill run for document ${ctx.documentId}`, {
      accountId,
      documentId: ctx.documentId,
      parseVersionId: ctx.parseVersionId,
      shipmentId,
    });
    // E1 check: Run hydration pipeline in shadow mode (dry run, zero database mutation)
    const execResult: PipelineExecutionResult = await HydrationWorker.processDocumentHydration(
      accountId,
      ctx,
      { shipmentId, mapperModelVersion: "gpt-4o", mapperPromptVersion: "v1.0-shadow", mode: "shadow", dataMode }
    );

    // E4 check: Tenant-scoped existing Fact query
    const existingFacts = shipmentId
      ? await db.fact.findMany({ where: { shipmentId, shipment: { accountId } } })
      : [];

    const legacyFactMap = new Map(existingFacts.map((f) => [f.field, f.value]));

    const diffItems: MigrationDiffReport["diffItems"] = [];
    let matchingCount = 0;
    let newDiscoveryCount = 0;
    let legacyConflictCount = 0;

    for (const decision of execResult.decisions) {
      const fieldKey = decision.candidate.proposal.targetFieldKey;
      const proposedVal = decision.candidate.proposal.proposedValue;
      const legacyVal = legacyFactMap.get(fieldKey);

      if (!legacyVal) {
        newDiscoveryCount += 1;
        diffItems.push({
          fieldKey,
          proposedValue: proposedVal,
          diffStatus: "NEW_DISCOVERY",
        });
      } else {
        const normProposed = String(proposedVal).trim().toLowerCase();
        const normLegacy = String(legacyVal).trim().toLowerCase();

        if (normProposed === normLegacy || normLegacy.includes(normProposed)) {
          matchingCount += 1;
          diffItems.push({
            fieldKey,
            proposedValue: proposedVal,
            legacyFactValue: legacyVal,
            diffStatus: "MATCH",
          });
        } else {
          legacyConflictCount += 1;
          diffItems.push({
            fieldKey,
            proposedValue: proposedVal,
            legacyFactValue: legacyVal,
            diffStatus: "LEGACY_CONFLICT",
          });
        }
      }
    }

    return {
      documentId: ctx.documentId,
      parseVersionId: ctx.parseVersionId,
      totalEvidenceExtracted: execResult.totalEvidenceCount,
      totalProposalsGenerated: execResult.proposalsCount,
      totalPromotions: execResult.promotedCount,
      matchingLegacyFactsCount: matchingCount,
      newCandidatesDiscoveredCount: newDiscoveryCount,
      conflictsWithLegacyCount: legacyConflictCount,
      diffItems,
    };
  }
}
