import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateAutonomyPolicy } from "../src/modules/autonomy/services/policyEngineService";
import { runTrackingEtaAgent, runExceptionResolutionAgent } from "../src/modules/agents/services/operationalAgents";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    shipment: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    agentDecision: {
      create: vi.fn(),
    },
    transportationEvent: {
      create: vi.fn(),
    },
    etaObservation: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    agentPolicyConfig: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@qubere/db", () => ({ db: dbMock }));

const mockContext: any = {
  userId: "user_123",
  accountId: "acc_999",
};

describe("Phase 6 — Agentic Operations & Autonomy Policy Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    dbMock.agentDecision.create.mockImplementation(async ({ data }: any) => ({
      id: "dec_601",
      ...data,
    }));

    dbMock.transportationEvent.create.mockImplementation(async ({ data }: any) => ({
      id: "evt_601",
      ...data,
    }));
    dbMock.agentPolicyConfig.findUnique.mockResolvedValue(null);
  });

  it("evaluates tenant autonomy policy rules accurately", async () => {
    // A missing tenant policy denies execution by default.
    const defaultResult = await evaluateAutonomyPolicy(mockContext, {
      actionType: "AUTO_QUOTE",
      financialAmount: 3450,
      confidenceScore: 92,
    });
    expect(defaultResult.allowed).toBe(false);
    expect(defaultResult.gate).toBe("AUTONOMY_MODE_SUPERVISED");

    // Explicit tenant opt-in permits a high-confidence action under the cap.
    const autoQuoteResult = await evaluateAutonomyPolicy(mockContext, {
      actionType: "AUTO_QUOTE",
      financialAmount: 3450,
      confidenceScore: 92,
      policyOverride: {
        autonomyMode: "BALANCED",
        allowedAutoActions: ["AUTO_QUOTE"],
      },
    });
    expect(autoQuoteResult.allowed).toBe(true);
    expect(autoQuoteResult.triageState).toBe("AUTO_VERIFIED");

    // Financial amount > $5000 cap still requires review.
    const highCapResult = await evaluateAutonomyPolicy(mockContext, {
      actionType: "AUTO_TENDER",
      financialAmount: 7500,
      confidenceScore: 95,
      policyOverride: {
        autonomyMode: "BALANCED",
        allowedAutoActions: ["AUTO_TENDER"],
      },
    });
    expect(highCapResult.allowed).toBe(false);
    expect(highCapResult.triageState).toBe("NEEDS_HUMAN_REVIEW");

    // Explicitly forbidden actions remain blocked even when allowlisted.
    const forbiddenResult = await evaluateAutonomyPolicy(mockContext, {
      actionType: "CUSTOMS_HOLD_OVERRIDE",
      confidenceScore: 99,
      policyOverride: {
        autonomyMode: "AUTONOMOUS",
        allowedAutoActions: ["CUSTOMS_HOLD_OVERRIDE"],
      },
    });
    expect(forbiddenResult.allowed).toBe(false);
    expect(forbiddenResult.triageState).toBe("NEEDS_HUMAN_REVIEW");
  });

  it("monitors tracking signals, detects port delay, and recalculates ETA", async () => {
    const initialEta = new Date("2026-08-25T00:00:00Z");
    const providerEta = new Date("2026-08-27T00:00:00Z");
    dbMock.shipment.findFirst
      .mockResolvedValueOnce({
        id: "shp_601",
        accountId: "acc_999",
        estimatedArrival: initialEta,
        trackingEvents: [
          {
            id: "track_601",
            eventType: "PORT_DELAY",
            occurredAt: new Date(),
            receivedAt: new Date(),
            normalizedData: { estimatedArrival: providerEta.toISOString() },
            confidence: 95,
          },
        ],
        etaObservations: [],
        customsFilings: [],
      })
      .mockResolvedValueOnce({
        customerPromiseDate: null,
        estimatedArrival: providerEta,
      });
    dbMock.agentPolicyConfig.findUnique.mockResolvedValueOnce({
      autonomyMode: "BALANCED",
      autoThreshold: 80,
      financialThreshold: 5000,
      marginThreshold: 10,
      allowedAutoActions: ["UPDATE_ETA"],
      forbiddenAutoActions: [],
      carrierApprovalRequired: false,
      requireInsurance: false,
      requireCustomsRelease: false,
      requireHumanApproval: false,
    });
    dbMock.etaObservation.findFirst.mockResolvedValueOnce({ eta: providerEta, confidence: 95 });
    dbMock.etaObservation.create.mockResolvedValueOnce({ id: "eta_601" });

    const result = await runTrackingEtaAgent(mockContext, "shp_601");

    expect(result.delayDetected).toBe(true);
    expect(dbMock.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "shp_601" },
        data: expect.objectContaining({
          estimatedArrival: expect.any(Date),
        }),
      })
    );
    expect(result.updatedEta).toEqual(providerEta);
    expect(dbMock.transportationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "ETA_CHANGED",
        }),
      })
    );
  });

  it("detects customs hold and escalates to human supervisor workbench", async () => {
    dbMock.shipment.findFirst.mockResolvedValueOnce({
      id: "shp_602",
      accountId: "acc_999",
      exceptionItems: [{ type: "CUSTOMS_HOLD", status: "OPEN" }],
      customsFilings: [{ filingStatus: "CustomsHold" }],
    });

    const result = await runExceptionResolutionAgent(mockContext, "shp_602");

    expect(result.resolutionAction).toBe("ESCALATED_CUSTOMS_HOLD");
    expect(result.triageState).toBe("NEEDS_HUMAN_REVIEW");
    expect(dbMock.agentDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          triageState: "NEEDS_HUMAN_REVIEW",
          agentName: "Exception Resolution Agent",
        }),
      })
    );
  });
});
