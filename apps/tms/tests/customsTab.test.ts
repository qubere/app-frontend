import { describe, it, expect } from "vitest";
import { computeShipmentLifecycleStatus } from "../src/modules/shipments/services/shipmentLifecycleStatus";

describe("Customs Tab & Ribbon Deep Link Logic", () => {
  it("computes stage 3 as Customs Cleared for ribbon deep-linking", () => {
    const shipment: any = {
      status: "IN_TRANSIT",
      tenders: [{ status: "ACCEPTED" }],
      shipmentMovements: [{ movement: { id: "m1", mode: "TRUCK", status: "BOOKED" } }],
      customsFilings: [{ filingStatus: "Released" }],
      proofsOfDelivery: [],
      carrierInvoices: [],
    };

    const status = computeShipmentLifecycleStatus(shipment);
    expect(status.stages[3].label).toBe("Customs Cleared");
  });
});
