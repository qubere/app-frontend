import { describe, it, expect, vi, beforeEach } from "vitest";

// PATCH /api/shipments/[id] silently ignored `assignedBrokerId` in the
// request body -- the field was never destructured, so the shipments
// workbench's "reassign owner" control returned 200 and updated local
// state, but nothing was ever persisted. This suite pins the fix: the
// route must accept, validate, and persist the assignment.

const ctxMock = vi.fn();
const auditMock = vi.fn();

const dbMock = {
  shipment: { findFirst: vi.fn(), updateMany: vi.fn() },
  accountMembership: { findFirst: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth", () => ({
  getAccountContext: () => ctxMock(),
  hasPermission: vi.fn(async () => true),
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/modules/shipment/canonicalShipmentService", () => ({
  CanonicalShipmentService: { getCanonicalState: vi.fn(async () => ({ id: "shp_1" })) },
}));
vi.mock("@/modules/audit/factAuditService", () => ({
  FactAuditService: { logChangeEvent: (p: unknown) => auditMock(p) },
}));
vi.mock("@/modules/agents/pipelineOrchestrator", () => ({
  PipelineOrchestrator: { processEvent: vi.fn() },
}));
vi.mock("@/modules/shipment/factService", () => ({ FactService: { record: vi.fn() } }));
vi.mock("@/modules/shipment/lineItemReconciler", () => ({ lineItemFactField: vi.fn() }));
vi.mock("@/modules/shipment/shipmentPartyService", () => ({ ShipmentPartyService: { assignParty: vi.fn() } }));
vi.mock("@/lib/tariff/dutyEngine", () => ({ loadHtsCodesMap: vi.fn(), calculateDutyStack: vi.fn() }));
vi.mock("@/lib/webhooks/deliver", () => ({ deliverWebhookEvent: vi.fn(async () => {}) }));

const { PATCH } = await import("@/app/api/shipments/[id]/route");

const ACCOUNT = "acc_1";
const SHIPMENT_ID = "shp_1";

function context(overrides: Record<string, unknown> = {}) {
  return {
    userId: "u_admin",
    accountId: ACCOUNT,
    roleNames: ["ADMIN"],
    permissions: ["shipments.manage"],
    ...overrides,
  };
}

function baseShipment(overrides: Record<string, unknown> = {}) {
  return { id: SHIPMENT_ID, accountId: ACCOUNT, version: 1, status: "IN_PROGRESS", assignedBrokerId: null, ...overrides };
}

function patch(body: unknown) {
  return new Request(`http://t/api/shipments/${SHIPMENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  ctxMock.mockResolvedValue(context());
  dbMock.shipment.updateMany.mockResolvedValue({ count: 1 });
});

describe("PATCH /api/shipments/[id] -- owner assignment", () => {
  it("persists assignedBrokerId for an active member of the account", async () => {
    dbMock.shipment.findFirst.mockResolvedValue(baseShipment());
    dbMock.accountMembership.findFirst.mockResolvedValue({ id: "mem_1", status: "ACTIVE" });

    const res = await PATCH(patch({ assignedBrokerId: "u_broker" }), { params: Promise.resolve({ id: SHIPMENT_ID }) });

    expect(res.status).toBe(200);
    expect(dbMock.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SHIPMENT_ID, accountId: ACCOUNT, version: 1 },
        data: expect.objectContaining({
          assignedBroker: { connect: { id: "u_broker" } },
        }),
      })
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ field: "assignedBrokerId", newValue: "u_broker" })
    );
  });

  it("rejects an assignee who is not an active member of the account", async () => {
    dbMock.shipment.findFirst.mockResolvedValue(baseShipment());
    dbMock.accountMembership.findFirst.mockResolvedValue(null);

    const res = await PATCH(patch({ assignedBrokerId: "u_outsider" }), { params: Promise.resolve({ id: SHIPMENT_ID }) });

    expect(res.status).toBe(400);
    expect(dbMock.shipment.updateMany).not.toHaveBeenCalled();
  });

  it("unassigns when assignedBrokerId is set to null", async () => {
    dbMock.shipment.findFirst.mockResolvedValue(baseShipment({ assignedBrokerId: "u_broker" }));

    const res = await PATCH(patch({ assignedBrokerId: null }), { params: Promise.resolve({ id: SHIPMENT_ID }) });

    expect(res.status).toBe(200);
    expect(dbMock.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedBroker: { disconnect: true } }),
      })
    );
    expect(dbMock.accountMembership.findFirst).not.toHaveBeenCalled();
  });

  it("is a no-op when assignedBrokerId is unchanged", async () => {
    dbMock.shipment.findFirst.mockResolvedValue(baseShipment({ assignedBrokerId: "u_broker" }));

    const res = await PATCH(patch({ assignedBrokerId: "u_broker" }), { params: Promise.resolve({ id: SHIPMENT_ID }) });

    expect(res.status).toBe(200);
    expect(dbMock.shipment.updateMany).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });
});
