import { describe, it, expect } from "vitest";
import {
  mapPortalShipmentStatus,
  mapPortalFreightStatus,
} from "./portal-status-mapper";

describe("Portal Status Mapper", () => {
  it("should map internal tracking and customs states to clean customer statuses", () => {
    const result = mapPortalShipmentStatus({
      internalStatus: "IN_PROGRESS",
      filingStatus: "Transmitted",
      trackingStatus: "IN_TRANSIT",
      openCustomerRequestCount: 0,
    });

    expect(result.transportationStatus).toBe("In transit");
    expect(result.customsStatus).toBe("Filed with customs");
    expect(result.hasCustomerActionRequired).toBe(false);
    expect(result.actionRequiredCount).toBe(0);
  });

  it("should prioritize open customer requests over internal customs status", () => {
    const result = mapPortalShipmentStatus({
      internalStatus: "IN_PROGRESS",
      filingStatus: "Draft",
      trackingStatus: "IN_TRANSIT",
      openCustomerRequestCount: 2,
    });

    expect(result.customsStatus).toBe("Documents needed");
    expect(result.hasCustomerActionRequired).toBe(true);
    expect(result.actionRequiredCount).toBe(2);
  });

  it("should correctly map delivered and released states", () => {
    const result = mapPortalShipmentStatus({
      internalStatus: "Completed",
      filingStatus: "Released",
      trackingStatus: "DELIVERED",
      openCustomerRequestCount: 0,
    });

    expect(result.transportationStatus).toBe("Delivered");
    expect(result.customsStatus).toBe("Released");
  });

  it("should map TMS freight movement statuses accurately", () => {
    expect(mapPortalFreightStatus("DISPATCHED")).toBe("Dispatched");
    expect(mapPortalFreightStatus("IN_TRANSIT")).toBe("In Transit");
    expect(mapPortalFreightStatus("ARRIVED_STOP_1")).toBe("Arrived at Stop");
    expect(mapPortalFreightStatus("DELIVERED_POD")).toBe("POD Received");
  });
});

it('does not claim customs release for an accepted entry',()=>{
 expect(mapPortalShipmentStatus({internalStatus:'In Progress',filingStatus:'Accepted',openCustomerRequestCount:0}).customsStatus).toBe('Filed with customs');
});
it('keeps a released entry released when a customer question is open',()=>{
 const status=mapPortalShipmentStatus({internalStatus:'Completed',filingStatus:'Released',openCustomerRequestCount:1});
 expect(status.customsStatus).toBe('Released');expect(status.hasCustomerActionRequired).toBe(true);
});
