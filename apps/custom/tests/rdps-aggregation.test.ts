import { describe, it, expect, vi, beforeEach } from "vitest";

// RDPS: outcomeRecorder.ts's recordRdpsOutcome. Verifies worsening detection
// (a transition counts as worsening only when the fresh status is strictly
// worse than the prior one, treating "never screened" as a CLEAR baseline),
// that an immutable RdpsPartyOutcome row is always written with the right
// shape, that hadActivePreApproval reflects an active PartyScreeningApproval,
// and that an exceptionItemId is only created for a worsening transition that
// lands on HIT/REVIEW_REQUIRED specifically (not merely "worse than before").

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    partyScreeningSummary: {
      findUnique: vi.fn(),
    },
    partyScreeningApproval: {
      findFirst: vi.fn(),
    },
    rdpsPartyOutcome: {
      create: vi.fn(),
    },
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

const { recordRdpsOutcome } = await import("@/modules/compliance/rdps/outcomeRecorder");

function rescreenResult(overallStatus: string, resultId = "psr_1") {
  return { overallStatus, results: [{ id: resultId, passType: "PARTY_NAME", status: overallStatus }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.partyScreeningApproval.findFirst.mockResolvedValue(null);
  dbMock.rdpsPartyOutcome.create.mockImplementation(({ data }: any) => Promise.resolve({ id: "outcome_1", ...data }));
  createExceptionItem.mockResolvedValue({ id: "exc_1" });
  createAuditLog.mockResolvedValue(undefined);
});

describe("recordRdpsOutcome: worsening detection", () => {
  it("counts CLEAR -> REVIEW_REQUIRED as worsening", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockResolvedValue(rescreenResult("REVIEW_REQUIRED"));

    const result = await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(result.isWorsening).toBe(true);
    expect(result.errored).toBe(false);
  });

  it("counts CLEAR -> HIT as worsening", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockResolvedValue(rescreenResult("HIT"));

    const result = await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(result.isWorsening).toBe(true);
  });

  it("treats a party with no prior summary as baseline CLEAR, so a first-ever HIT still counts as worsening", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue(null);
    rescreenParty.mockResolvedValue(rescreenResult("HIT"));

    const result = await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(result.previousStatus).toBeNull();
    expect(result.isWorsening).toBe(true);
  });

  it("does not count a repeat HIT -> HIT rescreen as worsening (same status, not strictly worse)", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "HIT" });
    rescreenParty.mockResolvedValue(rescreenResult("HIT"));

    const result = await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(result.isWorsening).toBe(false);
  });

  it("does not count HIT -> REVIEW_REQUIRED as worsening (an improvement, not a worsening)", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "HIT" });
    rescreenParty.mockResolvedValue(rescreenResult("REVIEW_REQUIRED"));

    const result = await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(result.isWorsening).toBe(false);
  });

  it("does not count CLEAR -> CLEAR as worsening", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockResolvedValue(rescreenResult("CLEAR"));

    const result = await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(result.isWorsening).toBe(false);
  });
});

describe("recordRdpsOutcome: immutable outcome row creation", () => {
  it("creates the RdpsPartyOutcome row with the full expected shape", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockResolvedValue(rescreenResult("HIT", "psr_9"));

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: ["EXACT", "RAW_WORD"] });

    expect(dbMock.rdpsPartyOutcome.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        runId: "run_1",
        accountId: "acct_1",
        partyId: "party_1",
        candidateReasons: ["EXACT", "RAW_WORD"],
        previousStatus: "CLEAR",
        newStatus: "HIT",
        isWorsening: true,
        hadActivePreApproval: false,
        screeningResultId: "psr_9",
      }),
    });
  });

  it("passes previousStatus as undefined (not null) when there is no prior summary, matching Prisma's optional-field convention", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue(null);
    rescreenParty.mockResolvedValue(rescreenResult("CLEAR"));

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.previousStatus).toBeUndefined();
  });
});

describe("recordRdpsOutcome: hadActivePreApproval", () => {
  it("is true when an active PRE_APPROVED PartyScreeningApproval exists", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    dbMock.partyScreeningApproval.findFirst.mockResolvedValue({ id: "appr_1" });
    rescreenParty.mockResolvedValue(rescreenResult("CLEAR"));

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.hadActivePreApproval).toBe(true);
  });

  it("is false when no active PRE_APPROVED approval exists", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    dbMock.partyScreeningApproval.findFirst.mockResolvedValue(null);
    rescreenParty.mockResolvedValue(rescreenResult("CLEAR"));

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.hadActivePreApproval).toBe(false);
  });

  it("scopes the PartyScreeningApproval lookup by accountId, partyId, and status PRE_APPROVED", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockResolvedValue(rescreenResult("CLEAR"));

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(dbMock.partyScreeningApproval.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: "acct_1", partyId: "party_1", status: "PRE_APPROVED" } })
    );
  });
});

describe("recordRdpsOutcome: exceptionItemId creation on worsening", () => {
  it("creates an exception and links exceptionItemId when the worsening transition lands on HIT", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockResolvedValue(rescreenResult("HIT"));
    createExceptionItem.mockResolvedValue({ id: "exc_hit" });

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(createExceptionItem).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acct_1", category: "COMPLIANCE", type: "rdps_worsening_transition", severity: "Critical" })
    );
    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.exceptionItemId).toBe("exc_hit");
  });

  it("creates an exception with High severity (not Critical) when the worsening transition lands on REVIEW_REQUIRED", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockResolvedValue(rescreenResult("REVIEW_REQUIRED"));
    createExceptionItem.mockResolvedValue({ id: "exc_review" });

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(createExceptionItem).toHaveBeenCalledWith(expect.objectContaining({ severity: "High" }));
    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.exceptionItemId).toBe("exc_review");
  });

  it("does not create an exception when there is no worsening", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "HIT" });
    rescreenParty.mockResolvedValue(rescreenResult("HIT"));

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(createExceptionItem).not.toHaveBeenCalled();
    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.exceptionItemId).toBeNull();
  });

  it("does not create an exception when the transition worsens but does not land on HIT/REVIEW_REQUIRED (e.g. CLEAR -> PARTIAL)", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockResolvedValue(rescreenResult("PARTIAL"));

    const result = await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(result.isWorsening).toBe(true);
    expect(createExceptionItem).not.toHaveBeenCalled();
    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.exceptionItemId).toBeNull();
  });

  it("writes a worsening audit log alongside the exception", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockResolvedValue(rescreenResult("HIT"));

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: ["EXACT"] });

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct_1",
        entity: "Party",
        entityId: "party_1",
        source: "SYSTEM",
        metadata: expect.objectContaining({ runId: "run_1", previousStatus: "CLEAR", newStatus: "HIT" }),
      })
    );
  });

  it("still writes the outcome row (with a null exceptionItemId) even if createExceptionItem itself throws", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockResolvedValue(rescreenResult("HIT"));
    createExceptionItem.mockRejectedValue(new Error("exception service unavailable"));

    const result = await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    expect(result.errored).toBe(false);
    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.exceptionItemId).toBeNull();
  });
});
