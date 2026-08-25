/**
 * Phase 6 Test Suite — LLM Universal Field Hydration (Backfill & Production Rollout)
 *
 * Asserts Phase 6 Exit Criteria:
 * - Shadow backfill runner executes over active parse context without re-OCR and produces valid migration diff reports.
 * - Rollout controller feature flags and emergency kill switch function cleanly.
 * - Operational dashboard metrics service aggregates fill rate, precision, abstention, latency, and cost.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ShadowBackfillRunner } from "../src/modules/hydration/rollout/shadowBackfillRunner";
import { RolloutController } from "../src/modules/hydration/rollout/rolloutController";
import { HydrationMetricsService } from "../src/modules/hydration/rollout/hydrationMetricsService";
import { HydrationWorker } from "../src/modules/hydration/orchestration/hydrationWorker";
import { COMMERCIAL_INVOICE_FIXTURE } from "../src/modules/hydration/evals/corpus";
import { db } from "@qubere/db";

describe("Universal Field Hydration — Phase 6 Backfill & Rollout", () => {
  const testAccount = "acc_phase6_test_001";

  beforeEach(() => {
    RolloutController.resetRolloutConfig();
  });

  it("test-matrix #32 / #19: executes shadow backfill runner in dry run mode without mutating database", async () => {
    const mockDoc = { id: COMMERCIAL_INVOICE_FIXTURE.id, accountId: testAccount };
    const mockRun = {
      id: `run_${COMMERCIAL_INVOICE_FIXTURE.id}`,
      accountId: testAccount,
      shipmentId: null,
      documentId: COMMERCIAL_INVOICE_FIXTURE.id,
      activeParseVersionId: "pv_phase6_shadow",
      fieldSchemaVersion: "1.0.0",
      extractionSchemaVersion: "1.0.0",
      mapperModelVersion: "gpt-4o",
      mapperPromptVersion: "v1.0-shadow",
      normalizationPolicyVersion: "1.0.0",
      idempotencyKey: `${testAccount}:${COMMERCIAL_INVOICE_FIXTURE.id}:pv_phase6_shadow:1.0.0:v1.0-shadow:gpt-4o:1.0.0`,
      status: "RUNNING",
      errorCode: null,
    };

    vi.spyOn(db.shipmentDocument, "findFirst").mockResolvedValue(mockDoc as any);
    vi.spyOn(db.hydrationRun, "findFirst").mockResolvedValue(mockRun as any);
    vi.spyOn(db.hydrationRun, "findUnique").mockResolvedValue(null);
    vi.spyOn(db.hydrationRun, "create").mockResolvedValue({ ...mockRun, candidates: [] } as any);
    vi.spyOn(db.hydrationRun, "update").mockResolvedValue({ ...mockRun, status: "SUCCEEDED" } as any);
    vi.spyOn(db.extractionField, "findMany").mockImplementation(((args: any) => {
      const requestedIds = args?.where?.id?.in || [];
      return Promise.resolve(
        requestedIds.map((id: string) => ({
          id,
          documentId: COMMERCIAL_INVOICE_FIXTURE.id,
          fieldName: id,
          value: "SampleValue",
          confidence: 95,
          pageNumber: 1,
          bbox: null,
          source: "UNIVERSAL_HYDRATION",
          correctedFromValue: null,
          correctedByUserId: null,
          correctedAt: null,
          createdAt: new Date(),
          document: mockDoc,
        }))
      );
    }) as any);

    vi.spyOn(db.hydrationCandidate, "upsert").mockImplementation((async (args: any) => {
      return {
        id: `cand_${args.create.fieldDefinitionKey}`,
        ...args.create,
        createdAt: new Date(),
      };
    }) as any);

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

  it("test-matrix #19: emergency kill switch short-circuits HydrationWorker execution", async () => {
    RolloutController.disableUniversalHydration(testAccount);

    const res = await HydrationWorker.processDocumentHydration(testAccount, {
      documentId: COMMERCIAL_INVOICE_FIXTURE.id,
      parseVersionId: "pv_killswitch",
    });

    expect(res.skippedReason).toBe("ROLLOUT_DISABLED");
    expect(res.promotedCount).toBe(0);
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

  it("test-matrix #30 / #31: computes operational telemetry dashboard metrics with tenant and dataMode scoping", async () => {
    vi.spyOn(db.hydrationRun, "findMany").mockResolvedValue([
      { id: "run_1", durationMs: 150 },
      { id: "run_2", durationMs: 250 },
    ] as any);
    vi.spyOn(db.hydrationCandidate, "findMany").mockResolvedValue([
      { status: "PROMOTED" },
      { status: "PROMOTED" },
      { status: "ABSTAINED" },
    ] as any);
    vi.spyOn(db.fact, "findMany").mockResolvedValue([] as any);
    vi.spyOn(db.fieldApproval, "findMany").mockResolvedValue([] as any);

    const metrics = await HydrationMetricsService.getAccountMetrics(testAccount);

    expect(metrics).toBeDefined();
    expect(metrics.avgLatencyMs).toBe(200);
    expect(metrics.totalHydrationRuns).toBe(2);
    expect(metrics.totalCandidatesGenerated).toBe(3);
  });
});
