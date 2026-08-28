import { describe, it, expect, vi, beforeEach } from "vitest";

// RDPS: proves the delta-impact re-evaluation path (dispatcher -> impact
// analysis -> Preview Impact / Impacted Parties drill-down) is dataset-
// agnostic. OFAC SDN, BIS CSL, and UFLPA Entity List ingestion already write
// ReferenceDataChangeSet rows via recordReferenceDataChanges (see
// ofacSdnIngestionService.ts, bisCslIngestionService.ts,
// uflpaEntityListIngestionService.ts) using the exact same datasetId/
// sourceList-tagged shape Dow Jones does. Nothing in the dispatcher or
// rdpsQueryService filters by datasetId, so a change originating from any of
// those engines must flow through re-evaluation identically to a Dow Jones
// change. This suite exists so a future change that accidentally scopes
// re-evaluation to one dataset (e.g. a `datasetId` filter added while fixing
// something Dow-Jones-specific) fails loudly here instead of silently
// dropping OFAC/BIS/UFLPA reference-data changes from continuous monitoring.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    referenceDataChangeSet: { findMany: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    rdpsRun: { create: vi.fn(), update: vi.fn() },
    screeningEntity: { findMany: vi.fn() },
    rdpsPartyOutcome: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    party: { findMany: vi.fn() },
    partyScreeningSummary: { findUnique: vi.fn() },
    partyScreeningApproval: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const buildPartyIdentityIndex = vi.fn();
const findImpactedParties = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/impactAnalysis", () => ({
  buildPartyIdentityIndex: (...args: unknown[]) => buildPartyIdentityIndex(...args),
  findImpactedParties: (...args: unknown[]) => findImpactedParties(...args),
}));

const rescreenParty = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/partyScreeningLifecycle", () => ({
  rescreenParty: (...args: unknown[]) => rescreenParty(...args),
  STATUS_SEVERITY: { CLEAR: 0, REVIEW_REQUIRED: 1, HIT: 2, ERROR: 0, SKIPPED: 0, PARTIAL: 0 },
  worseStatus: (a: string, b: string) => a,
}));
vi.mock("@/lib/exceptions/createException", () => ({ createExceptionItem: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(), AuditAction: { RDPS_WORSENING_DETECTED: "RDPS_WORSENING_DETECTED" } }));
vi.mock("@/lib/billing/telemetry", () => ({ recordUsageEvent: vi.fn() }));

const { RdpsDeltaImpactDispatcher } = await import("@/modules/compliance/rdps/deltaImpactDispatcher");
const { previewReferenceChangeImpact, listImpactsForChange } = await import("@/modules/compliance/rdps/rdpsQueryService");

// One change set per non-Dow-Jones screening engine, each tagged with that
// engine's own datasetId/sourceList exactly as its ingestion service writes
// it (see OFAC_DATASET_ID/BIS_DATASET_ID/UFLPA_DATASET_ID constants).
const NON_DOW_JONES_CHANGE_SETS = [
  { id: "chg_ofac", datasetId: "ofac-sdn", screeningEntityId: "se_ofac", sourceList: "SDN" },
  { id: "chg_bis", datasetId: "bis-csl", screeningEntityId: "se_bis", sourceList: "ENTITY_LIST" },
  { id: "chg_uflpa", datasetId: "uflpa-entity-list", screeningEntityId: "se_uflpa", sourceList: "UFLPA_ENTITY_LIST" },
];

beforeEach(() => {
  vi.clearAllMocks();
  buildPartyIdentityIndex.mockResolvedValue([]);
});

describe("RdpsDeltaImpactDispatcher: consumes ReferenceDataChangeSet rows from every screening engine, not just Dow Jones", () => {
  it("claims and processes OFAC/BIS/UFLPA-originated change sets identically to Dow Jones ones -- no datasetId filter anywhere in the query", async () => {
    const now = new Date();
    const pending = NON_DOW_JONES_CHANGE_SETS.map((c) => ({ ...c, occurredAt: now, consumedAt: null }));

    dbMock.referenceDataChangeSet.findMany.mockResolvedValue(pending);
    dbMock.referenceDataChangeSet.updateMany.mockResolvedValue({ count: 1 });
    dbMock.rdpsRun.create.mockResolvedValue({ id: "run_1" });
    dbMock.rdpsRun.update.mockResolvedValue({});
    dbMock.screeningEntity.findMany.mockResolvedValue(
      NON_DOW_JONES_CHANGE_SETS.map((c) => ({ id: c.screeningEntityId, sourceList: c.sourceList }))
    );

    // Every claimed entity, regardless of which engine produced it, impacts
    // one party in its own tenant -- proves the reverse-index match path
    // (findImpactedParties) is invoked per entity with no dataset gating.
    findImpactedParties.mockImplementation((entity: { id: string }) => [
      { partyId: `party_${entity.id}`, accountId: `acct_${entity.id}`, reasons: ["EXACT"] },
    ]);
    dbMock.partyScreeningSummary.findUnique.mockResolvedValue(null);
    dbMock.partyScreeningApproval.findFirst.mockResolvedValue(null);
    rescreenParty.mockResolvedValue({ overallStatus: "CLEAR", results: [{ passType: "PARTY_NAME", id: "res_1" }] });
    dbMock.rdpsPartyOutcome.create.mockResolvedValue({ id: "outcome_1" });

    const result = await RdpsDeltaImpactDispatcher.dispatchPending();

    // Confirms the dispatcher's own claim query never filters by datasetId --
    // it only asks for unconsumed change sets. Fetch the actual mock call to
    // make an accidental "where: { datasetId: ..., consumedAt: null }"
    // regression fail this assertion.
    expect(dbMock.referenceDataChangeSet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { consumedAt: null } })
    );

    expect(result.changeSetCount).toBe(3);
    expect(result.candidatePartyCount).toBe(3);
    expect(result.screenedCount).toBe(3);
    expect(findImpactedParties).toHaveBeenCalledTimes(3);

    // Every claimed change set -- OFAC, BIS, and UFLPA alike -- must actually
    // reach the party outcome recorder, not just be claimed and dropped.
    const recordedPartyIds = dbMock.rdpsPartyOutcome.create.mock.calls.map((c) => c[0].data.partyId);
    expect(recordedPartyIds).toEqual(
      expect.arrayContaining(["party_se_ofac", "party_se_bis", "party_se_uflpa"])
    );
  });
});

describe("previewReferenceChangeImpact / listImpactsForChange: work identically for a non-Dow-Jones change set", () => {
  it.each(NON_DOW_JONES_CHANGE_SETS)(
    "previews impact for a $datasetId ($sourceList) change set the same way it would for Dow Jones",
    async ({ id, screeningEntityId, sourceList }) => {
      dbMock.referenceDataChangeSet.findUnique.mockResolvedValue({
        id,
        screeningEntity: { id: screeningEntityId, sourceList, addresses: [], aliases: [] },
      });
      findImpactedParties.mockReturnValue([
        { partyId: "party_own", accountId: "acct_1", reasons: new Set(["EXACT"]) },
      ]);
      dbMock.party.findMany.mockResolvedValue([
        { id: "party_own", names: [{ rawName: "Acme Trading Co" }], screeningSummary: { screeningStatus: "CLEAR", lastScreenedAt: null } },
      ]);

      const candidates = await previewReferenceChangeImpact("acct_1", id);

      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toMatchObject({ partyId: "party_own", accountId: "acct_1" });
    }
  );

  it.each(NON_DOW_JONES_CHANGE_SETS)(
    "drills into Impacted Parties for a $datasetId change set via triggeringChangeSetIds, unfiltered by dataset",
    async ({ id }) => {
      dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([
        { id: "outcome_1", transitionType: "NEW_HIT", party: { names: [{ rawName: "Acme Trading Co" }] } },
      ]);
      dbMock.rdpsPartyOutcome.count.mockResolvedValue(1);

      const { impacts } = await listImpactsForChange("acct_1", id, {});

      expect(dbMock.rdpsPartyOutcome.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { accountId: "acct_1", triggeringChangeSetIds: { has: id } } })
      );
      expect(impacts[0]).toMatchObject({ partyDisplayName: "Acme Trading Co" });
    }
  );
});
