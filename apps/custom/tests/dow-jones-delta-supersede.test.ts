import { describe, it, expect, vi, beforeEach } from "vitest";

// dowJones/deltaFeedIngestionService: a delta-delivered delist (ActiveStatus
// flips away from "Active") must record changeType SUPERSEDED, matching the
// OFAC/BIS/UFLPA full-load sweep-by-omission convention -- not UPDATED,
// which would silently mask the delist from anything downstream that
// filters/reports by changeType (reference-data-health, the delta-impact
// dispatcher).

const upsertDowJonesEntity = vi.fn();
const parseDowJonesEntities = vi.fn();

vi.mock("@/modules/screening/dowJones/fullFeedIngestionService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/screening/dowJones/fullFeedIngestionService")>();
  return {
    ...actual,
    upsertDowJonesEntity: (...args: unknown[]) => upsertDowJonesEntity(...args),
    parseDowJonesEntities: (...args: unknown[]) => parseDowJonesEntities(...args),
  };
});

vi.mock("@/modules/screening/dowJones/dictionaryParser", () => ({
  parseSanctionsReferencesDictionary: vi.fn().mockResolvedValue(new Map()),
}));

const recordReferenceDataChanges = vi.fn().mockResolvedValue(undefined);
vi.mock("@/modules/screening/referenceDataChangeTracking", () => ({
  recordReferenceDataChanges: (...args: unknown[]) => recordReferenceDataChanges(...args),
}));

vi.mock("@/modules/screening/searchTokenSync", () => ({
  syncSearchTokensForEntities: vi.fn().mockResolvedValue(undefined),
}));

const { ingestDowJonesDeltaFeed } = await import("@/modules/screening/dowJones/deltaFeedIngestionService");

beforeEach(() => {
  vi.clearAllMocks();
  recordReferenceDataChanges.mockResolvedValue(undefined);
});

function rawEntity(id: string, activeStatus = "Active") {
  return {
    id,
    date: "2026-01-01",
    activeStatus,
    names: [{ nameType: "Primary Name", entityName: `Entity ${id}` }],
    companies: [],
    countries: [],
    idNumbers: [],
    references: [],
    sources: [],
  };
}

describe("dowJones/deltaFeedIngestionService: SUPERSEDED vs UPDATED classification on delist", () => {
  it("records changeType SUPERSEDED (not UPDATED) when a delta delivers a delist (ActiveStatus flips away from Active)", async () => {
    parseDowJonesEntities.mockResolvedValue({
      feedDate: new Date("2026-08-23T00:00:00Z"),
      feedType: "delta",
      entities: [rawEntity("1", "Inactive")],
      associationsCount: 0,
      personRecordsEncountered: 0,
    });
    upsertDowJonesEntity.mockResolvedValue({ id: "se_1", sourceList: "SDN", wasCreated: false });

    const result = await ingestDowJonesDeltaFeed("/tmp/delta.xml");

    expect(result.entitiesSuperseded).toBe(1);
    expect(result.entitiesUpdated).toBe(1);
    expect(recordReferenceDataChanges).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ screeningEntityId: "se_1", changeType: "SUPERSEDED" })])
    );
  });

  it("records changeType UPDATED (not SUPERSEDED) for an ordinary field update to an already-active entity", async () => {
    parseDowJonesEntities.mockResolvedValue({
      feedDate: new Date("2026-08-23T00:00:00Z"),
      feedType: "delta",
      entities: [rawEntity("2", "Active")],
      associationsCount: 0,
      personRecordsEncountered: 0,
    });
    upsertDowJonesEntity.mockResolvedValue({ id: "se_2", sourceList: "SDN", wasCreated: false });

    const result = await ingestDowJonesDeltaFeed("/tmp/delta.xml");

    expect(result.entitiesSuperseded).toBe(0);
    expect(recordReferenceDataChanges).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ screeningEntityId: "se_2", changeType: "UPDATED" })])
    );
  });

  it("records changeType ADDED for a brand-new entity, even if its own ActiveStatus is not Active", async () => {
    parseDowJonesEntities.mockResolvedValue({
      feedDate: new Date("2026-08-23T00:00:00Z"),
      feedType: "delta",
      entities: [rawEntity("3", "Active")],
      associationsCount: 0,
      personRecordsEncountered: 0,
    });
    upsertDowJonesEntity.mockResolvedValue({ id: "se_3", sourceList: "SDN", wasCreated: true });

    const result = await ingestDowJonesDeltaFeed("/tmp/delta.xml");

    expect(result.entitiesCreated).toBe(1);
    expect(recordReferenceDataChanges).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ screeningEntityId: "se_3", changeType: "ADDED" })])
    );
  });
});
