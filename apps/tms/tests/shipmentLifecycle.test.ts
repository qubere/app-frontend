import { describe, it, expect } from "vitest";
import { computeShipmentLifecycleStatus } from "../src/modules/shipments/services/shipmentLifecycleStatus";

describe("Shipment Lifecycle Status Ribbon Calculation", () => {
  it("computes status for a Draft-only shipment", () => {
    const shipment: any = {
      status: "Draft",
      createdAt: new Date("2026-08-23"),
      tenders: [],
      shipmentMovements: [],
      customsFilings: [],
      proofsOfDelivery: [],
      carrierInvoices: [],
    };

    const result = computeShipmentLifecycleStatus(shipment);

    expect(result.stages).toHaveLength(9);
    expect(result.currentStageIndex).toBe(0);
    expect(result.stages[0].state).toBe("ACTIVE");
    expect(result.stages[0].label).toBe("Draft / Order Created");
    expect(result.stages[1].state).toBe("UPCOMING");
  });

  it("computes status for a booked single-leg shipment", () => {
    const shipment: any = {
      status: "BOOKED",
      createdAt: new Date("2026-08-20"),
      tenders: [{ status: "ACCEPTED", carrierId: "c_1" }],
      shipmentMovements: [
        {
          movement: {
            id: "m_1",
            mode: "TRUCK",
            status: "BOOKED",
          },
        },
      ],
      customsFilings: [],
      proofsOfDelivery: [],
      carrierInvoices: [],
    };

    const result = computeShipmentLifecycleStatus(shipment);

    expect(result.stages[0].state).toBe("COMPLETE");
    expect(result.stages[1].state).toBe("COMPLETE");
    expect(result.stages[2].state).toBe("ACTIVE");
    expect(result.currentStageIndex).toBe(2);
    expect(result.stages[2].label).toBe("Booked / Scheduled");
  });

  it("computes status for a multi-leg shipment mid-transit with movement details", () => {
    const shipment: any = {
      status: "IN_TRANSIT",
      tenders: [{ status: "ACCEPTED" }],
      shipmentMovements: [
        {
          movement: {
            id: "m_ocean",
            mode: "OCEAN",
            status: "ARRIVED",
          },
        },
        {
          movement: {
            id: "m_dray",
            mode: "DRAYAGE",
            status: "IN_TRANSIT",
          },
        },
      ],
      customsFilings: [{ filingStatus: "Released", releasedAt: new Date("2026-08-22") }],
      proofsOfDelivery: [],
      carrierInvoices: [],
    };

    const result = computeShipmentLifecycleStatus(shipment);

    expect(result.stages[0].state).toBe("COMPLETE");
    expect(result.stages[1].state).toBe("COMPLETE");
    expect(result.stages[2].state).toBe("COMPLETE");
    expect(result.stages[3].state).toBe("COMPLETE"); // Customs Cleared
    expect(result.stages[4].state).toBe("COMPLETE"); // Dispatched
    expect(result.stages[5].state).toBe("ACTIVE");   // In Transit
    expect(result.currentStageIndex).toBe(5);

    // Verify multi-leg breakdown present
    expect(result.stages[5].movements).toHaveLength(2);
    expect(result.stages[5].movements?.[0].mode).toBe("OCEAN");
    expect(result.stages[5].movements?.[1].mode).toBe("DRAYAGE");
  });

  it("handles customs hold / blocked state", () => {
    const shipment: any = {
      status: "BOOKED",
      tenders: [{ status: "ACCEPTED" }],
      shipmentMovements: [{ movement: { id: "m_1", mode: "TRUCK", status: "BOOKED" } }],
      customsFilings: [{ filingStatus: "CustomsHold" }],
      proofsOfDelivery: [],
      carrierInvoices: [],
    };

    const result = computeShipmentLifecycleStatus(shipment);

    expect(result.stages[3].state).toBe("BLOCKED");
    expect(result.stages[3].detail).toContain("Customs hold");
  });

  it("computes status for a fully delivered, audited, and settled shipment", () => {
    const shipment: any = {
      status: "Completed",
      tenders: [{ status: "ACCEPTED" }],
      shipmentMovements: [{ movement: { id: "m_1", mode: "TRUCK", status: "DELIVERED" } }],
      customsFilings: [{ filingStatus: "Released", releasedAt: new Date("2026-08-21") }],
      proofsOfDelivery: [{ id: "pod_1", deliveredAt: new Date("2026-08-22") }],
      carrierInvoices: [
        {
          id: "inv_1",
          matchStatus: "MATCHED",
          settlementStatus: "PAID",
          settledAt: new Date("2026-08-23"),
        },
      ],
    };

    const result = computeShipmentLifecycleStatus(shipment);

    expect(result.stages.every((s) => s.state === "COMPLETE")).toBe(true);
    expect(result.currentStageIndex).toBe(8); // Last stage
    expect(result.stages[8].label).toBe("Audited & Settled");
    expect(result.stages[8].detail).toContain("settled");
  });
});
