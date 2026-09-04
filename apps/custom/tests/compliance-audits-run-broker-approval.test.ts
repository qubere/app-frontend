import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * hasBrokerApproval used to come from an AuditLog lookup for action
 * "filing.approve" -- a string the approve route never actually writes (it
 * writes AuditAction.FILING_APPROVED), so that check was permanently false.
 * The fix reads CustomsFiling.approvedByUserId directly, which the approve
 * route does set. These tests pin that wiring.
 */

const ctxMock = vi.fn();
const runAuditChecksMock = vi.fn((_snapshot?: unknown) => [] as unknown[]);

const dbMock = {
  customsFiling: { findFirst: vi.fn() },
  reconciliationIssue: { findFirst: vi.fn() },
  adcvdOrder: { findFirst: vi.fn() },
  complianceFinding: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  complianceAuditRecord: { create: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: any) => async (req: Request) => {
    const ctx = ctxMock();
    return handler({ req, ctx });
  },
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/compliance/auditChecklist", () => ({
  runAuditChecks: (snapshot: unknown) => runAuditChecksMock(snapshot),
}));

const { POST } = await import("@/app/api/compliance/audits/run/route");

function call() {
  return POST(
    new Request("http://localhost/api/compliance/audits/run", {
      method: "POST",
      body: JSON.stringify({ filingId: "fil_1" }),
    })
  );
}

function baseFiling(overrides: Record<string, unknown> = {}) {
  return {
    id: "fil_1",
    shipmentId: "shp_1",
    totalValue: "5000",
    releasedAt: null,
    approvedByUserId: null,
    shipment: { lineItems: [], documents: [] },
    snapshot: null,
    bond: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  ctxMock.mockReturnValue({ accountId: "acc_1", userId: "u_1" });
  dbMock.reconciliationIssue.findFirst.mockResolvedValue(null);
  dbMock.adcvdOrder.findFirst.mockResolvedValue(null);
  dbMock.complianceAuditRecord.create.mockResolvedValue({ id: "audit_1" });
  runAuditChecksMock.mockReturnValue([]);
});

describe("POST /api/compliance/audits/run — broker approval derivation", () => {
  it("reports hasBrokerApproval: false when the filing has never been approved", async () => {
    dbMock.customsFiling.findFirst.mockResolvedValue(baseFiling({ approvedByUserId: null }));

    await call();

    expect(runAuditChecksMock).toHaveBeenCalledWith(
      expect.objectContaining({ hasBrokerApproval: false })
    );
  });

  it("reports hasBrokerApproval: true once approvedByUserId is set by the approve route", async () => {
    dbMock.customsFiling.findFirst.mockResolvedValue(baseFiling({ approvedByUserId: "u_broker" }));

    await call();

    expect(runAuditChecksMock).toHaveBeenCalledWith(
      expect.objectContaining({ hasBrokerApproval: true })
    );
  });
});
