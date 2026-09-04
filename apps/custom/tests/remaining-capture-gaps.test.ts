import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOrCreateEntity: vi.fn(),
  assignParty: vi.fn(),
}));

vi.mock("@/modules/entity/entityResolutionService", () => ({
  EntityResolutionService: {
    findOrCreateEntity: mocks.findOrCreateEntity,
  },
}));

vi.mock("@/modules/shipment/shipmentPartyService", () => ({
  ShipmentPartyService: {
    assignParty: mocks.assignParty,
  },
}));

vi.mock("@qubere/db", () => ({
  db: {
    $transaction: vi.fn((cb) => cb({
      fact: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "fact_100" }),
      },
    })),
  },
}));

const { MaterializerRegistry } = await import("../src/modules/hydration/promotion/materializers");

describe("Remaining Capture Entry Points (#343 Phase 5)", () => {
  const accountId = "acc_test_capture_gaps";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Hydration PartyRoleMaterializer threads the hydration tx through to findOrCreateEntity", async () => {
    mocks.findOrCreateEntity.mockResolvedValue({ id: "entity_999", legalName: "Acme Supply Corp" });
    mocks.assignParty.mockResolvedValue({ id: "shp_party_1" });

    const decision: any = {
      shouldPromote: true,
      reason: "High confidence score",
      candidate: {
        proposal: {
          targetFieldKey: "party.exporter.name",
          proposedValue: "Acme Supply Corp",
          evidenceReferences: [{ documentId: "doc_123" }],
        },
        calibratedScore: 95,
      },
    };

    const result = await MaterializerRegistry.materializeDecision(
      accountId,
      "shipment_123",
      decision
    );

    expect(result.success).toBe(true);
    // Passing `tx` here is required: findOrCreateEntity skips
    // resolvePartyForCompany/Restricted Party Screening only when it knows
    // it's nested inside this hydration transaction. Without it, that extra
    // work runs on a separate connection inside the transaction's lock hold,
    // and any LegalEntity/Party it creates isn't rolled back if the
    // transaction later fails its Shipment.version check.
    expect(mocks.findOrCreateEntity).toHaveBeenCalledWith(accountId, "Acme Supply Corp", undefined, expect.anything());
    expect(mocks.assignParty).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: "shipment_123",
        legalEntityId: "entity_999",
        role: "EXPORTER",
      }),
      expect.anything()
    );
  });
});
