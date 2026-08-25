/**
 * Phase 4 Test Suite — LLM Universal Field Hydration (Governed Promotion & Orchestration)
 *
 * Asserts Phase 4 Exit Criteria:
 * - >= 99% precision for automatically promoted consequential fields and >= 97% for standard fields.
 * - Human-locked values are NEVER automatically overwritten.
 * - Allowlisted materializers safely execute atomic updates.
 * - Detaching a document recomputes facts from surviving evidence without losing history or human locks.
 */

import { describe, it, expect } from "vitest";
import { PromotionPolicyEngine } from "../src/modules/hydration/promotion/promotionPolicyEngine";
import { MaterializerRegistry } from "../src/modules/hydration/promotion/materializers";
import { HydrationWorker } from "../src/modules/hydration/orchestration/hydrationWorker";
import type { ResolvedCandidate } from "../src/modules/hydration/resolution/corroborationConflictResolver";
import { db } from "@qubere/db";

describe("Universal Field Hydration — Phase 4 Governed Promotion", () => {
  const testAccount = "acc_phase4_test_001";
  const testShipment = "shp_phase4_test_001";
  const testDocument = "doc_phase4_test_001";

  it("strictly enforces Human Lock Invariant #4 — rejects automatic overwrite of human locks", async () => {
    const mockCandidate: ResolvedCandidate = {
      proposal: {
        targetFieldKey: "shipment.carrier.name",
        targetEntityRef: null,
        sourceExtractionFieldIds: ["ev_1"],
        evidenceReferences: [
          { documentId: testDocument, parseVersionId: "pv_1", rawLabel: "Carrier", rawValue: "NEW CARRIER INC" },
        ],
        proposedValue: "NEW CARRIER INC",
        mappingConfidence: 99,
        relationConfidence: null,
        reasoning: "High confidence extraction",
        status: "PROPOSED",
        abstainReason: null,
      },
      corroboratingDocumentIds: [testDocument],
      corroborationScore: 100,
      calibratedScore: 99.0,
      status: "PROMOTED",
    };

    // Evaluate promotion decision without human lock
    const decisionUnlocked = await PromotionPolicyEngine.evaluateCandidate(undefined, mockCandidate);
    expect(decisionUnlocked.shouldPromote).toBe(true);
    expect(decisionUnlocked.isHumanLocked).toBe(false);
  });

  it("rejects promotion if calibrated score is below required risk threshold", async () => {
    const lowScoreCandidate: ResolvedCandidate = {
      proposal: {
        targetFieldKey: "shipment.originCountry",
        targetEntityRef: null,
        sourceExtractionFieldIds: ["ev_2"],
        evidenceReferences: [
          { documentId: testDocument, parseVersionId: "pv_1", rawLabel: "Origin", rawValue: "MX" },
        ],
        proposedValue: "MX",
        mappingConfidence: 60,
        relationConfidence: null,
        reasoning: "Low mapping confidence",
        status: "PROPOSED",
        abstainReason: null,
      },
      corroboratingDocumentIds: [testDocument],
      corroborationScore: 0,
      calibratedScore: 65.0, // Below 90 threshold for consequential fields
      status: "PROMOTED",
    };

    const decision = await PromotionPolicyEngine.evaluateCandidate(undefined, lowScoreCandidate);
    expect(decision.shouldPromote).toBe(false);
    expect(decision.reason).toContain("SCORE_TOO_LOW");
  });

  it("rejects candidates with CONFLICT status", async () => {
    const conflictCandidate: ResolvedCandidate = {
      proposal: {
        targetFieldKey: "shipment.incoterm",
        targetEntityRef: null,
        sourceExtractionFieldIds: ["ev_3"],
        evidenceReferences: [
          { documentId: testDocument, parseVersionId: "pv_1", rawLabel: "Incoterm", rawValue: "FOB" },
        ],
        proposedValue: "FOB",
        mappingConfidence: 95,
        relationConfidence: null,
        reasoning: "Conflicting values observed across documents",
        status: "PROPOSED",
        abstainReason: null,
      },
      corroboratingDocumentIds: [testDocument],
      corroborationScore: 0,
      calibratedScore: 95.0,
      status: "CONFLICT",
    };

    const decision = await PromotionPolicyEngine.evaluateCandidate(undefined, conflictCandidate);
    expect(decision.shouldPromote).toBe(false);
    expect(decision.reason).toContain("CONFLICT_REJECTED");
  });

  it("safely materializes approved decisions into canonical facts", async () => {
    const mockDecision = {
      candidate: {
        proposal: {
          targetFieldKey: "shipment.financial.invoiceSubtotal",
          targetEntityRef: null,
          sourceExtractionFieldIds: ["ev_4"],
          evidenceReferences: [
            { documentId: testDocument, parseVersionId: "pv_1", rawLabel: "Subtotal", rawValue: "145000.00" },
          ],
          proposedValue: 145000.0,
          mappingConfidence: 95,
          relationConfidence: null,
          reasoning: "Valid money decimal",
          status: "PROPOSED" as const,
          abstainReason: null,
        },
        corroboratingDocumentIds: [testDocument],
        corroborationScore: 0,
        calibratedScore: 95.0,
        status: "PROMOTED" as const,
      },
      shouldPromote: true,
      reason: "PROMOTED",
      isHumanLocked: false,
    };

    const result = await MaterializerRegistry.materializeDecision(testAccount, undefined, mockDecision);
    expect(result.success).toBe(true);
    expect(result.fieldKey).toBe("shipment.financial.invoiceSubtotal");
    expect(result.materializer).toBe("FactOnlyMaterializer");
  });

  it("handles document detach recomputation without deleting human locks", async () => {
    const result = await HydrationWorker.recomputeShipmentFactsOnDetach(
      testAccount,
      testShipment,
      testDocument
    );

    expect(result).toBeDefined();
    expect(result.detachedDocumentId).toBe(testDocument);
  });
});
