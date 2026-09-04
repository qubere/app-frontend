import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression test for the standalone-filing maker/checker gap: the
 * segregation-of-duties check (preparer cannot also transmit) used to live
 * only inside the shipment-linked branch of POST /api/filing/[id]/transmit,
 * so a standalone filing (no shipmentId) could be prepared and transmitted
 * by the same user with no block at all.
 */

const ctxMock = vi.fn();

const dbMock = {
  customsFiling: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  agentPolicyConfig: {
    findFirst: vi.fn(),
  },
  htsRelease: {
    findFirst: vi.fn(),
  },
};

const createAuditLogMock = vi.fn().mockResolvedValue(true);
const transmitFilingMock = vi.fn();

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual };
});

vi.mock("@/lib/db", () => ({
  db: dbMock,
  runWithAccountId: (_accountId: string | null | undefined, fn: () => unknown) => fn(),
  runWithDataMode: (_dataMode: unknown, fn: () => unknown) => fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAccountContext: () => ctxMock(),
  hasPermission: async () => true,
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: createAuditLogMock,
  AuditAction: {
    FILING_SEGREGATION_VIOLATION: "FILING_SEGREGATION_VIOLATION",
    FILING_TRANSMITTED: "FILING_TRANSMITTED",
  },
}));

vi.mock("@/lib/billing/telemetry", () => ({
  recordUsageEvent: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/modules/filings/filing.service", () => ({
  FilingService: { transmitFiling: transmitFilingMock },
}));

vi.mock("@/lib/canonicalMessaging/devStub", () => ({
  simulateAndApplyResponse: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/filing/filingValidator", () => ({
  runFilingValidation: () => ({ valid: true, blockers: [], warnings: [] }),
}));

vi.mock("@/lib/webhooks/deliver", () => ({
  deliverWebhookEvent: vi.fn().mockResolvedValue(true),
}));

const ACCOUNT = "acc_test_123";
const PREPARER = "usr_preparer";
const CHECKER = "usr_checker";

function context(userId: string) {
  return {
    userId,
    accountId: ACCOUNT,
    firstName: "Test",
    lastName: "User",
    roleNames: ["ADMIN"],
    isPlatformAdmin: false,
  };
}

function standaloneFiling(overrides: Record<string, unknown> = {}) {
  return {
    id: "filing_standalone_1",
    accountId: ACCOUNT,
    shipmentId: null,
    shipment: null,
    localReferenceNumber: "LRN-001",
    preparedByUserId: PREPARER,
    entryNumber: "US-STANDALONE-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  createAuditLogMock.mockResolvedValue(true);
});

describe("POST /api/filing/[id]/transmit -- standalone-filing maker/checker", () => {
  it("blocks transmission when the preparer attempts to transmit their own standalone filing", async () => {
    ctxMock.mockResolvedValue(context(PREPARER));
    dbMock.customsFiling.findFirst.mockResolvedValue(standaloneFiling());

    const transmitRoute = await import("@/app/api/filing/[id]/transmit/route");
    const req = new Request("http://localhost/api/filing/filing_standalone_1/transmit", { method: "POST" });

    const res = await transmitRoute.POST(req, { params: Promise.resolve({ id: "filing_standalone_1" }) });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("SEGREGATION_OF_DUTIES_VIOLATION");
    expect(transmitFilingMock).not.toHaveBeenCalled();
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "FILING_SEGREGATION_VIOLATION" })
    );
  });

  it("allows a different user to transmit a standalone filing they did not prepare", async () => {
    ctxMock.mockResolvedValue(context(CHECKER));
    dbMock.customsFiling.findFirst.mockResolvedValue(standaloneFiling());
    transmitFilingMock.mockResolvedValue({
      filing: { entryNumber: "US-STANDALONE-1", filingStatus: "Transmitted", submittedAt: new Date() },
      messageId: "msg_1",
    });

    const transmitRoute = await import("@/app/api/filing/[id]/transmit/route");
    const req = new Request("http://localhost/api/filing/filing_standalone_1/transmit", { method: "POST" });

    const res = await transmitRoute.POST(req, { params: Promise.resolve({ id: "filing_standalone_1" }) });

    expect(res.status).toBe(200);
    expect(transmitFilingMock).toHaveBeenCalledWith(ACCOUNT, CHECKER, "filing_standalone_1");
  });
});
