/**
 * Phase 6 Test Suite — LLM Universal Field Hydration (Backfill & Production Rollout)
 *
 * Asserts Phase 6 Exit Criteria:
 * - Shadow backfill runner executes over active parse context without re-OCR and produces valid migration diff reports.
 * - Rollout controller feature flags and emergency kill switch function cleanly.
 * - Operational dashboard metrics service aggregates fill rate, precision, abstention, latency, and cost.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ShadowBackfillRunner } from "../src/modules/hydration/rollout/shadowBackfillRunner";
import { RolloutController } from "../src/modules/hydration/rollout/rolloutController";
import { HydrationMetricsService } from "../src/modules/hydration/rollout/hydrationMetricsService";
import { COMMERCIAL_INVOICE_FIXTURE } from "../src/modules/hydration/evals/corpus";

describe("Universal Field Hydration — Phase 6 Backfill & Rollout", () => {
  const testAccount = "acc_phase6_test_001";

  beforeEach(() => {
    RolloutController.resetRolloutConfig();
  });

  it("executes shadow backfill runner without re-OCR and generates migration diff report", async () => {
    const report = await ShadowBackfillRunner.runShadowBackfill(testAccount, {
      documentId: COMMERCIAL_INVOICE_FIXTURE.id,
      parseVersionId: "pv_phase6_shadow",
      extractedFields: COMMERCIAL_INVOICE_FIXTURE.extractedFields,
      tradeMetadata: COMMERCIAL_INVOICE_FIXTURE.tradeMetadata,
      lineItems: COMMERCIAL_INVOICE_FIXTURE.lineItems,
    });

    expect(report).toBeDefined();
    expect(report.documentId).toBe(COMMERCIAL_INVOICE_FIXTURE.id);
    expect(report.totalEvidenceExtracted).toBeGreaterThan(0);
    expect(report.totalProposalsGenerated).toBeGreaterThan(0);
    expect(report.diffItems.length).toBeGreaterThan(0);
  });

  it("manages canary rollout flags and emergency kill switch cleanly", () => {
    expect(RolloutController.isHydrationEngineEnabled("any_acc")).toBe(true);

    // Disable universal hydration via emergency kill switch
    RolloutController.disableUniversalHydration("acc_canary_01");
    expect(RolloutController.isHydrationEngineEnabled("acc_canary_01")).toBe(false);
    expect(RolloutController.isHydrationEngineEnabled("other_acc")).toBe(true);

    // Global kill switch
    RolloutController.disableUniversalHydration("*");
    expect(RolloutController.isHydrationEngineEnabled("other_acc")).toBe(false);
  });

  it("computes operational telemetry dashboard metrics", async () => {
    const metrics = await HydrationMetricsService.getAccountMetrics(testAccount);

    expect(metrics).toBeDefined();
    expect(metrics.avgLatencyMs).toBeGreaterThan(0);
    expect(metrics.estimatedCostUsd).toBeGreaterThanOrEqual(0);
    expect(metrics.autoHydrationPrecision).toBeGreaterThanOrEqual(0);
    expect(metrics.abstentionRate).toBeGreaterThanOrEqual(0);
  });
});
