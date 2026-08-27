import { describe, it, expect, vi, beforeEach } from "vitest";

// RDPS: rdpsRecallValidator.ts -- the release-blocking safety net that diffs
// the reverse (targeted) index against the forward (ground-truth) matcher.
// findImpactedParties and generateCandidates are mocked here so the test can
// deliberately construct a targeted-index gap (a party the forward matcher
// would catch but the reverse index misses) and assert it surfaces in
// missedByTargeted, plus an agreeing case with no false positive on an
// unrelated party.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    referenceDataChangeSet: { findMany: vi.fn() },
    screeningEntity: { findMany: vi.fn() },
    partyName: { findMany: vi.fn() },
    rdpsRun: { update: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const buildPartyIdentityIndex = vi.fn();
const findImpactedParties = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/impactAnalysis", () => ({
  buildPartyIdentityIndex: (...args: unknown[]) => buildPartyIdentityIndex(...args),
  findImpactedParties: (...args: unknown[]) => findImpactedParties(...args),
}));

const generateCandidates = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/candidateGeneration", () => ({
  generateCandidates: (...args: unknown[]) => generateCandidates(...args),
}));

const createExceptionItem = vi.fn();
vi.mock("@/lib/exceptions/createException", () => ({
  createExceptionItem: (...args: unknown[]) => createExceptionItem(...args),
}));

const createAuditLog = vi.fn();
vi.mock("@/lib/audit", () => ({
  createAuditLog: (...args: unknown[]) => createAuditLog(...args),
  AuditAction: { RDPS_RECALL_VALIDATION_FAILED: "RDPS_RECALL_VALIDATION_FAILED" },
}));

const { validateRecallForWindow, recordRecallValidationResult } = await import(
  "@/modules/agents/compliance/restrictedParty/rdpsRecallValidator"
);

const windowStart = new Date("2026-08-20T00:00:00.000Z");
const windowEnd = new Date("2026-08-27T00:00:00.000Z");

function changedEntity(id = "entity_1", name = "Acme Corp") {
  return { id, name, addresses: [], aliases: [], alternateNames: [] } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.referenceDataChangeSet.findMany.mockResolvedValue([{ screeningEntityId: "entity_1" }]);
  dbMock.screeningEntity.findMany.mockResolvedValue([changedEntity()]);
  buildPartyIdentityIndex.mockResolvedValue([
    { partyId: "party_1", accountId: "acct_1" },
    { partyId: "party_2", accountId: "acct_1" },
    { partyId: "party_3", accountId: "acct_1" },
  ]);
  dbMock.partyName.findMany.mockResolvedValue([
    { partyId: "party_1", rawName: "Acme Corp" },
    { partyId: "party_2", rawName: "Acme Corporation" },
    { partyId: "party_3", rawName: "Totally Unrelated Widgets" },
  ]);
});

describe("validateRecallForWindow: no changes in the window", () => {
  it("returns a clean, passed result with no db work beyond the change-set lookup", async () => {
    dbMock.referenceDataChangeSet.findMany.mockResolvedValue([]);

    const result = await validateRecallForWindow(windowStart, windowEnd);

    expect(result).toEqual({ windowStart, windowEnd, changedEntityCount: 0, partyCount: 0, missedByTargeted: [], passed: true });
    expect(buildPartyIdentityIndex).not.toHaveBeenCalled();
  });
});

describe("validateRecallForWindow: a deliberately-missed candidate is detected", () => {
  it("reports a party in missedByTargeted when the reverse index misses it but the forward matcher would have caught it", async () => {
    // Reverse index only finds party_1 -- a deliberate gap for party_2.
    findImpactedParties.mockReturnValue([{ partyId: "party_1", accountId: "acct_1", reasons: ["EXACT"] }]);
    // Ground truth (forward matcher) says BOTH party_1 and party_2 match
    // entity_1, and party_3 (an unrelated party) matches nothing.
    generateCandidates.mockImplementation((rawName: string) => {
      if (rawName === "Acme Corp" || rawName === "Acme Corporation") {
        return { candidates: [{ entity: { id: "entity_1" } }], exactMatchFound: false, alternateScreeningRan: false, alternateScreeningReason: "" };
      }
      return { candidates: [], exactMatchFound: false, alternateScreeningRan: false, alternateScreeningReason: "" };
    });

    const result = await validateRecallForWindow(windowStart, windowEnd);

    expect(result.passed).toBe(false);
    expect(result.missedByTargeted).toHaveLength(1);
    expect(result.missedByTargeted[0]).toMatchObject({ partyId: "party_2", accountId: "acct_1", entityId: "entity_1" });
    // party_1 (correctly found by the reverse index) and party_3 (no ground
    // truth match at all) must never appear as false positives.
    expect(result.missedByTargeted.some((m) => m.partyId === "party_1")).toBe(false);
    expect(result.missedByTargeted.some((m) => m.partyId === "party_3")).toBe(false);
  });

  it("checks ground truth under BOTH phonetic algorithms (calls generateCandidates twice per party, once per algorithm)", async () => {
    findImpactedParties.mockReturnValue([]);
    generateCandidates.mockReturnValue({ candidates: [], exactMatchFound: false, alternateScreeningRan: false, alternateScreeningReason: "" });

    await validateRecallForWindow(windowStart, windowEnd);

    const algorithmsUsed = generateCandidates.mock.calls.map((call) => call[2]?.phoneticAlgorithm);
    expect(algorithmsUsed).toEqual(expect.arrayContaining(["DOUBLE_METAPHONE", "METAPHONE2"]));
  });
});

describe("validateRecallForWindow: agreement case passes cleanly", () => {
  it("passes with an empty missedByTargeted and no false positive on an unrelated party when the reverse index and forward matcher agree", async () => {
    findImpactedParties.mockReturnValue([
      { partyId: "party_1", accountId: "acct_1", reasons: ["EXACT"] },
      { partyId: "party_2", accountId: "acct_1", reasons: ["RAW_WORD"] },
    ]);
    generateCandidates.mockImplementation((rawName: string) => {
      if (rawName === "Acme Corp" || rawName === "Acme Corporation") {
        return { candidates: [{ entity: { id: "entity_1" } }], exactMatchFound: false, alternateScreeningRan: false, alternateScreeningReason: "" };
      }
      return { candidates: [], exactMatchFound: false, alternateScreeningRan: false, alternateScreeningReason: "" };
    });

    const result = await validateRecallForWindow(windowStart, windowEnd);

    expect(result.passed).toBe(true);
    expect(result.missedByTargeted).toEqual([]);
  });

  it("restricts checking to a provided partyIdSample rather than the whole population", async () => {
    findImpactedParties.mockReturnValue([]);
    generateCandidates.mockReturnValue({ candidates: [], exactMatchFound: false, alternateScreeningRan: false, alternateScreeningReason: "" });

    const result = await validateRecallForWindow(windowStart, windowEnd, { partyIdSample: ["party_1"] });

    expect(result.partyCount).toBe(1);
  });
});

describe("recordRecallValidationResult", () => {
  it("marks the run COMPLETED when the validation passed, with no exceptions raised", async () => {
    dbMock.rdpsRun.update.mockResolvedValue({});

    await recordRecallValidationResult("run_1", {
      windowStart,
      windowEnd,
      changedEntityCount: 1,
      partyCount: 2,
      missedByTargeted: [],
      passed: true,
    });

    expect(dbMock.rdpsRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "run_1" }, data: expect.objectContaining({ status: "COMPLETED" }) })
    );
    expect(createExceptionItem).not.toHaveBeenCalled();
  });

  it("marks the run FAILED with an errorMessage and raises one exception per affected account when the validation failed", async () => {
    dbMock.rdpsRun.update.mockResolvedValue({});
    createExceptionItem.mockResolvedValue({ id: "exc_1" });

    await recordRecallValidationResult("run_1", {
      windowStart,
      windowEnd,
      changedEntityCount: 1,
      partyCount: 2,
      missedByTargeted: [
        { partyId: "party_2", accountId: "acct_1", entityId: "entity_1", entityName: "Acme Corp" },
      ],
      passed: false,
    });

    expect(dbMock.rdpsRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run_1" },
        data: expect.objectContaining({ status: "FAILED", errorMessage: expect.stringContaining("Recall validation failed") }),
      })
    );
    expect(createExceptionItem).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acct_1", type: "rdps_recall_gap", severity: "Critical" })
    );
  });
});
