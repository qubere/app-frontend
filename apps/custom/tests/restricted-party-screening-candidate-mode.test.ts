import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Restricted / Denied-Party Screening: restrictedPartyScreening.ts's
// RPS_CANDIDATE_MODE branching (CANDIDATE_PRIMARY / SHADOW). Mocks
// restrictedPartyRepository (reference data) and candidateIndexService (the
// indexed lookup + coverage gate) so these tests never touch a real
// database. The one invariant every case here protects: SHADOW mode's
// actual output (matches/status) must be byte-for-byte identical to
// LEGACY_ONLY, and any index failure/incomplete-coverage in CANDIDATE_PRIMARY
// must fall back to the full scan rather than narrowing to nothing.

const getRestrictedPartyReferenceList = vi.fn();
const getRedFlagRules = vi.fn();
const getApprovedDispositions = vi.fn();
const getAccountScreeningConfig = vi.fn();
const getLatestReferenceDataPublishedAt = vi.fn();

vi.mock("@/modules/agents/compliance/restrictedParty/restrictedPartyRepository", () => ({
  getRestrictedPartyReferenceList,
  getRedFlagRules,
  getApprovedDispositions,
  getAccountScreeningConfig,
  getLatestReferenceDataPublishedAt,
}));

const selectCandidateEntityIdsFromIndex = vi.fn();
const isIndexCoverageAcceptable = vi.fn();

vi.mock("@/modules/agents/compliance/restrictedParty/candidateIndexService", () => ({
  selectCandidateEntityIdsFromIndex,
  isIndexCoverageAcceptable,
}));

const rpsIndexLoggerInfo = vi.fn();
const rpsIndexLoggerWarn = vi.fn();

vi.mock("@/modules/agents/compliance/restrictedParty/rpsIndexLogger", () => ({
  rpsIndexLogger: { info: rpsIndexLoggerInfo, warn: rpsIndexLoggerWarn },
}));

const { runRestrictedPartyScreening } = await import(
  "@/modules/agents/compliance/restrictedParty/restrictedPartyScreening"
);

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    accountId: "acct_1",
    source: "PUBLIC_API",
    identity: { name: "Acme Trading Co" },
    ...overrides,
  } as Parameters<typeof runRestrictedPartyScreening>[0];
}

function screeningEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: "entity_1",
    entityHash: "hash_1",
    entityType: "COMPANY",
    name: "Acme Trading Co",
    alternateNames: [],
    address: null,
    city: null,
    country: null,
    nationalityCountry: null,
    programCodes: ["SDN"],
    remarks: null,
    sourceList: "SDN",
    publicationStatus: "PUBLISHED",
    publishedAt: new Date("2024-01-01"),
    supersededAt: null,
    sourcePublishedAt: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

const ORIGINAL_MODE = process.env.RPS_CANDIDATE_MODE;

beforeEach(() => {
  vi.clearAllMocks();
  getApprovedDispositions.mockResolvedValue(new Map());
  getAccountScreeningConfig.mockResolvedValue(null);
  getLatestReferenceDataPublishedAt.mockResolvedValue(null);
  getRestrictedPartyReferenceList.mockResolvedValue([screeningEntity()]);
  getRedFlagRules.mockResolvedValue([]);
});

afterEach(() => {
  if (ORIGINAL_MODE === undefined) delete process.env.RPS_CANDIDATE_MODE;
  else process.env.RPS_CANDIDATE_MODE = ORIGINAL_MODE;
});

describe("runRestrictedPartyScreening: RPS_CANDIDATE_MODE=CANDIDATE_PRIMARY", () => {
  it("narrows the scan to the indexed candidate set and still reports the HIT", async () => {
    process.env.RPS_CANDIDATE_MODE = "CANDIDATE_PRIMARY";
    isIndexCoverageAcceptable.mockResolvedValue(true);
    selectCandidateEntityIdsFromIndex.mockResolvedValue({
      candidateEntityIds: new Set(["entity_1"]),
      diagnostics: { inputTokenCount: 2, candidateEntityCount: 1, truncated: false, queryDurationMs: 3, topCandidateScore: 1 },
    });

    const result = await runRestrictedPartyScreening(baseInput());

    expect(result.passes[0].status).toBe("HIT");
    expect(selectCandidateEntityIdsFromIndex).toHaveBeenCalledTimes(1);
    expect(rpsIndexLoggerInfo).toHaveBeenCalledWith("candidate_primary_lookup", expect.objectContaining({ candidateEntityCount: 1 }));
  });

  it("falls back to the full scan (never an empty scan) when coverage is not acceptable", async () => {
    process.env.RPS_CANDIDATE_MODE = "CANDIDATE_PRIMARY";
    isIndexCoverageAcceptable.mockResolvedValue(false);

    const result = await runRestrictedPartyScreening(baseInput());

    expect(result.passes[0].status).toBe("HIT");
    expect(selectCandidateEntityIdsFromIndex).not.toHaveBeenCalled();
  });

  it("falls back to the full scan (never an empty scan) when the indexed lookup throws", async () => {
    process.env.RPS_CANDIDATE_MODE = "CANDIDATE_PRIMARY";
    isIndexCoverageAcceptable.mockResolvedValue(true);
    selectCandidateEntityIdsFromIndex.mockRejectedValue(new Error("db unavailable"));

    const result = await runRestrictedPartyScreening(baseInput());

    expect(result.passes[0].status).toBe("HIT");
  });
});

describe("runRestrictedPartyScreening: RPS_CANDIDATE_MODE=SHADOW", () => {
  it("returns output identical to LEGACY_ONLY while logging a shadow comparison", async () => {
    isIndexCoverageAcceptable.mockResolvedValue(true);
    selectCandidateEntityIdsFromIndex.mockResolvedValue({
      candidateEntityIds: new Set(["entity_1"]),
      diagnostics: { inputTokenCount: 2, candidateEntityCount: 1, truncated: false, queryDurationMs: 3, topCandidateScore: 1 },
    });

    delete process.env.RPS_CANDIDATE_MODE;
    const legacyResult = await runRestrictedPartyScreening(baseInput());

    process.env.RPS_CANDIDATE_MODE = "SHADOW";
    const shadowResult = await runRestrictedPartyScreening(baseInput());

    expect(shadowResult.passes[0].status).toBe(legacyResult.passes[0].status);
    expect(shadowResult.passes[0].matches).toEqual(legacyResult.passes[0].matches);
    expect(rpsIndexLoggerInfo).toHaveBeenCalledWith(
      "shadow_comparison",
      expect.objectContaining({ fullScanCandidateCount: 1, missedByIndexCount: 0 })
    );
  });

  it("logs a warning and still returns the full-scan result when the indexed lookup throws", async () => {
    process.env.RPS_CANDIDATE_MODE = "SHADOW";
    isIndexCoverageAcceptable.mockResolvedValue(true);
    selectCandidateEntityIdsFromIndex.mockRejectedValue(new Error("db unavailable"));

    const result = await runRestrictedPartyScreening(baseInput());

    expect(result.passes[0].status).toBe("HIT");
    expect(rpsIndexLoggerWarn).toHaveBeenCalledWith("shadow_comparison_failed", expect.objectContaining({ error: "db unavailable" }));
  });
});
