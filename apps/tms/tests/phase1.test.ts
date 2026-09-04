import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseFreightEmailTool } from "../src/modules/orders/tools/parseFreightEmailTool";
import { promoteOrderToShipment } from "../src/modules/orders/services/orderService";
import { createMovement } from "../src/modules/movement/services/movementService";
import { createCarrierProfile } from "../src/modules/carriers/services/carrierService";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    agentDecision: { create: vi.fn() },
    transportationOrder: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    transportationEvent: { create: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    shipment: { create: vi.fn(), count: vi.fn() },
    movement: { create: vi.fn(), findFirst: vi.fn() },
    shipmentMovement: { create: vi.fn() },
    party: { create: vi.fn() },
    carrierProfile: { create: vi.fn(), findFirst: vi.fn() },
    carrier: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@qubere/db", () => ({ db: dbMock }));

const mockContext: any = {
  userId: "user_123",
  clerkUserId: "clerk_123",
  email: "ops@qubere.ai",
  isPlatformAdmin: false,
  platformRoles: [],
  accountId: "acc_999",
  accountName: "Test Freight Corp",
  accountSlug: "test-freight",
  accountType: "ENTERPRISE",
  dataMode: "PRODUCTION",
  membershipId: "mem_123",
  roleIds: ["role_1"],
  roleNames: ["ADMIN"],
  permissions: ["transportation_orders.read", "transportation_orders.write"],
  memberships: [],
  account: {
    id: "acc_999",
    name: "Test Freight Corp",
    slug: "test-freight",
    type: "ENTERPRISE",
    status: "ACTIVE",
    createdAt: new Date(),
  },
};

describe("Phase 1 — TMS Foundation, AI Order Intake, Movement Graph & Events", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    dbMock.agentDecision.create.mockImplementation(async ({ data }: any) => ({
      id: "dec_001",
      ...data,
    }));

    dbMock.transportationOrder.create.mockImplementation(async ({ data }: any) => ({
      id: "ord_001",
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    dbMock.transportationOrder.update.mockImplementation(async ({ data }: any) => ({
      id: "ord_001",
      ...data,
      updatedAt: new Date(),
    }));

    dbMock.transportationEvent.create.mockImplementation(async ({ data }: any) => ({
      id: "evt_001",
      ...data,
      createdAt: new Date(),
    }));

    dbMock.auditLog.create.mockImplementation(async ({ data }: any) => ({
      id: "audit_001",
      ...data,
    }));

    dbMock.shipment.count.mockResolvedValue(4871);
    dbMock.shipment.create.mockImplementation(async ({ data }: any) => ({
      id: "shp_100",
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    dbMock.movement.create.mockImplementation(async ({ data }: any) => ({
      id: "mov_001",
      ...data,
      stops: data.stops?.create ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    dbMock.party.create.mockImplementation(async ({ data }: any) => ({
      id: "party_001",
      ...data,
    }));

    dbMock.carrierProfile.create.mockImplementation(async ({ data }: any) => ({
      id: "cp_001",
      ...data,
    }));
    dbMock.carrier.findFirst.mockResolvedValue(null);
    dbMock.carrier.create.mockImplementation(async ({ data }: any) => ({
      id: "carrier_001",
      ...data,
    }));
  });

  it("parses high confidence email into UNDERSTOOD order, decision, and TransportationEvent", async () => {
    const result = (await parseFreightEmailTool.execute(mockContext, {
      rawText: "Please ship 500 lbs of Electronics from Shanghai to Oakland next week.",
      requestedBy: "acme@example.com",
      commodityDescription: "Electronics",
      weight: 500,
      mode: "OCEAN",
      confidence: 95,
      evidenceItems: [
        { field: "weight", extractedValue: "500", sourceSpan: "500 lbs" },
        { field: "commodityDescription", extractedValue: "Electronics", sourceSpan: "Electronics" },
      ],
    })) as any;

    expect(dbMock.agentDecision.create).toHaveBeenCalledTimes(1);
    expect(dbMock.transportationOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "UNDERSTOOD",
          weight: 500,
          commodityDescription: "Electronics",
        }),
      })
    );
    expect(dbMock.transportationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "ORDER_PARSED",
          entityType: "TRANSPORTATION_ORDER",
        }),
      })
    );
    expect(result.order.status).toBe("UNDERSTOOD");
  });

  it("promotes TransportationOrder to shared Shipment aggregate root", async () => {
    dbMock.transportationOrder.findFirst.mockResolvedValueOnce({
      id: "ord_001",
      accountId: mockContext.accountId,
      requestedBy: "Acme Imports Inc",
      incoterm: "FOB",
      mode: "OCEAN",
      poReferences: ["PO-991122"],
    });

    const result = await promoteOrderToShipment(mockContext, "ord_001");

    expect(dbMock.shipment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shipmentNumber: "SHP-2026-004872",
          importerName: "Acme Imports Inc",
          transportMode: "OCEAN",
        }),
      })
    );
    expect(dbMock.transportationOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ord_001" },
        data: expect.objectContaining({
          shipmentId: "shp_100",
          status: "SHIPMENT_CREATED",
        }),
      })
    );
    expect(result.shipment.shipmentNumber).toBe("SHP-2026-004872");
  });

  it("creates a Movement with stops and attaches to Shipment via ShipmentMovement", async () => {
    await createMovement(mockContext, {
      shipmentId: "shp_100",
      mode: "OCEAN",
      vessel: "MSC OSCAR",
      voyage: "2608E",
      masterBillNumber: "MSC12345678",
      stops: [
        { sequence: 1, type: "PORT", locationName: "Shanghai", unlocode: "CNSHA" },
        { sequence: 2, type: "PORT", locationName: "Oakland", unlocode: "USOAK" },
      ],
    });

    expect(dbMock.movement.create).toHaveBeenCalledTimes(1);
    expect(dbMock.shipmentMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shipmentId: "shp_100",
          movementId: "mov_001",
        }),
      })
    );
    expect(dbMock.transportationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "MOVEMENT_PLANNED",
        }),
      })
    );
  });

  it("creates a CarrierProfile and extends Party with CARRIER role", async () => {
    await createCarrierProfile(mockContext, {
      legalName: "Ocean Network Express",
      scac: "ONEY",
      modes: ["OCEAN"],
      insuranceStatus: "ACTIVE",
      safetyStatus: "SATISFACTORY",
    });

    expect(dbMock.party.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roles: {
            create: { accountId: mockContext.accountId, roleType: "CARRIER" },
          },
        }),
      })
    );
    expect(dbMock.carrierProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          partyId: "party_001",
          scac: "ONEY",
          insuranceStatus: "ACTIVE",
        }),
      })
    );
    expect(dbMock.carrier.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          legalName: "Ocean Network Express",
          scac: "ONEY",
          insuranceOnFile: true,
          status: "INACTIVE",
        }),
      })
    );
  });
});
