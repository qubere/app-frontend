import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateCarriersForShipment } from "../src/modules/carriers/services/carrierSelectionService";
import { createTenderDraft } from "../src/modules/tenders/services/tenderService";
import { scheduleAppointment } from "../src/modules/movement/services/appointmentService";
import { ingestRawTrackingSignal } from "../src/modules/tracking/services/trackingProviderService";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    carrierProfile: {
      findMany: vi.fn(),
    },
    carrier: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    freightQuote: { findFirst: vi.fn() },
    tender: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    movementStop: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    shipment: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    trackingProviderDefinition: {
      findUnique: vi.fn(),
    },
    agentDecision: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    transportationEvent: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@qubere/db", () => ({ db: dbMock }));

const mockContext: any = {
  userId: "user_123",
  accountId: "acc_999",
};

describe("Phase 5 — Execution Engine (Carrier Scoring, Tenders, Fallback Cascade, Appointments & Tracking)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    dbMock.tender.create.mockImplementation(async ({ data }: any) => ({
      id: "ten_501",
      ...data,
    }));

    dbMock.tender.update.mockImplementation(async ({ data }: any) => ({
      id: "ten_501",
      ...data,
    }));

    dbMock.agentDecision.create.mockImplementation(async ({ data }: any) => ({
      id: "dec_501",
      ...data,
    }));

    dbMock.auditLog.create.mockImplementation(async ({ data }: any) => ({
      id: "audit_501",
      ...data,
    }));

    dbMock.transportationEvent.create.mockImplementation(async ({ data }: any) => ({
      id: "evt_501",
      ...data,
    }));
    dbMock.tender.findMany.mockResolvedValue([]);
  });

  it("evaluates carrier profiles and ranks options based on insurance, safety status, and metrics", async () => {
    dbMock.carrierProfile.findMany.mockResolvedValueOnce([
      {
        id: "prof_1",
        partyId: "party_swift",
        scac: "SWFT",
        insuranceStatus: "ACTIVE",
        safetyStatus: "SATISFACTORY",
        preferredStatus: true,
        modes: ["OCEAN"],
        equipmentCapabilities: ["40HC"],
        performanceMetrics: { onTimeDeliveryRate: 98 },
        party: { names: [{ rawName: "Swift Ocean Trans" }] },
      },
      {
        id: "prof_2",
        partyId: "party_slow",
        scac: "SLOW",
        insuranceStatus: "INACTIVE",
        safetyStatus: "SATISFACTORY",
        preferredStatus: false,
        modes: ["OCEAN"],
        equipmentCapabilities: ["40HC"],
        performanceMetrics: { onTimeDeliveryRate: 70 },
        party: { names: [{ rawName: "Slow Freight" }] },
      },
    ]);
    dbMock.carrier.findMany.mockResolvedValueOnce([
      { id: "car_swift", scac: "SWFT", status: "ACTIVE" },
      { id: "car_slow", scac: "SLOW", status: "ACTIVE" },
    ]);

    const ranked = await evaluateCarriersForShipment(mockContext, { mode: "OCEAN", requireInsurance: true });

    expect(ranked[0].carrierId).toBe("car_swift");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(ranked[0].isEligible).toBe(true);
  });

  it("creates an unsent tender draft pending a real carrier-provider acknowledgement", async () => {
    dbMock.shipment.findFirst.mockResolvedValueOnce({ id: "shp_500", transportMode: "OCEAN" });
    dbMock.carrier.findFirst.mockResolvedValueOnce({
      id: "car_fast",
      status: "ACTIVE",
      insuranceOnFile: true,
    });

    const result = await createTenderDraft(mockContext, {
      shipmentId: "shp_500",
      carrierId: "car_fast",
    });

    expect(result.dispatched).toBe(false);
    expect(dbMock.tender.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          carrierId: "car_fast",
          status: "DRAFT",
        }),
      })
    );
    expect(dbMock.tender.create.mock.calls[0][0].data.sentAt).toBeUndefined();
    expect(dbMock.transportationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "TENDER_DRAFTED" }),
      })
    );
  });

  it("schedules facility appointment for a movement stop", async () => {
    dbMock.movementStop.findFirst.mockResolvedValueOnce({
      id: "stop_501",
      accountId: "acc_999",
      movementId: "mov_501",
      locationName: "Oakland Terminal Pier 55",
    });

    dbMock.movementStop.update.mockResolvedValueOnce({
      id: "stop_501",
      status: "CONFIRMED",
      locationName: "Oakland Terminal Pier 55",
      unlocode: "USOAK",
    });

    const updated = await scheduleAppointment(mockContext, {
      movementStopId: "stop_501",
      appointmentStart: new Date("2026-08-25T08:00:00Z"),
      appointmentEnd: new Date("2026-08-25T10:00:00Z"),
      unlocode: "USOAK",
    });

    expect(updated.status).toBe("CONFIRMED");
    expect(dbMock.transportationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "APPOINTMENT_SCHEDULED",
        }),
      })
    );
  });

  it("ingests raw Project44 container discharge signal and standardizes into CONTAINER_DISCHARGED event", async () => {
    dbMock.trackingProviderDefinition.findUnique.mockResolvedValueOnce({
      eventMappings: [
        {
          id: "mapping_project44_discharge",
          integrationConfigId: null,
          matchType: "CONTAINS",
          rawEventPattern: "DISCHARGE",
          canonicalEventType: "CONTAINER_DISCHARGED",
          classifier: "ACTUAL",
          sourceType: "CARRIER",
          priority: 10,
          active: true,
        },
      ],
    });
    dbMock.shipment.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await ingestRawTrackingSignal(mockContext, {
      provider: "PROJECT44",
      shipmentId: "shp_500",
      rawEventCode: "CONTAINER_DISCHARGED_OAKLAND",
      location: { unlocode: "USOAK", city: "Oakland" },
      occurredAt: new Date("2026-08-22T12:00:00Z"),
    });

    expect(result.eventType).toBe("CONTAINER_DISCHARGED");
    expect(dbMock.transportationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "CONTAINER_DISCHARGED",
          source: "API",
          entityType: "SHIPMENT",
          entityId: "shp_500",
        }),
      })
    );
  });
});
