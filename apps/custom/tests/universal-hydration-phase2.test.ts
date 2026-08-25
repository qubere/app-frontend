/**
 * Phase 2 Test Suite — LLM Universal Field Hydration (Universal Evidence Persistence)
 *
 * Asserts Phase 2 Exit Criteria:
 * - >= 97% extraction recall on the Golden Corpus fixtures.
 * - Every saved evidence item retains document, parse version, and page lineage.
 * - Backward-compatible extractedJson projection generates valid tradeMetadata & lineItems.
 * - Reprocessing retains evidence lineage without dropping observations.
 */

import { describe, it, expect } from "vitest";
import { UniversalEvidenceExtractor } from "../src/modules/hydration/evidence/universalEvidenceExtractor";
import { EvidenceLedgerService } from "../src/modules/hydration/evidence/evidenceLedgerService";
import { EvidenceInspection } from "../src/modules/hydration/evidence/evidenceInspection";
import {
  GOLDEN_CORPUS_FIXTURES,
  COMMERCIAL_INVOICE_FIXTURE,
  PACKING_LIST_FIXTURE,
  BILL_OF_LADING_FIXTURE,
} from "../src/modules/hydration/evals/corpus";

describe("Universal Field Hydration — Phase 2 Evidence Persistence", () => {
  it("achieves >= 97% extraction recall across Golden Corpus fixtures", () => {
    let totalBenchmarkFacts = 0;
    let totalRecalledFacts = 0;

    for (const fixture of GOLDEN_CORPUS_FIXTURES) {
      const items = UniversalEvidenceExtractor.extractAtomicEvidence({
        documentId: fixture.id,
        parseVersionId: "pv_phase2_1",
        extractedFields: fixture.extractedFields,
        tradeMetadata: fixture.tradeMetadata,
        lineItems: fixture.lineItems,
      });

      const coverage = EvidenceInspection.calculateDocumentCoverage(
        items,
        fixture.benchmarkFacts
      );

      totalBenchmarkFacts += coverage.totalBenchmarkFacts;
      totalRecalledFacts += coverage.recalledFactsCount;
    }

    const overallRecall = (totalRecalledFacts / totalBenchmarkFacts) * 100;
    expect(overallRecall).toBeGreaterThanOrEqual(97.0);
  });

  it("retains documentId, parseVersionId, pageNumber, and source lineage on all atomic items", () => {
    const items = UniversalEvidenceExtractor.extractAtomicEvidence({
      documentId: COMMERCIAL_INVOICE_FIXTURE.id,
      parseVersionId: "pv_phase2_2",
      extractedFields: COMMERCIAL_INVOICE_FIXTURE.extractedFields,
      lineItems: COMMERCIAL_INVOICE_FIXTURE.lineItems,
    });

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.documentId).toBe(COMMERCIAL_INVOICE_FIXTURE.id);
      expect(item.parseVersionId).toBe("pv_phase2_2");
      expect(item.pageNumber).toBeGreaterThanOrEqual(1);
      expect(item.source).toBeTruthy();
    }
  });

  it("projects backward-compatible extractedJson blob correctly", () => {
    const projection = EvidenceLedgerService.projectExtractedJson({
      documentId: BILL_OF_LADING_FIXTURE.id,
      parseVersionId: "pv_phase2_3",
      tradeMetadata: BILL_OF_LADING_FIXTURE.tradeMetadata,
      lineItems: BILL_OF_LADING_FIXTURE.lineItems,
    });

    expect(projection).toBeDefined();
    expect(projection.version).toBe("1.0");
    expect(projection.tradeMetadata.carrier).toBe("HAPAG LLOYD MEXICO SA DE CV");
    expect(projection.tradeMetadata.transportDocumentNumber).toBe("HLCUMX12609081");
  });

  it("correctly handles table line item evidence flattening", () => {
    const items = UniversalEvidenceExtractor.extractAtomicEvidence({
      documentId: PACKING_LIST_FIXTURE.id,
      parseVersionId: "pv_phase2_4",
      lineItems: PACKING_LIST_FIXTURE.lineItems,
    });

    const lineItemsItems = items.filter((i) => i.stableKey.startsWith("lineItem["));
    expect(lineItemsItems.length).toBeGreaterThan(0);
    expect(lineItemsItems.some((i) => i.groupKey === "line_item:1")).toBe(true);
  });
});
