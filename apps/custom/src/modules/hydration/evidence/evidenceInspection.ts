/**
 * Evidence Inspection & Document Coverage Tooling
 *
 * Provides document-level extraction recall benchmarking and inspection
 * of grounded evidence items across documents and parse versions.
 */

import type { AtomicEvidenceItem } from "./universalEvidenceExtractor";
import type { BenchmarkFact } from "../evals/corpus";
import { FIELD_INVENTORY } from "../inventory/fieldInventory";

export interface DocumentCoverageResult {
  totalBenchmarkFacts: number;
  recalledFactsCount: number;
  extractionRecallPercentage: number;
  recalledFacts: Array<{ canonicalKey: string; groundTruth: unknown; extractedValue: string }>;
  missingFacts: Array<{ canonicalKey: string; groundTruth: unknown }>;
}

export class EvidenceInspection {
  /**
   * Calculates extraction recall (% of visible benchmark facts persisted with evidence).
   * Uses scoped exact-key segment matching to avoid false-positive substring/suffix hits.
   */
  public static calculateDocumentCoverage(
    items: AtomicEvidenceItem[],
    benchmarkFacts: BenchmarkFact[]
  ): DocumentCoverageResult {
    let recalledCount = 0;
    const recalledFacts: DocumentCoverageResult["recalledFacts"] = [];
    const missingFacts: DocumentCoverageResult["missingFacts"] = [];

    for (const fact of benchmarkFacts) {
      const inventoryEntry = FIELD_INVENTORY.find((i) => i.canonicalKey === fact.canonicalKey);
      const targetKey = inventoryEntry?.tradeMetadataKey || inventoryEntry?.legacyKey || fact.canonicalKey;

      const targetKeys = [
        targetKey,
        inventoryEntry?.legacyKey,
        inventoryEntry?.tradeMetadataKey,
        inventoryEntry?.factFieldName,
        inventoryEntry?.directShipmentColumn,
        fact.canonicalKey,
        fact.canonicalKey.replace("lineItem[].", ""),
      ].filter(Boolean) as string[];

      const isLineItemFact = fact.canonicalKey.startsWith("lineItem[]");

      // Search atomic evidence items for matching key or alias with strict segment boundary
      const match = items.find((item) => {
        const itemIsLineItem = item.stableKey.startsWith("lineItem[");
        if (isLineItemFact !== itemIsLineItem) {
          return false;
        }

        const segments = item.stableKey.split(".");
        const lastSegment = segments[segments.length - 1];

        return targetKeys.some((k) => {
          if (item.rawLabel === k) return true;
          if (item.stableKey === k) return true;
          if (item.stableKey === `tradeMetadata.${k}`) return true;
          if (lastSegment === k) return true;
          return false;
        });
      });

      if (match && match.rawValue && match.rawValue.trim() !== "") {
        recalledCount += 1;
        recalledFacts.push({
          canonicalKey: fact.canonicalKey,
          groundTruth: fact.groundTruthValue,
          extractedValue: match.rawValue,
        });
      } else {
        missingFacts.push({
          canonicalKey: fact.canonicalKey,
          groundTruth: fact.groundTruthValue,
        });
      }
    }

    const percentage =
      benchmarkFacts.length > 0
        ? Number(((recalledCount / benchmarkFacts.length) * 100).toFixed(2))
        : 100.0;

    return {
      totalBenchmarkFacts: benchmarkFacts.length,
      recalledFactsCount: recalledCount,
      extractionRecallPercentage: percentage,
      recalledFacts,
      missingFacts,
    };
  }
}
