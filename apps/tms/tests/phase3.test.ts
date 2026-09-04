import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getShipmentWorkspaceDetails,
  computeMultimodalJourney,
  evaluateCrossDomainRisks,
} from "../src/modules/shipments/services/shipmentWorkspaceService";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    shipment: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@qubere/db", () => ({ db: dbMock }));

const mockContext: any = {
  userId: "user_123",
  accountId: "acc_999",
};

describe("Phase 3 — Unified Shipment Workspace & Cross-Domain Intelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes multimodal journey timeline steps for an ocean import", () => {
    const shipment: any = {
      transportMode: "OCEAN",
      countryOfExport: "CNSHA",
      carrierName: "MSC OSCAR",
      portOfEntry: "USOAK",
      estimatedArrival: new Date("2026-08-25"),
      arrivalDate: new Date("2026-08-25"),
      customsFilings: [{ filingStatus: "RELEASED" }],
      transportLegs: [{
        id: "leg_1",
        mode: "OCEAN",
        originName: "Shanghai",
        destinationName: "Oakland",
        destinationUnlocode: "USOAK",
        actualArrival: new Date("2026-08-25"),
      }],
    };

    const journey = computeMultimodalJourney(shipment);

    expect(journey).toHaveLength(2);
    expect(journey[0].name).toBe("OCEAN leg");
    expect(journey[0].status).toBe("COMPLETED");
    expect(journey[1].name).toBe("Customs Clearance");
    expect(journey[1].status).toBe("COMPLETED");
  });

  it("evaluates cross-domain risk: CUSTOMS_BLOCKING_DELIVERY when container is available but Customs is unreleased", () => {
    const shipment: any = {
      estimatedArrival: new Date("2026-08-20"),
      arrivalDate: new Date("2026-08-20"),
      customsFilings: [{ filingStatus: "IN_PROGRESS" }], // Customs NOT released yet!
      complianceDeadlines: [],
    };

    const risks = evaluateCrossDomainRisks(shipment);

    expect(risks).toHaveLength(1);
    expect(risks[0].code).toBe("CUSTOMS_BLOCKING_DELIVERY");
    expect(risks[0].severity).toBe("CRITICAL");
  });

  it("aggregates workspace details, movements, customs state, and financials", async () => {
    dbMock.shipment.findFirst.mockResolvedValueOnce({
      id: "shp_100",
      accountId: "acc_999",
      shipmentNumber: "SHP-2026-004872",
      importerName: "Acme Imports Inc",
      transportMode: "OCEAN",
      invoiceCurrency: "USD",
      customsFilings: [{ filingStatus: "RELEASED" }],
      shipmentMovements: [],
      shipmentCharges: [{ netAmount: 4500 }],
      shipmentCosts: [{ amount: 3200 }],
    });

    const workspace = await getShipmentWorkspaceDetails(mockContext, "shp_100");

    expect(dbMock.shipment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: "acc_999", id: "shp_100" },
      })
    );
    expect(workspace?.shipment.shipmentNumber).toBe("SHP-2026-004872");
    expect(workspace?.financials.totalSellAmount).toBe(4500);
    expect(workspace?.financials.totalBuyAmount).toBe(3200);
    expect(workspace?.financials.margin).toBe(1300);
  });
});
