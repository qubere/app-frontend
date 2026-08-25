/**
 * Phase 2 Test Suite — LLM Universal Field Hydration (Universal Evidence Persistence)
 *
 * Asserts Phase 2 Exit Criteria:
 * - >= 97% extraction recall on the Golden Corpus fixtures.
 * - Every saved evidence item retains document, parse version, and page lineage.
 * - Backward-compatible extractedJson projection generates valid tradeMetadata & lineItems.
 * - Reprocessing retains evidence lineage without dropping observations.
 */

import { describe, it, expect, vi } from "vitest";
import { UniversalEvidenceExtractor } from "../src/modules/hydration/evidence/universalEvidenceExtractor";
import { EvidenceLedgerService } from "../src/modules/hydration/evidence/evidenceLedgerService";
import { EvidenceInspection } from "../src/modules/hydration/evidence/evidenceInspection";
import {
  GOLDEN_CORPUS_FIXTURES,
  COMMERCIAL_INVOICE_FIXTURE,
  PACKING_LIST_FIXTURE,
  BILL_OF_LADING_FIXTURE,
} from "../src/modules/hydration/evals/corpus";
import { db } from "@qubere/db";

describe("Universal Field Hydration — Phase 2 Evidence Persistence", () => {
  const testAccount = "acc_phase2_test_001";
  const testDocument = "doc_phase2_test_001";

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

  it("test-matrix #29 / Defect #4: EvidenceLedgerService fails closed when reading or writing evidence for another account", async () => {
    vi.spyOn(db.shipmentDocument, "findFirst").mockResolvedValue(null);

    const ctx = {
      documentId: "doc_cross_tenant_1",
      parseVersionId: "pv_1",
      tradeMetadata: { carrier: "HAPAG" },
    };

    await expect(
      EvidenceLedgerService.persistEvidenceLedger(ctx, "wrong_account")
    ).rejects.toThrow(/FAIL_CLOSED: Document 'doc_cross_tenant_1' not found for account 'wrong_account'/);

    await expect(
      EvidenceLedgerService.getEvidenceForDocument("doc_cross_tenant_1", "wrong_account")
    ).rejects.toThrow(/FAIL_CLOSED: Document 'doc_cross_tenant_1' not found for account 'wrong_account'/);
  });

  it("Defect #6: EvidenceLedgerService uses UNIVERSAL_HYDRATION source tag and deduplicates observations for document", async () => {
    vi.spyOn(db.shipmentDocument, "findFirst").mockResolvedValue({ id: testDocument, accountId: testAccount } as any);
    vi.spyOn(db.extractionField, "deleteMany").mockResolvedValue({ count: 2 } as any);
    vi.spyOn(db.extractionField, "create").mockImplementation((async (args: any) => {
      return {
        id: `field_${args.data.fieldName}`,
        ...args.data,
        createdAt: new Date(),
      };
    }) as any);

    const ctx = {
      documentId: testDocument,
      parseVersionId: "pv_dedupe_1",
      tradeMetadata: { carrier: "MAERSK" },
    };

    const fields = await EvidenceLedgerService.persistEvidenceLedger(ctx, testAccount);
    expect(fields.length).toBeGreaterThan(0);
    expect(fields[0].source).toBe("UNIVERSAL_HYDRATION");
    expect(db.extractionField.deleteMany).toHaveBeenCalledWith({
      where: {
        documentId: testDocument,
        source: "UNIVERSAL_HYDRATION",
      },
    });
  });

  it("Defect #8: EvidenceInspection matching does not cross-match line item fields whose names are substrings of each other", () => {
    const items = UniversalEvidenceExtractor.extractAtomicEvidence({
      documentId: "doc_substring_test",
      parseVersionId: "pv_1",
      lineItems: [
        {
          price: "10.00",
          unitPriceCurrency: "USD",
        },
      ],
    });

    const benchmarkFacts = [
      {
        canonicalKey: "lineItem[].price",
        groundTruthValue: "10.00",
      },
      {
        canonicalKey: "lineItem[].unitPrice",
        groundTruthValue: "10.00",
      },
    ];

    const coverage = EvidenceInspection.calculateDocumentCoverage(items, benchmarkFacts as any);

    // "lineItem[].price" should match item.stableKey "lineItem[1].price"
    // "lineItem[].unitPrice" should NOT match "lineItem[1].unitPriceCurrency"
    expect(coverage.recalledFacts.some((f) => f.canonicalKey === "lineItem[].price")).toBe(true);
    expect(coverage.recalledFacts.some((f) => f.canonicalKey === "lineItem[].unitPrice")).toBe(false);
    expect(coverage.missingFacts.some((f) => f.canonicalKey === "lineItem[].unitPrice")).toBe(true);
  });
});
