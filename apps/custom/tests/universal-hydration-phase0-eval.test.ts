/**
 * Phase 0 CI Benchmark Test Suite — LLM Universal Field Hydration
 *
 * Verifies Phase 0 exit criteria:
 * - Metrics reproduce deterministically in CI.
 * - Every golden value points to document/page evidence.
 * - Field inventory catalog includes all drift keys.
 * - Canonical registry V1 definitions satisfy invariant contracts.
 */

import { describe, it, expect } from "vitest";
import { runHydrationEvaluation } from "../src/modules/hydration/evals/evalRunner";
import { GOLDEN_CORPUS_FIXTURES, GOLDEN_CORPUS_PACKETS } from "../src/modules/hydration/evals/corpus";
import { FIELD_INVENTORY } from "../src/modules/hydration/inventory/fieldInventory";
import { CANONICAL_FIELD_REGISTRY_V1 } from "../src/modules/hydration/registry/canonicalRegistryV1";

describe("Universal Field Hydration — Phase 0 Benchmark Evaluation", () => {
  it("runs hydration evaluation deterministically and calculates baseline metrics", () => {
    const report = runHydrationEvaluation();

    expect(report).toBeDefined();
    expect(report.evalVersion).toBe("1.0.0");
    expect(report.combinedMetrics.totalBenchmarkFacts).toBeGreaterThan(0);
    expect(report.combinedMetrics.extractionRecall).toBeGreaterThanOrEqual(90.0);
    expect(report.combinedMetrics.mappingCoverage).toBeGreaterThanOrEqual(95.0);
    expect(report.combinedMetrics.autoHydrationPrecision).toBeGreaterThanOrEqual(95.0);
  });

  it("verifies every golden benchmark fact has grounded evidence references", () => {
    for (const fixture of GOLDEN_CORPUS_FIXTURES) {
      expect(fixture.benchmarkFacts.length).toBeGreaterThan(0);
      for (const fact of fixture.benchmarkFacts) {
        expect(fact.evidence).toBeDefined();
        expect(fact.evidence.documentId).toBe(fixture.id);
        expect(fact.evidence.rawLabel).toBeTruthy();
        expect(fact.evidence.rawValue).toBeTruthy();
      }
    }
  });

  it("verifies field inventory catalog includes all 5 live incident drift keys", () => {
    const driftKeys = FIELD_INVENTORY.filter((item) => item.isDriftKey);
    expect(driftKeys.length).toBe(5);

    const canonicalKeys = driftKeys.map((item) => item.canonicalKey);
    expect(canonicalKeys).toContain("shipment.carrier.name");
    expect(canonicalKeys).toContain("shipment.financial.invoiceSubtotal");
    expect(canonicalKeys).toContain("tracking.billOfLading");
    expect(canonicalKeys).toContain("lineItem[].htsCode");
    expect(canonicalKeys).toContain("shipment.cargo.grossWeight");
  });

  it("verifies Canonical Field Registry V1 is valid and non-empty", () => {
    const registryKeys = Object.keys(CANONICAL_FIELD_REGISTRY_V1);
    expect(registryKeys.length).toBeGreaterThanOrEqual(15);

    for (const key of registryKeys) {
      const def = CANONICAL_FIELD_REGISTRY_V1[key];
      expect(def.key).toBe(key);
      expect(def.version).toBe("1.0.0");
      expect(def.entityKind).toBeTruthy();
      expect(def.materializer).toBeTruthy();
      expect(def.riskClass).toBeTruthy();
    }
  });

  it("verifies multi-document packet fixtures are correctly structured", () => {
    expect(GOLDEN_CORPUS_PACKETS.length).toBe(2);
    for (const packet of GOLDEN_CORPUS_PACKETS) {
      expect(packet.documents.length).toBeGreaterThanOrEqual(3);
      expect(packet.shipmentBenchmarkFacts.length).toBeGreaterThan(0);
    }
  });
});
