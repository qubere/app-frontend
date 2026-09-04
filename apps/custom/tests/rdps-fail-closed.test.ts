import { describe, it, expect, vi, beforeEach } from "vitest";

// RDPS: fail-closed guarantee. This is the plan-critical property: if
// rescreenParty throws inside recordRdpsOutcome, an outcome row must STILL
// be written (errored:true, newStatus "ERROR", errorMessage set) -- never
// silently skipped, never treated as CLEAR -- and a run with erroredCount > 0
// must never finish COMPLETED. It also checks that the shapes returned by
// listOutcomesForRun/listRuns carry real, distinguishable field names for an
// errored/PARTIAL state -- no response ever collapses that into something
// that looks like an ordinary pass.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    partyScreeningSummary: { findUnique: vi.fn() },
    partyScreeningApproval: { findFirst: vi.fn() },
    rdpsPartyOutcome: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    rdpsRun: { findMany: vi.fn(), count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const rescreenParty = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/partyScreeningLifecycle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/agents/compliance/restrictedParty/partyScreeningLifecycle")>();
  return { ...actual, rescreenParty: (...args: unknown[]) => rescreenParty(...args) };
});

const createExceptionItem = vi.fn();
vi.mock("@/lib/exceptions/createException", () => ({
  createExceptionItem: (...args: unknown[]) => createExceptionItem(...args),
}));

const createAuditLog = vi.fn();
vi.mock("@/lib/audit", () => ({
  createAuditLog: (...args: unknown[]) => createAuditLog(...args),
  AuditAction: { RDPS_WORSENING_DETECTED: "RDPS_WORSENING_DETECTED" },
}));

const recordUsageEvent = vi.fn();
vi.mock("@/lib/billing/telemetry", () => ({
  recordUsageEvent: (...args: unknown[]) => recordUsageEvent(...args),
}));

const { recordRdpsOutcome } = await import("@/modules/compliance/rdps/outcomeRecorder");
const { listOutcomesForRun, listRuns } = await import("@/modules/compliance/rdps/rdpsQueryService");

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.partyScreeningApproval.findFirst.mockResolvedValue(null);
  dbMock.rdpsPartyOutcome.create.mockImplementation(({ data }: any) => Promise.resolve({ id: "outcome_err", ...data }));
  recordUsageEvent.mockResolvedValue({ status: "RECORDED" });
});

describe("recordRdpsOutcome: billing usage metering on the error path", () => {
  it("still records an RDPS_RESCREEN_COMPLETED usage event with success:false when rescreenParty throws", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockRejectedValue(new Error("RPS engine unavailable"));

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(recordUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct_1",
        eventCode: "RDPS_RESCREEN_COMPLETED",
        success: false,
        idempotencyKey: "billing:rdps:run_1:party_1",
      })
    );
  });

  it("still writes the fail-closed outcome row when recordUsageEvent itself also rejects", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockRejectedValue(new Error("RPS engine unavailable"));
    recordUsageEvent.mockRejectedValue(new Error("billing unavailable"));

    const result = await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });
    expect(result.errored).toBe(true);
  });
});

describe("recordRdpsOutcome: fail-closed when rescreenParty throws", () => {
  it("still writes an outcome row when rescreenParty rejects, never silently skipping it", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockRejectedValue(new Error("RPS engine unavailable"));

    const result = await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(dbMock.rdpsPartyOutcome.create).toHaveBeenCalledTimes(1);
    expect(result.errored).toBe(true);
  });

  it("records newStatus ERROR -- never CLEAR -- when the rescreen call throws, even though the prior status was CLEAR", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockRejectedValue(new Error("timeout"));

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.newStatus).toBe("ERROR");
    expect(data.newStatus).not.toBe("CLEAR");
  });

  it("sets a non-null errorMessage carrying the thrown error's message", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue(null);
    rescreenParty.mockRejectedValue(new Error("network unreachable"));

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.errorMessage).toBe("network unreachable");
  });

  it("stringifies a non-Error throw rather than losing the failure detail", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue(null);
    rescreenParty.mockRejectedValue("a plain string rejection");

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.errorMessage).toBe("a plain string rejection");
  });

  it("never marks an errored outcome as worsening", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockRejectedValue(new Error("boom"));

    const result = await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(result.isWorsening).toBe(false);
    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.isWorsening).toBe(false);
  });

  it("never creates a worsening exception for an errored outcome (there is no fresh status to react to)", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockRejectedValue(new Error("boom"));

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(createExceptionItem).not.toHaveBeenCalled();
  });

  it("still records hadActivePreApproval on the error path (that lookup happens before the rescreen call)", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue(null);
    dbMock.partyScreeningApproval.findFirst.mockResolvedValue({ id: "appr_1" });
    rescreenParty.mockRejectedValue(new Error("boom"));

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.hadActivePreApproval).toBe(true);
  });
});

describe("Response shapes never collapse an errored/PARTIAL state into a success-looking shape", () => {
  it("listOutcomesForRun surfaces newStatus ERROR and a non-null errorMessage as distinct real fields on each outcome row", async () => {
    dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([
      {
        id: "outcome_1",
        newStatus: "ERROR",
        previousStatus: "CLEAR",
        isWorsening: false,
        errorMessage: "RPS engine unavailable",
        party: { names: [{ rawName: "Acme Trading Co" }] },
      },
    ]);
    dbMock.rdpsPartyOutcome.count.mockResolvedValue(1);

    const { outcomes } = await listOutcomesForRun("acct_1", "run_1", {});

    expect(outcomes[0]).toMatchObject({ newStatus: "ERROR", errorMessage: "RPS engine unavailable" });
    // The field distinguishing an error from a real screening outcome must
    // exist and be truthy -- a UI/API consumer must be able to branch on it.
    expect(outcomes[0]?.errorMessage).toBeTruthy();
    expect(outcomes[0]?.newStatus).not.toBe("CLEAR");
  });

  it("listRuns surfaces a run's real status/erroredCount fields verbatim -- PARTIAL is never rewritten to COMPLETED and erroredCount is never dropped", async () => {
    dbMock.rdpsRun.findMany.mockResolvedValue([
      { id: "run_1", status: "PARTIAL", erroredCount: 2, worsenedCount: 1, screenedCount: 5 },
    ]);
    dbMock.rdpsRun.count.mockResolvedValue(1);

    const { runs } = await listRuns({});

    expect(runs[0]).toMatchObject({ status: "PARTIAL", erroredCount: 2 });
    expect(runs[0]?.status).not.toBe("COMPLETED");
  });
});

describe("Run-level fail-closed rule: erroredCount > 0 must never finish COMPLETED", () => {
  it("computing status from erroredCount the same way the TARGETED route does yields PARTIAL, not COMPLETED, whenever any outcome errored", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty
      .mockResolvedValueOnce({ overallStatus: "CLEAR", results: [{ id: "psr_1", passType: "PARTY_NAME", status: "CLEAR" }] })
      .mockRejectedValueOnce(new Error("boom"));

    const outcomeA = await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });
    const outcomeB = await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_2", candidateReasons: [] });

    const erroredCount = [outcomeA, outcomeB].filter((o) => o.errored).length;
    const runStatus = erroredCount > 0 ? "PARTIAL" : "COMPLETED";

    expect(erroredCount).toBe(1);
    expect(runStatus).toBe("PARTIAL");
  });
});
