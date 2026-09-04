import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

/**
 * Test suite for P1: Idempotency on transmission-adjacent mutation routes.
 *
 * Verifies that:
 * 1. Requests with an Idempotency-Key return cached responses on replay and only mutate the database once.
 * 2. Requests with different keys (or no key) execute independently.
 */

const ctxMock = vi.fn();

const dbMock = {
  idempotencyRecord: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  customsFiling: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  shipment: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  filingProcedureConfig: {
    findFirst: vi.fn(),
  },
  agentPolicyConfig: {
    findFirst: vi.fn(),
  },
  htsRelease: {
    findFirst: vi.fn(),
  },
  pipelineJob: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
};

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (fn: () => unknown) => {
      try {
        fn();
      } catch {
        // ignore background task context error in test environment
      }
    },
  };
});

vi.mock("@/lib/db", () => ({
  db: dbMock,
  runWithAccountId: (_accountId: string | null | undefined, fn: () => unknown) => fn(),
  withAccountIdContext: (_accountId: string | null | undefined, fn: () => Promise<unknown>) => fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAccountContext: () => ctxMock(),
  hasPermission: async () => true,
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(true),
  AuditAction: {
    FILING_CREATED: "FILING_CREATED",
    FILING_UPDATED: "FILING_UPDATED",
    FILING_VALIDATED: "FILING_VALIDATED",
  },
}));

vi.mock("@/lib/tariff/dutyEngine", () => ({
  computeFilingTariff: () => ({ unratedLineCount: 0, totalCustomsValue: 100, totalDuty: 5, totalAmount: 105, dutyBreakdown: [] }),
  loadHtsCodesMap: async () => new Map(),
}));

vi.mock("@/lib/filing/filingValidator", () => ({
  runFilingValidation: () => ({ valid: true, blockers: [], warnings: [] }),
}));

vi.mock("@/modules/agents/pipelineOrchestrator", () => ({
  PipelineOrchestrator: { processEvent: vi.fn().mockResolvedValue(true) },
}));

const ACCOUNT = "acc_test_123";
const USER = "usr_test_456";

function context() {
  return {
    userId: USER,
    accountId: ACCOUNT,
    firstName: "Test",
    lastName: "User",
    roleNames: ["ADMIN"],
    isPlatformAdmin: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  ctxMock.mockResolvedValue(context());
  dbMock.idempotencyRecord.findUnique.mockResolvedValue(null);
  dbMock.idempotencyRecord.create.mockResolvedValue({ id: "idemp_rec_1" });
  dbMock.idempotencyRecord.update.mockResolvedValue({});
});

describe("P1 Transmission-Adjacent Idempotency Tests", () => {
  describe("POST /api/filing (Filing Creation)", () => {
    it("executes database creation when no Idempotency-Key is provided", async () => {
      const filingRoute = await import("@/app/api/filing/route");
      dbMock.filingProcedureConfig.findFirst.mockResolvedValue({ id: "cfg_1" });
      dbMock.customsFiling.create.mockResolvedValue({
        id: "filing_100",
        entryNumber: "US-01-TIMESTAMP-XYZ",
        filingStatus: "Draft",
      });

      const req = new Request("http://localhost/api/filing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          standalone: true,
          country: "US",
          procedureCode: "01",
          messageName: "SUMMRY",
        }),
      });

      const res = await filingRoute.POST(req, {} as any);
      expect(res.status).toBe(200);
      expect(dbMock.customsFiling.create).toHaveBeenCalledTimes(1);
      expect(dbMock.idempotencyRecord.create).not.toHaveBeenCalled();
    });

    it("caches response and skips duplicate creation when same Idempotency-Key is reused", async () => {
      const filingRoute = await import("@/app/api/filing/route");
      dbMock.filingProcedureConfig.findFirst.mockResolvedValue({ id: "cfg_1" });
      dbMock.customsFiling.create.mockResolvedValue({
        id: "filing_101",
        entryNumber: "US-01-TIMESTAMP-ABC",
        filingStatus: "Draft",
      });

      const key = "key-create-filing-001";
      const bodyText = JSON.stringify({
        standalone: true,
        country: "US",
        procedureCode: "01",
        messageName: "SUMMRY",
      });

      const expectedHash = createHash("sha256").update(bodyText).digest("hex");

      // First call: key is reserved
      const req1 = new Request("http://localhost/api/filing", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: bodyText,
      });

      const res1 = await filingRoute.POST(req1, {} as any);
      expect(res1.status).toBe(200);
      expect(dbMock.customsFiling.create).toHaveBeenCalledTimes(1);
      expect(dbMock.idempotencyRecord.create).toHaveBeenCalledTimes(1);
      expect(dbMock.idempotencyRecord.update).toHaveBeenCalledTimes(1);

      // Second call with same key and exact matching requestHash: returns cached response
      dbMock.idempotencyRecord.findUnique.mockResolvedValue({
        id: "idemp_rec_1",
        accountId: ACCOUNT,
        idempotencyKey: key,
        requestHash: expectedHash,
        statusCode: 200,
        responseBody: { filing: { id: "filing_101", entryNumber: "US-01-TIMESTAMP-ABC" } },
        expiresAt: new Date(Date.now() + 86400000),
      });

      const req2 = new Request("http://localhost/api/filing", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: bodyText,
      });

      const res2 = await filingRoute.POST(req2, {} as any);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.filing.id).toBe("filing_101");
      // DB creation called only once across both requests
      expect(dbMock.customsFiling.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("POST /api/filing/[id]/validate (Filing Validation Mutation)", () => {
    it("returns cached validation output when Idempotency-Key is reused", async () => {
      const validateRoute = await import("@/app/api/filing/[id]/validate/route");
      dbMock.customsFiling.findFirst.mockResolvedValue({
        id: "filing_val_1",
        accountId: ACCOUNT,
        filingStatus: "Draft",
        shipmentId: null,
      });
      dbMock.customsFiling.update.mockResolvedValue({
        id: "filing_val_1",
        filingStatus: "ReadyForBrokerReview",
      });

      const key = "key-validate-001";
      const expectedHash = createHash("sha256").update("").digest("hex");

      const req1 = new Request("http://localhost/api/filing/filing_val_1/validate", {
        method: "POST",
        headers: { "Idempotency-Key": key },
      });

      const res1 = await validateRoute.POST(req1, { params: Promise.resolve({ id: "filing_val_1" }) });
      expect(res1.status).toBe(200);
      expect(dbMock.customsFiling.update).toHaveBeenCalledTimes(1);

      // Replay call with cached idempotency record matching exact request hash
      dbMock.idempotencyRecord.findUnique.mockResolvedValue({
        id: "idemp_val_rec",
        accountId: ACCOUNT,
        idempotencyKey: key,
        requestHash: expectedHash,
        statusCode: 200,
        responseBody: { validation: { filingId: "filing_val_1", valid: true, filingStatus: "ReadyForBrokerReview" } },
        expiresAt: new Date(Date.now() + 86400000),
      });

      const req2 = new Request("http://localhost/api/filing/filing_val_1/validate", {
        method: "POST",
        headers: { "Idempotency-Key": key },
      });

      const res2 = await validateRoute.POST(req2, { params: Promise.resolve({ id: "filing_val_1" }) });
      expect(res2.status).toBe(200);
      expect(dbMock.customsFiling.update).toHaveBeenCalledTimes(1); // Not called second time
    });
  });

  describe("POST /api/shipments/[id]/pipeline-retry (Pipeline Retry)", () => {
    it("prevents double re-queueing when same Idempotency-Key is provided", async () => {
      const retryRoute = await import("@/app/api/shipments/[id]/pipeline-retry/route");
      dbMock.shipment.findFirst.mockResolvedValue({ id: "shp_retry_1" });
      dbMock.pipelineJob.findFirst.mockResolvedValue({ id: "job_retry_1", status: "FAILED" });
      dbMock.pipelineJob.updateMany.mockResolvedValue({ count: 1 });

      const key = "key-retry-001";
      const expectedHash = createHash("sha256").update("").digest("hex");

      const req1 = new Request("http://localhost/api/shipments/shp_retry_1/pipeline-retry", {
        method: "POST",
        headers: { "Idempotency-Key": key },
      });

      const res1 = await retryRoute.POST(req1, { params: Promise.resolve({ id: "shp_retry_1" }) });
      expect(res1.status).toBe(200);
      expect(dbMock.pipelineJob.updateMany).toHaveBeenCalledTimes(1);

      // Replay call returns cached response
      dbMock.idempotencyRecord.findUnique.mockResolvedValue({
        id: "idemp_retry_rec",
        accountId: ACCOUNT,
        idempotencyKey: key,
        requestHash: expectedHash,
        statusCode: 200,
        responseBody: { jobId: "job_retry_1", status: "PENDING" },
        expiresAt: new Date(Date.now() + 86400000),
      });

      const req2 = new Request("http://localhost/api/shipments/shp_retry_1/pipeline-retry", {
        method: "POST",
        headers: { "Idempotency-Key": key },
      });

      const res2 = await retryRoute.POST(req2, { params: Promise.resolve({ id: "shp_retry_1" }) });
      expect(res2.status).toBe(200);
      expect(dbMock.pipelineJob.updateMany).toHaveBeenCalledTimes(1); // updateMany not called again
    });
  });
});
