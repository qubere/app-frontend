import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseIntakeRequest } from "../src/modules/orders/services/intakeParserService";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    agentDecision: { create: vi.fn() },
    transportationOrder: { create: vi.fn(), update: vi.fn() },
    transportationEvent: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@qubere/db", () => ({ db: dbMock }));

const mockContext: any = {
  userId: "user_123",
  clerkUserId: "clerk_123",
  email: "ops@qubere.ai",
  accountId: "acc_999",
  accountName: "Test Freight Corp",
};

describe("Phase 2 — AI Intake -> Transportation Order Proposal & Evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    let currentOrder: any = {};
    dbMock.transportationOrder.create.mockImplementation(async ({ data }: any) => {
      currentOrder = { id: "ord_201", ...data, createdAt: new Date(), updatedAt: new Date() };
      return currentOrder;
    });

    dbMock.transportationOrder.update.mockImplementation(async ({ data }: any) => {
      currentOrder = { ...currentOrder, ...data, updatedAt: new Date() };
      return currentOrder;
    });

    dbMock.agentDecision.create.mockImplementation(async ({ data }: any) => ({
      id: "dec_201",
      ...data,
    }));

    dbMock.transportationEvent.create.mockImplementation(async ({ data }: any) => ({
      id: "evt_201",
      ...data,
    }));

    dbMock.auditLog.create.mockImplementation(async ({ data }: any) => ({
      id: "audit_201",
      ...data,
    }));
  });

  it("extracts 2x40HC Shanghai to Oakland order with evidence spans and marks UNDERSTOOD for high confidence", async () => {
    const rawMessage = "Need to move 2x40HC Shanghai to Oakland next week. Delivery Sacramento. PO-882199 attached. Please quote.";

    const result = await parseIntakeRequest(mockContext, {
      rawText: rawMessage,
      requestedBy: "importer@acme.com",
      poReferences: ["PO-882199"],
      commodityDescription: "General Electronics",
      mode: "OCEAN",
      equipmentRequirements: ["2x40HC"],
      origin: { city: "Shanghai", country: "CN", unlocode: "CNSHA" },
      destination: { city: "Oakland", country: "US", unlocode: "USOAK" },
      finalDeliveryLocation: { city: "Sacramento", state: "CA" },
      customsRequired: true,
      confidence: 94,
      evidenceItems: [
        { field: "equipmentRequirements", extractedValue: "2x40HC", sourceSpan: "2x40HC", confidence: 98 },
        { field: "origin", extractedValue: "Shanghai", sourceSpan: "Shanghai", confidence: 96 },
        { field: "destination", extractedValue: "Oakland", sourceSpan: "Oakland", confidence: 96 },
        { field: "poReferences", extractedValue: "PO-882199", sourceSpan: "PO-882199", confidence: 99 },
      ],
    });

    expect(dbMock.transportationOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "UNDERSTOOD",
          mode: "OCEAN",
          customsRequired: true,
        }),
      })
    );

    expect(dbMock.agentDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          triageState: "AUTO_VERIFIED",
          autoApproved: true,
          confidence: 94,
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

  it("flags low confidence message (e.g. missing origin/dest) as NEEDS_REVIEW without fabricating data", async () => {
    const rawMessage = "Can you check rates for shipping some pallets next month?";

    const result = await parseIntakeRequest(mockContext, {
      rawText: rawMessage,
      requestedBy: "john@supplier.com",
      commodityDescription: "Pallets",
      confidence: 45, // low confidence
      evidenceItems: [
        { field: "commodityDescription", extractedValue: "Pallets", sourceSpan: "pallets", confidence: 50 },
      ],
    });

    expect(result.order.status).toBe("NEEDS_REVIEW");
    expect(dbMock.agentDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          triageState: "NEEDS_REVIEW",
          autoApproved: false,
          confidence: 45,
        }),
      })
    );
  });
});
