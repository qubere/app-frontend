import { describe, it, expect } from "vitest";
import { computeShipmentLifecycleStatus } from "../src/modules/shipments/services/shipmentLifecycleStatus";

describe("Shipment Lifecycle Ribbon Integration Verification", () => {
  it("computes lifecycle stage correctly for a multi-leg FTL + Drayage shipment", () => {
    const shipment: any = {
      id: "sh_multileg_123",
      shipmentNumber: "SH-2026-8819",
      status: "IN_TRANSIT",
      createdAt: new Date("2026-08-15"),
      tenders: [
        { id: "t_1", status: "ACCEPTED", carrierId: "c_apex" }
      ],
      shipmentMovements: [
        {
          movement: {
            id: "mov_ocean",
            mode: "OCEAN",
            status: "ARRIVED",
            actualStart: new Date("2026-08-16"),
          }
        },
        {
          movement: {
            id: "mov_dray",
            mode: "DRAYAGE",
            status: "IN_TRANSIT",
            actualStart: new Date("2026-08-22"),
          }
        }
      ],
      customsFilings: [
        { id: "cf_1", filingStatus: "Released", releasedAt: new Date("2026-08-21") }
      ],
      proofOfDeliveries: [],
      carrierInvoices: [
        { id: "ci_1", matchStatus: "PENDING", settlementStatus: "PENDING" }
      ]
    };

    const lifecycle = computeShipmentLifecycleStatus(shipment);

    expect(lifecycle.stages).toHaveLength(9);
    expect(lifecycle.stages[0].label).toBe("Draft / Order Created");
    expect(lifecycle.stages[0].state).toBe("COMPLETE");

    expect(lifecycle.stages[1].label).toBe("Sourcing / Tendering");
    expect(lifecycle.stages[1].state).toBe("COMPLETE");

    expect(lifecycle.stages[2].label).toBe("Booked / Scheduled");
    expect(lifecycle.stages[2].state).toBe("COMPLETE");

    expect(lifecycle.stages[3].label).toBe("Customs Cleared");
    expect(lifecycle.stages[3].state).toBe("COMPLETE");
    expect(lifecycle.stages[3].detail).toContain("Customs entry cleared");

    expect(lifecycle.stages[4].label).toBe("Dispatched / At Pickup");
    expect(lifecycle.stages[4].state).toBe("COMPLETE");

    expect(lifecycle.stages[5].label).toBe("In Transit");
    expect(lifecycle.stages[5].state).toBe("ACTIVE");
    expect(lifecycle.stages[5].movements).toHaveLength(2);

    expect(lifecycle.stages[6].label).toBe("Arrived");
    expect(lifecycle.stages[6].state).toBe("ACTIVE");
    expect(lifecycle.stages[6].detail).toContain("Arrived at destination facility");

    expect(lifecycle.stages[7].label).toBe("Delivered / POD Uploaded");
    expect(lifecycle.stages[7].state).toBe("ACTIVE");
    expect(lifecycle.stages[7].detail).toContain("awaiting POD upload");

    expect(lifecycle.stages[8].label).toBe("Audited & Settled");
    expect(lifecycle.stages[8].state).toBe("ACTIVE");
    expect(lifecycle.stages[8].detail).toContain("audit matching in progress");

    expect(lifecycle.currentStageIndex).toBe(5);
  });
});
