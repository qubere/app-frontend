import { describe, it, expect, vi, beforeEach } from "vitest";

// RDPS: manual/targeted scan trigger. Covers triggerManualScan's guard
// against a second concurrent FULL_POPULATION run, DELTA_IMPACT's
// nudge-without-duplicate behavior, and the TARGETED flow implemented
// directly in the runs/route.ts POST handler: tenant-scoped partyId
// validation, a run created per invocation, recordRdpsOutcome called once
// per party, and the run finishing COMPLETED vs PARTIAL based on
// erroredCount.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    rdpsRun: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    party: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const recordRdpsOutcome = vi.fn();
vi.mock("@/modules/compliance/rdps/outcomeRecorder", () => ({
  recordRdpsOutcome: (...args: unknown[]) => recordRdpsOutcome(...args),
}));

const createAuditLog = vi.fn();
vi.mock("@/lib/audit", () => ({
  createAuditLog: (...args: unknown[]) => createAuditLog(...args),
  AuditAction: { RDPS_MANUAL_SCAN_TRIGGERED: "RDPS_MANUAL_SCAN_TRIGGERED" },
}));

vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: any) => {
    return async (req: any, context: any) =>
      handler({
        req,
        ctx: { accountId: "acct_1", userId: "user_1" },
        requestId: "req_1",
        params: context ? await context.params : {},
      });
  },
}));

const { triggerManualScan, RdpsFullPopulationAlreadyRunningError } = await import(
  "@/modules/compliance/rdps/rdpsQueryService"
);
const { POST } = await import("@/app/api/compliance/rdps/runs/route");

function jsonRequest(body: unknown) {
  return { url: "https://example.test/api/compliance/rdps/runs", json: async () => body } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("triggerManualScan: FULL_POPULATION concurrency guard", () => {
  it("throws RdpsFullPopulationAlreadyRunningError when a FULL_POPULATION run is already QUEUED or RUNNING", async () => {
    dbMock.rdpsRun.findFirst.mockResolvedValue({ id: "run_existing", status: "RUNNING" });

    await expect(triggerManualScan("user_1", { jobType: "FULL_POPULATION" })).rejects.toBeInstanceOf(
      RdpsFullPopulationAlreadyRunningError
    );
    expect(dbMock.rdpsRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { runType: "FULL_POPULATION", status: { in: ["QUEUED", "RUNNING"] } } })
    );
    expect(dbMock.rdpsRun.create).not.toHaveBeenCalled();
  });

  it("creates a new QUEUED FULL_POPULATION run when none is already in progress", async () => {
    dbMock.rdpsRun.findFirst.mockResolvedValue(null);
    dbMock.rdpsRun.create.mockResolvedValue({ id: "run_new", status: "QUEUED" });

    const run = await triggerManualScan("user_1", { jobType: "FULL_POPULATION" });

    expect(dbMock.rdpsRun.create).toHaveBeenCalledWith({
      data: { runType: "FULL_POPULATION", status: "QUEUED", triggeredBy: "MANUAL:user_1" },
    });
    expect(run).toEqual({ id: "run_new", status: "QUEUED" });
  });
});

describe("triggerManualScan: DELTA_IMPACT nudge (no duplicate run creation)", () => {
  it("returns the existing QUEUED/RUNNING DELTA_IMPACT run without creating a new one", async () => {
    dbMock.rdpsRun.findFirst.mockResolvedValue({ id: "run_delta", status: "RUNNING" });

    const run = await triggerManualScan("user_1", { jobType: "DELTA_IMPACT" });

    expect(dbMock.rdpsRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { runType: "DELTA_IMPACT", status: { in: ["QUEUED", "RUNNING"] } } })
    );
    expect(dbMock.rdpsRun.create).not.toHaveBeenCalled();
    expect(run).toEqual({ id: "run_delta", status: "RUNNING" });
  });

  it("returns null when there is no pending DELTA_IMPACT backlog, without creating a run", async () => {
    dbMock.rdpsRun.findFirst.mockResolvedValue(null);

    const run = await triggerManualScan("user_1", { jobType: "DELTA_IMPACT" });

    expect(run).toBeNull();
    expect(dbMock.rdpsRun.create).not.toHaveBeenCalled();
  });
});

describe("triggerManualScan: TARGETED is rejected -- handled by the route caller", () => {
  it("throws when called directly with jobType TARGETED", async () => {
    await expect(triggerManualScan("user_1", { jobType: "TARGETED", partyIds: ["p1"] })).rejects.toThrow(
      "TARGETED manual scans require partyIds and are handled by the caller."
    );
  });
});

describe("POST /api/compliance/rdps/runs: TARGETED flow", () => {
  it("returns 400 when partyIds is missing or empty", async () => {
    const response = await POST(jsonRequest({ jobType: "TARGETED", partyIds: [] }), undefined as any);
    expect(response.status).toBe(400);
    expect(dbMock.party.findMany).not.toHaveBeenCalled();
  });

  it("validates partyIds belong to the calling tenant and returns 404 when none match", async () => {
    dbMock.party.findMany.mockResolvedValue([]);

    const response = await POST(jsonRequest({ jobType: "TARGETED", partyIds: ["party_other_tenant"] }), undefined as any);

    expect(dbMock.party.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["party_other_tenant"] }, accountId: "acct_1" } })
    );
    expect(response.status).toBe(404);
    expect(dbMock.rdpsRun.create).not.toHaveBeenCalled();
  });

  it("creates a run, calls recordRdpsOutcome once per tenant-owned party, and completes COMPLETED when nothing errors", async () => {
    dbMock.party.findMany.mockResolvedValue([{ id: "party_1" }, { id: "party_2" }]);
    dbMock.rdpsRun.create.mockResolvedValue({ id: "run_1", status: "RUNNING" });
    dbMock.rdpsRun.update.mockImplementation(({ data }: any) => Promise.resolve({ id: "run_1", ...data }));
    recordRdpsOutcome
      .mockResolvedValueOnce({ outcomeId: "o1", isWorsening: false, errored: false })
      .mockResolvedValueOnce({ outcomeId: "o2", isWorsening: true, errored: false });

    const response = await POST(jsonRequest({ jobType: "TARGETED", partyIds: ["party_1", "party_2"] }), undefined as any);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(dbMock.rdpsRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ runType: "TARGETED", status: "RUNNING" }) })
    );
    expect(recordRdpsOutcome).toHaveBeenCalledTimes(2);
    expect(recordRdpsOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run_1", accountId: "acct_1", partyId: "party_1" })
    );
    expect(recordRdpsOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run_1", accountId: "acct_1", partyId: "party_2" })
    );
    expect(dbMock.rdpsRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run_1" },
        data: expect.objectContaining({ status: "COMPLETED", worsenedCount: 1, erroredCount: 0, screenedCount: 2 }),
      })
    );
    expect(body.run.status).toBe("COMPLETED");
  });

  it("ends the run PARTIAL (not COMPLETED) when erroredCount > 0", async () => {
    dbMock.party.findMany.mockResolvedValue([{ id: "party_1" }, { id: "party_2" }]);
    dbMock.rdpsRun.create.mockResolvedValue({ id: "run_1", status: "RUNNING" });
    dbMock.rdpsRun.update.mockImplementation(({ data }: any) => Promise.resolve({ id: "run_1", ...data }));
    recordRdpsOutcome
      .mockResolvedValueOnce({ outcomeId: "o1", isWorsening: false, errored: true })
      .mockResolvedValueOnce({ outcomeId: "o2", isWorsening: false, errored: false });

    const response = await POST(jsonRequest({ jobType: "TARGETED", partyIds: ["party_1", "party_2"] }), undefined as any);
    const body = await response.json();

    expect(dbMock.rdpsRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PARTIAL", erroredCount: 1 }) })
    );
    expect(body.run.status).toBe("PARTIAL");
  });
});

describe("POST /api/compliance/rdps/runs: FULL_POPULATION conflict surfaces as 409", () => {
  it("returns 409 when a FULL_POPULATION run is already in progress", async () => {
    dbMock.rdpsRun.findFirst.mockResolvedValue({ id: "run_existing", status: "RUNNING" });

    const response = await POST(jsonRequest({ jobType: "FULL_POPULATION" }), undefined as any);

    expect(response.status).toBe(409);
  });
});
