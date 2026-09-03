import { describe, it, expect, vi, beforeEach } from "vitest";

// FbiWantedIngestionService: exercises the paginated JSON fetch + upsert +
// supersede logic against a mocked db and a stubbed _httpsGetJson, so this
// never makes a real network call to api.fbi.gov.

const screeningEntityUpsert = vi.fn();
const screeningEntityFindMany = vi.fn();
const screeningEntityUpdateMany = vi.fn();
const referenceDataChangeSetCreateMany = vi.fn();

const dbMock = {
  screeningEntity: {
    upsert: screeningEntityUpsert,
    findMany: screeningEntityFindMany,
    updateMany: screeningEntityUpdateMany,
  },
  referenceDataChangeSet: { createMany: referenceDataChangeSetCreateMany },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@qubere/db", () => ({ db: dbMock }));

vi.mock("@/modules/screening/searchTokenSync", () => ({
  syncSearchTokensForEntities: vi.fn().mockResolvedValue(undefined),
}));

const { FbiWantedIngestionService } = await import("@/modules/screening/fbiWantedIngestionService");

function upsertResult(overrides: Partial<{ id: string; providerRecordId: string; created: boolean }> = {}) {
  const created = overrides.created ?? true;
  const t1 = new Date("2026-01-01T00:00:00Z");
  const t2 = created ? t1 : new Date("2026-01-02T00:00:00Z");
  return {
    id: overrides.id ?? "row-1",
    providerRecordId: overrides.providerRecordId ?? "uid-1",
    createdAt: t1,
    updatedAt: t2,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  screeningEntityFindMany.mockResolvedValue([]);
  screeningEntityUpdateMany.mockResolvedValue({ count: 0 });
  referenceDataChangeSetCreateMany.mockResolvedValue({ count: 0 });
});

describe("FbiWantedIngestionService.fetchAndIngest", () => {
  it("skips postings with no named subject and upserts named ones on the (provider, providerRecordId) key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: {
        total: 2,
        items: [
          { uid: "seeking-info-1", title: "", subjects: ["Seeking Information"] },
          {
            uid: "uid-1",
            title: "John Q. Fugitive",
            aliases: ["Johnny Fugitive"],
            subjects: ["Ten Most Wanted Fugitives"],
            nationality: "American",
            possible_countries: ["Mexico"],
            description: "Wanted for bank robbery.",
            url: "https://www.fbi.gov/wanted/topten/john-q-fugitive",
            publication: "2026-05-01T00:00:00",
            modified: "2026-05-02T00:00:00+00:00",
          },
        ],
      },
    });
    FbiWantedIngestionService._httpsGetJson = fetchMock;
    screeningEntityUpsert.mockResolvedValueOnce(upsertResult({ id: "row-1", providerRecordId: "uid-1" }));

    const result = await FbiWantedIngestionService.fetchAndIngest();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screeningEntityUpsert).toHaveBeenCalledTimes(1);
    const call = screeningEntityUpsert.mock.calls[0][0];
    expect(call.where).toEqual({ provider_providerRecordId: { provider: "FBI_WANTED", providerRecordId: "uid-1" } });
    expect(call.create).toMatchObject({
      name: "John Q. Fugitive",
      alternateNames: ["Johnny Fugitive"],
      country: "Mexico",
      nationalityCountry: "American",
      sourceList: "FBI_WANTED",
      sourceAuthority: "FBI",
      provider: "FBI_WANTED",
      providerRecordId: "uid-1",
      entityType: "INDIVIDUAL",
      agency: "FBI (Federal Bureau of Investigation)",
    });

    expect(result.count).toBe(1);
    expect(result.reportedTotal).toBe(2);
  });

  it("marks a previously PUBLISHED subject SUPERSEDED when it no longer appears in the fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: { total: 1, items: [{ uid: "uid-1", title: "Still Wanted Corp Guy" }] },
    });
    FbiWantedIngestionService._httpsGetJson = fetchMock;
    screeningEntityUpsert.mockResolvedValueOnce(upsertResult({ id: "row-1", providerRecordId: "uid-1" }));
    screeningEntityFindMany.mockResolvedValueOnce([
      { id: "row-1", providerRecordId: "uid-1" },
      { id: "row-2", providerRecordId: "uid-arrested" },
    ]);

    const result = await FbiWantedIngestionService.fetchAndIngest();

    expect(screeningEntityUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["row-2"] } },
      data: expect.objectContaining({ publicationStatus: "SUPERSEDED" }),
    });
    expect(result.supersededCount).toBe(1);
  });

  it("throws without writing anything when the API reports 0 total records", async () => {
    FbiWantedIngestionService._httpsGetJson = vi.fn().mockResolvedValue({ status: 200, json: { total: 0, items: [] } });

    await expect(FbiWantedIngestionService.fetchAndIngest()).rejects.toThrow(/0 total records/);
    expect(screeningEntityUpsert).not.toHaveBeenCalled();
  });

  it("throws when the API returns a non-OK HTTP status", async () => {
    FbiWantedIngestionService._httpsGetJson = vi.fn().mockResolvedValue({ status: 503, json: null });

    await expect(FbiWantedIngestionService.fetchAndIngest()).rejects.toThrow(/HTTP 503/);
  });
});
