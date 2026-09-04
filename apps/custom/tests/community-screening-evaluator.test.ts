import { describe, it, expect, vi, beforeEach } from "vitest";

// Community Screening: evaluator.ts. Verifies it calls into the *canonical*
// RPS and Embargo engines (never reimplements matching), that a PAL gate
// short-circuits RPS entirely, that embargo skips cleanly when country data
// is missing, that a disabled check is never invoked, and that a thrown
// exception from either check path is caught and recorded as ERROR without
// ever throwing out of evaluateParty (one bad row must never fail the batch).

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    communityScreeningPartyResult: {
      update: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const runRestrictedPartyScreening = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/restrictedPartyScreening", () => ({
  runRestrictedPartyScreening: (...args: unknown[]) => runRestrictedPartyScreening(...args),
}));

const persistScreeningRun = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/persistResult", () => ({
  persistScreeningRun: (...args: unknown[]) => persistScreeningRun(...args),
}));

const checkPreApprovalGate = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/preApproval", () => ({
  checkPreApprovalGate: (...args: unknown[]) => checkPreApprovalGate(...args),
}));

const getAccountEmbargoConfig = vi.fn();
vi.mock("@/modules/agents/compliance/embargo/embargoRepository", () => ({
  getAccountEmbargoConfig: (...args: unknown[]) => getAccountEmbargoConfig(...args),
}));

const doEmbargoCheck = vi.fn();
vi.mock("@/modules/agents/compliance/embargo/doEmbargoCheck", () => ({
  doEmbargoCheck: (...args: unknown[]) => doEmbargoCheck(...args),
}));

const recordUsageEvent = vi.fn();
vi.mock("@/lib/billing/telemetry", () => ({
  recordUsageEvent: (...args: unknown[]) => recordUsageEvent(...args),
}));

const { evaluateParty } = await import("@/modules/compliance/communityScreening/evaluator");

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row_1",
    runId: "run_1",
    accountId: "acct_1",
    partyId: "party_1",
    externalReference: "EXT-1",
    snapshotName: "Acme Trading Co",
    snapshotAddress: "1 Main St",
    snapshotCity: "Springfield",
    snapshotCountry: "US",
    ...overrides,
  } as never;

}

function baseParams(overrides: Record<string, unknown> = {}) {
  return {
    accountId: "acct_1",
    runId: "run_1",
    checksEnabled: { restrictedParty: true, embargo: true },
    complianceCountry: "US",
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.communityScreeningPartyResult.update.mockResolvedValue({});
  checkPreApprovalGate.mockResolvedValue({ applied: false, reason: "No active pre-approval exists for this party." });
  runRestrictedPartyScreening.mockResolvedValue({ correlationId: "corr_1", passes: [] });
  persistScreeningRun.mockResolvedValue([{ id: "psr_1", status: "CLEAR" }]);
  getAccountEmbargoConfig.mockResolvedValue({ someConfig: true });
  doEmbargoCheck.mockResolvedValue({ result: "CLEAR", matcher: "EXACT" });
  recordUsageEvent.mockResolvedValue({ status: "RECORDED" });
});

describe("evaluateParty: billing usage metering", () => {
  it("records a COMMUNITY_SCREENING_COMPLETED usage event keyed by run and row id", async () => {
    await evaluateParty(baseRow(), baseParams());

    expect(recordUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct_1",
        eventCode: "COMMUNITY_SCREENING_COMPLETED",
        quantity: 1,
        unit: "party",
        idempotencyKey: "billing:community-screening:run_1:row_1",
      })
    );
  });

  it("still resolves normally when recordUsageEvent rejects (billing must never affect screening outcomes)", async () => {
    recordUsageEvent.mockRejectedValue(new Error("billing unavailable"));

    await expect(evaluateParty(baseRow(), baseParams())).resolves.toBeUndefined();
    expect(dbMock.communityScreeningPartyResult.update).toHaveBeenCalled();
  });
});

describe("evaluateParty: restrictedParty check", () => {
  it("calls the canonical RPS engine then persists, writing the worst-severity persisted status onto the row", async () => {
    persistScreeningRun.mockResolvedValue([
      { id: "psr_1", status: "CLEAR" },
      { id: "psr_2", status: "HIT" },
    ]);

    await evaluateParty(baseRow(), baseParams({ checksEnabled: { restrictedParty: true, embargo: false } }));

    expect(checkPreApprovalGate).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acct_1", partyId: "party_1", source: "COMMUNITY_SCREENING" })
    );
    expect(runRestrictedPartyScreening).toHaveBeenCalledTimes(1);
    expect(persistScreeningRun).toHaveBeenCalledWith(
      expect.objectContaining({ source: "COMMUNITY_SCREENING", partyId: "party_1" }),
      expect.anything(),
      expect.anything()
    );

    const updateCall = dbMock.communityScreeningPartyResult.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: "row_1" });
    // Worst severity between CLEAR and HIT is HIT -- the row must reflect
    // what the canonical engine persisted, never a reimplemented match.
    expect(updateCall.data.restrictedPartyStatus).toBe("HIT");
    expect(updateCall.data.restrictedPartyResultId).toBe("psr_2");
    expect(updateCall.data.aggregateStatus).toBe("FAILED");
  });

  it("treats RPS as PRE_APPROVED_REUSE (distinct from CLEAR) without calling the RPS engine at all when the PAL gate applies", async () => {
    checkPreApprovalGate.mockResolvedValue({ applied: true, reason: "Valid pre-approval found.", approvalId: "appr_1" });

    await evaluateParty(baseRow(), baseParams({ checksEnabled: { restrictedParty: true, embargo: false } }));

    expect(runRestrictedPartyScreening).not.toHaveBeenCalled();
    expect(persistScreeningRun).not.toHaveBeenCalled();

    const updateCall = dbMock.communityScreeningPartyResult.update.mock.calls[0][0];
    expect(updateCall.data.restrictedPartyStatus).toBe("PRE_APPROVED_REUSE");
    expect(updateCall.data.restrictedPartyResultId).toBe("appr_1");
    expect(updateCall.data.restrictedPartyFindingCategory).toBe("PAL_SUPPRESSED");
    expect(updateCall.data.aggregateStatus).toBe("PASSED");
  });

  it("marks a red-flag-only pass distinctly from a denied-party match, even though the RPS status tier is shared", async () => {
    persistScreeningRun.mockResolvedValue([{ id: "psr_1", status: "REVIEW_REQUIRED", hitCount: 0, redFlagCount: 1 }]);

    await evaluateParty(baseRow(), baseParams({ checksEnabled: { restrictedParty: true, embargo: false } }));

    const updateCall = dbMock.communityScreeningPartyResult.update.mock.calls[0][0];
    expect(updateCall.data.restrictedPartyStatus).toBe("REVIEW_REQUIRED");
    expect(updateCall.data.restrictedPartyMatchFound).toBe(false);
    expect(updateCall.data.restrictedPartyRedFlagFound).toBe(true);
    expect(updateCall.data.restrictedPartyFindingCategory).toBe("RED_FLAG_ONLY");
    expect(updateCall.data.aggregateStatus).toBe("FAILED");
    expect(updateCall.data.failureReason).toBe("Restricted Party: Red Flag");
  });

  it("marks both a denied-party match and a red-flag hit independently when both are present on the same pass", async () => {
    persistScreeningRun.mockResolvedValue([{ id: "psr_1", status: "HIT", hitCount: 1, redFlagCount: 1 }]);

    await evaluateParty(baseRow(), baseParams({ checksEnabled: { restrictedParty: true, embargo: false } }));

    const updateCall = dbMock.communityScreeningPartyResult.update.mock.calls[0][0];
    expect(updateCall.data.restrictedPartyMatchFound).toBe(true);
    expect(updateCall.data.restrictedPartyRedFlagFound).toBe(true);
    expect(updateCall.data.restrictedPartyFindingCategory).toBe("CONFIRMED_MATCH");
    expect(updateCall.data.failureReason).toBe("Restricted Party: Confirmed Match; Restricted Party: Red Flag");
  });
});

describe("evaluateParty: embargo check", () => {
  it("calls getAccountEmbargoConfig + doEmbargoCheck with screeningLevel PARTY and the row's runId as shipmentId", async () => {
    await evaluateParty(baseRow(), baseParams({ checksEnabled: { restrictedParty: false, embargo: true } }));

    expect(getAccountEmbargoConfig).toHaveBeenCalledWith("acct_1");
    expect(doEmbargoCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct_1",
        shipmentId: "run_1",
        partyId: "party_1",
        screeningLevel: "PARTY",
        complianceCountry: "US",
        targetCountry: "US",
      })
    );

    const updateCall = dbMock.communityScreeningPartyResult.update.mock.calls[0][0];
    expect(updateCall.data.embargoStatus).toBe("CLEAR");
    expect(updateCall.data.aggregateStatus).toBe("PASSED");
  });

  it("skips embargo with SKIPPED, never calling doEmbargoCheck, when complianceCountry is missing", async () => {
    await evaluateParty(
      baseRow(),
      baseParams({ checksEnabled: { restrictedParty: false, embargo: true }, complianceCountry: null })
    );

    expect(doEmbargoCheck).not.toHaveBeenCalled();
    const updateCall = dbMock.communityScreeningPartyResult.update.mock.calls[0][0];
    expect(updateCall.data.embargoStatus).toBe("SKIPPED");
    expect(updateCall.data.aggregateStatus).toBe("INCOMPLETE");
  });

  it("skips embargo with SKIPPED, never calling doEmbargoCheck, when the row's target country is missing", async () => {
    await evaluateParty(
      baseRow({ snapshotCountry: null }),
      baseParams({ checksEnabled: { restrictedParty: false, embargo: true } })
    );

    expect(doEmbargoCheck).not.toHaveBeenCalled();
    const updateCall = dbMock.communityScreeningPartyResult.update.mock.calls[0][0];
    expect(updateCall.data.embargoStatus).toBe("SKIPPED");
  });

  it("never calls doEmbargoCheck when the embargo check is disabled", async () => {
    await evaluateParty(baseRow(), baseParams({ checksEnabled: { restrictedParty: true, embargo: false } }));
    expect(doEmbargoCheck).not.toHaveBeenCalled();
    expect(getAccountEmbargoConfig).not.toHaveBeenCalled();
  });
});

describe("evaluateParty: one bad row never fails the batch", () => {
  it("records ERROR with a non-null errorMessage and resolves normally when the RPS path throws", async () => {
    runRestrictedPartyScreening.mockRejectedValue(new Error("RPS engine unavailable"));

    await expect(
      evaluateParty(baseRow(), baseParams({ checksEnabled: { restrictedParty: true, embargo: false } }))
    ).resolves.toBeUndefined();

    const updateCall = dbMock.communityScreeningPartyResult.update.mock.calls[0][0];
    expect(updateCall.data.aggregateStatus).toBe("ERROR");
    expect(updateCall.data.errorMessage).toBe("RPS engine unavailable");
  });

  it("records ERROR with a non-null errorMessage and resolves normally when the embargo path throws", async () => {
    doEmbargoCheck.mockRejectedValue(new Error("Embargo engine unavailable"));

    await expect(
      evaluateParty(baseRow(), baseParams({ checksEnabled: { restrictedParty: false, embargo: true } }))
    ).resolves.toBeUndefined();

    const updateCall = dbMock.communityScreeningPartyResult.update.mock.calls[0][0];
    expect(updateCall.data.aggregateStatus).toBe("ERROR");
    expect(updateCall.data.errorMessage).toBe("Embargo engine unavailable");
  });

  it("never calls doEmbargoCheck when a disabled check would have thrown -- disabled truly means never invoked", async () => {
    await evaluateParty(baseRow(), baseParams({ checksEnabled: { restrictedParty: true, embargo: false } }));
    expect(doEmbargoCheck).not.toHaveBeenCalled();
  });
});
