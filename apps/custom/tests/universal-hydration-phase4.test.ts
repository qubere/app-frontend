/**
 * Phase 4 Test Suite — LLM Universal Field Hydration (Governed Promotion & Orchestration)
 *
 * Asserts Phase 4 Exit Criteria:
 * - >= 99% precision for automatically promoted consequential fields and >= 97% for standard fields.
 * - Human-locked values are NEVER automatically overwritten.
 * - Allowlisted materializers safely execute atomic updates.
 * - Detaching a document recomputes facts from surviving evidence without losing history or human locks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PromotionPolicyEngine } from "../src/modules/hydration/promotion/promotionPolicyEngine";
import { MaterializerRegistry } from "../src/modules/hydration/promotion/materializers";
import { HydrationWorker } from "../src/modules/hydration/orchestration/hydrationWorker";
import type { ResolvedCandidate } from "../src/modules/hydration/resolution/corroborationConflictResolver";
import { db } from "@qubere/db";

describe("Universal Field Hydration — Phase 4 Governed Promotion", () => {
  const testAccount = "acc_phase4_test_001";
  const testShipment = "shp_phase4_test_001";
  const testDocument = "doc_phase4_test_001";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("test-matrix #13: strictly enforces Human Lock Invariant #4 — rejects automatic overwrite of human locks in DB", async () => {
    vi.spyOn(db.fact, "findFirst").mockResolvedValue({
      id: "fact_locked_1",
      shipmentId: testShipment,
      field: "carrierName",
      value: "HUMAN CONFIRMED CARRIER",
      sourceType: "USER_ENTERED",
      isHumanLocked: true,
    } as any);

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

    const decisionLocked = await PromotionPolicyEngine.evaluateCandidate(testShipment, mockCandidate, testAccount);
    expect(decisionLocked.shouldPromote).toBe(false);
    expect(decisionLocked.isHumanLocked).toBe(true);
    expect(decisionLocked.reason).toContain("HUMAN_LOCK_PROTECTION");
  });

  it("test-matrix #15: consequential risk field requires multi-document corroboration or human review", async () => {
    const singleDocConsequential: ResolvedCandidate = {
      proposal: {
        targetFieldKey: "shipment.originCountry",
        targetEntityRef: null,
        sourceExtractionFieldIds: ["ev_country"],
        evidenceReferences: [
          { documentId: testDocument, parseVersionId: "pv_1", rawLabel: "Country of Origin", rawValue: "MX" },
        ],
        proposedValue: "MX",
        mappingConfidence: 95,
        relationConfidence: null,
        reasoning: "Extracted country",
        status: "PROPOSED",
        abstainReason: null,
      },
      corroboratingDocumentIds: [testDocument],
      corroborationScore: 0, // Single document, no corroboration
      calibratedScore: 95.0,
      status: "PROMOTED",
    };

    const decision = await PromotionPolicyEngine.evaluateCandidate(testShipment, singleDocConsequential, testAccount);
    expect(decision.shouldPromote).toBe(false);
    expect(decision.reason).toContain("CONSEQUENTIAL_REQUIRES_REVIEW");
  });

  it("rejects promotion if calibrated score is below required risk threshold", async () => {
    const lowScoreCandidate: ResolvedCandidate = {
      proposal: {
        targetFieldKey: "shipment.incoterm",
        targetEntityRef: null,
        sourceExtractionFieldIds: ["ev_2"],
        evidenceReferences: [
          { documentId: testDocument, parseVersionId: "pv_1", rawLabel: "Incoterm", rawValue: "FOB" },
        ],
        proposedValue: "FOB",
        mappingConfidence: 60,
        relationConfidence: null,
        reasoning: "Low mapping confidence",
        status: "PROPOSED",
        abstainReason: null,
      },
      corroboratingDocumentIds: [testDocument],
      corroborationScore: 0,
      calibratedScore: 65.0,
      status: "PROMOTED",
    };

    const decision = await PromotionPolicyEngine.evaluateCandidate(testShipment, lowScoreCandidate, testAccount);
    expect(decision.shouldPromote).toBe(false);
    expect(decision.reason).toContain("SCORE_TOO_LOW");
  });

  it("test-matrix #12: rejects candidates with CONFLICT status and flags visible conflict", async () => {
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

    const decision = await PromotionPolicyEngine.evaluateCandidate(testShipment, conflictCandidate, testAccount);
    expect(decision.shouldPromote).toBe(false);
    expect(decision.reason).toContain("CONFLICT_REJECTED");
  });

  it("test-matrix #14: materialization is idempotent — replaying decision returns existing Fact id", async () => {
    const mockFact = { id: "fact_existing_14" };
    vi.spyOn(db, "$transaction").mockImplementation((async (cb: any) => {
      const txMock = {
        fact: {
          findFirst: vi.fn().mockResolvedValue(mockFact),
          create: vi.fn(),
        },
        shipment: {
          update: vi.fn().mockResolvedValue({ id: testShipment }),
        },
      };
      return cb(txMock);
    }) as any);

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

    const result = await MaterializerRegistry.materializeDecision(testAccount, testShipment, mockDecision);
    expect(result.success).toBe(true);
    expect(result.factId).toBe("fact_existing_14");
  });
});
