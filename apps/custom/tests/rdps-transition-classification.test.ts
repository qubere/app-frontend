import { describe, it, expect, vi, beforeEach } from "vitest";

// RDPS: classifyRdpsTransition (spec transition taxonomy) and its wiring
// into recordRdpsOutcome's persisted transitionType/triggeringChangeSetIds.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    partyScreeningSummary: { findUnique: vi.fn() },
    partyScreeningApproval: { findFirst: vi.fn() },
    rdpsPartyOutcome: { create: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const rescreenParty = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/partyScreeningLifecycle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/agents/compliance/restrictedParty/partyScreeningLifecycle")>();
  return { ...actual, rescreenParty: (...args: unknown[]) => rescreenParty(...args) };
});

vi.mock("@/lib/exceptions/createException", () => ({ createExceptionItem: vi.fn().mockResolvedValue({ id: "exc_1" }) }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(), AuditAction: { RDPS_WORSENING_DETECTED: "RDPS_WORSENING_DETECTED" } }));
vi.mock("@/lib/billing/telemetry", () => ({ recordUsageEvent: vi.fn().mockResolvedValue({ status: "RECORDED" }) }));

const { classifyRdpsTransition, recordRdpsOutcome } = await import("@/modules/compliance/rdps/outcomeRecorder");

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.partyScreeningApproval.findFirst.mockResolvedValue(null);
  dbMock.rdpsPartyOutcome.create.mockImplementation(({ data }: any) => Promise.resolve({ id: "outcome_1", ...data }));
});

describe("classifyRdpsTransition", () => {
  it("classifies a first-ever screen (no prior summary) the same as a CLEAR baseline", () => {
    expect(classifyRdpsTransition(null, "CLEAR")).toBe("UNCHANGED_CLEAR");
    expect(classifyRdpsTransition(null, "REVIEW_REQUIRED")).toBe("NEW_REVIEW");
    expect(classifyRdpsTransition(null, "HIT")).toBe("NEW_HIT");
  });

  it("classifies same-status repeats as UNCHANGED_*", () => {
    expect(classifyRdpsTransition("CLEAR", "CLEAR")).toBe("UNCHANGED_CLEAR");
    expect(classifyRdpsTransition("REVIEW_REQUIRED", "REVIEW_REQUIRED")).toBe("UNCHANGED_REVIEW");
    expect(classifyRdpsTransition("HIT", "HIT")).toBe("UNCHANGED_HIT");
  });

  it("classifies CLEAR -> REVIEW_REQUIRED as NEW_REVIEW and CLEAR -> HIT as NEW_HIT", () => {
    expect(classifyRdpsTransition("CLEAR", "REVIEW_REQUIRED")).toBe("NEW_REVIEW");
    expect(classifyRdpsTransition("CLEAR", "HIT")).toBe("NEW_HIT");
  });

  it("classifies REVIEW_REQUIRED -> HIT specifically as ESCALATED, not NEW_HIT", () => {
    expect(classifyRdpsTransition("REVIEW_REQUIRED", "HIT")).toBe("ESCALATED");
  });

  it("classifies a risk decrease down to CLEAR as CLEARED, and a partial decrease as RISK_REDUCED", () => {
    expect(classifyRdpsTransition("HIT", "CLEAR")).toBe("CLEARED");
    expect(classifyRdpsTransition("REVIEW_REQUIRED", "CLEAR")).toBe("CLEARED");
    expect(classifyRdpsTransition("HIT", "REVIEW_REQUIRED")).toBe("RISK_REDUCED");
  });

  it("classifies ERROR/SKIPPED/PARTIAL as themselves regardless of the prior status", () => {
    expect(classifyRdpsTransition("HIT", "ERROR")).toBe("ERROR");
    expect(classifyRdpsTransition("CLEAR", "SKIPPED")).toBe("SKIPPED");
    expect(classifyRdpsTransition(null, "PARTIAL")).toBe("PARTIAL");
  });
});

describe("recordRdpsOutcome: transitionType and triggeringChangeSetIds persistence", () => {
  it("persists the classified transitionType and the passed-through triggeringChangeSetIds on the success path", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockResolvedValue({ overallStatus: "HIT", results: [{ id: "psr_1", passType: "PARTY_NAME", status: "HIT" }] });

    await recordRdpsOutcome({
      runId: "run_1",
      accountId: "acct_1",
      partyId: "party_1",
      candidateReasons: ["EXACT"],
      triggeringChangeSetIds: ["chg_1", "chg_2"],
    });

    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.transitionType).toBe("NEW_HIT");
    expect(data.triggeringChangeSetIds).toEqual(["chg_1", "chg_2"]);
  });

  it("defaults triggeringChangeSetIds to [] when omitted (FULL_POPULATION/MANUAL/TARGETED runs)", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockResolvedValue({ overallStatus: "CLEAR", results: [{ id: "psr_1", passType: "PARTY_NAME", status: "CLEAR" }] });

    await recordRdpsOutcome({ runId: "run_1", accountId: "acct_1", partyId: "party_1", candidateReasons: [] });

    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.triggeringChangeSetIds).toEqual([]);
  });

  it("persists transitionType ERROR (never a risk classification) on the fail-closed error path", async () => {
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue({ screeningStatus: "CLEAR" });
    rescreenParty.mockRejectedValue(new Error("RPS engine unavailable"));

    await recordRdpsOutcome({
      runId: "run_1",
      accountId: "acct_1",
      partyId: "party_1",
      candidateReasons: [],
      triggeringChangeSetIds: ["chg_9"],
    });

    const data = dbMock.rdpsPartyOutcome.create.mock.calls[0][0].data;
    expect(data.transitionType).toBe("ERROR");
    expect(data.triggeringChangeSetIds).toEqual(["chg_9"]);
  });
});
