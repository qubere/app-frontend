import { describe, it, expect, vi, beforeEach } from "vitest";
import AdmZip from "adm-zip";

// SamGovExclusionsIngestionService: exercises the locate-extract -> download
// -> unzip -> parse -> upsert flow against a mocked db and a stubbed global
// fetch, so this never makes a real network call to api.sam.gov.

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

const { SamGovExclusionsIngestionService, transformExclusionRow } = await import(
  "@/modules/screening/samGovExclusionsIngestionService"
);

function buildExtractZip(csvContent: string): Buffer {
  const zip = new AdmZip();
  zip.addFile("SAM_Exclusions_Extract.csv", Buffer.from(csvContent, "utf-8"));
  return zip.toBuffer();
}

function upsertResult(overrides: Partial<{ id: string; providerRecordId: string; created: boolean }> = {}) {
  const created = overrides.created ?? true;
  const t1 = new Date("2026-01-01T00:00:00Z");
  const t2 = created ? t1 : new Date("2026-01-02T00:00:00Z");
  return {
    id: overrides.id ?? "row-1",
    providerRecordId: overrides.providerRecordId ?? "excl-1",
    createdAt: t1,
    updatedAt: t2,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  screeningEntityFindMany.mockResolvedValue([]);
  screeningEntityUpdateMany.mockResolvedValue({ count: 0 });
  referenceDataChangeSetCreateMany.mockResolvedValue({ count: 0 });
  process.env.SAM_GOV_API_KEY = "test-key";
});

describe("transformExclusionRow", () => {
  it("maps an entity-classified row using EntityName", () => {
    const result = transformExclusionRow({
      ExclusionID: "excl-1",
      EntityName: "Acme Widgets Inc",
      ClassificationType: "Firm",
      City: "Springfield",
      Country: "USA",
      ActiveDate: "2026-01-15",
    });
    expect(result).toMatchObject({
      providerRecordId: "excl-1",
      name: "Acme Widgets Inc",
      entityType: "ENTITY",
      city: "Springfield",
      country: "USA",
    });
    expect(result?.effectiveDate).toEqual(new Date("2026-01-15"));
  });

  it("maps an individual-classified row from first/last name fields", () => {
    const result = transformExclusionRow({
      ExclusionID: "excl-2",
      FirstName: "Jane",
      LastName: "Doe",
      ClassificationType: "Individual",
    });
    expect(result).toMatchObject({ providerRecordId: "excl-2", name: "Jane Doe", entityType: "INDIVIDUAL" });
  });

  it("returns null when no name field is present", () => {
    expect(transformExclusionRow({ ExclusionID: "excl-3", ClassificationType: "Firm" })).toBeNull();
  });
});

describe("SamGovExclusionsIngestionService.fetchAndIngest", () => {
  it("locates, downloads, unzips, and ingests exclusion records", async () => {
    const csv = "ExclusionID,EntityName,ClassificationType,Country\nexcl-1,Acme Widgets Inc,Firm,USA\n";
    const zipBuffer = buildExtractZip(csv);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ extractDetails: [{ downloadUrl: "https://api.sam.gov/data-services/v1/extracts/download?fileName=x" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength),
      });
    vi.stubGlobal("fetch", fetchMock);

    screeningEntityUpsert.mockResolvedValueOnce(upsertResult({ id: "row-1", providerRecordId: "excl-1" }));

    const result = await SamGovExclusionsIngestionService.fetchAndIngest();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screeningEntityUpsert).toHaveBeenCalledTimes(1);
    const call = screeningEntityUpsert.mock.calls[0][0];
    expect(call.where).toEqual({
      provider_providerRecordId: { provider: "SAM_GOV_EXCLUSIONS", providerRecordId: "excl-1" },
    });
    expect(call.create).toMatchObject({
      name: "Acme Widgets Inc",
      sourceList: "SAM_EXCLUSIONS",
      provider: "SAM_GOV_EXCLUSIONS",
      providerRecordId: "excl-1",
      entityType: "ENTITY",
    });
    expect(result.count).toBe(1);

    vi.unstubAllGlobals();
  });

  it("marks a previously PUBLISHED exclusion SUPERSEDED when absent from the new extract", async () => {
    const csv = "ExclusionID,EntityName,ClassificationType\nexcl-1,Still Excluded LLC,Firm\n";
    const zipBuffer = buildExtractZip(csv);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ downloadUrl: "https://api.sam.gov/download?x=1" }) })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength),
      });
    vi.stubGlobal("fetch", fetchMock);

    screeningEntityUpsert.mockResolvedValueOnce(upsertResult({ id: "row-1", providerRecordId: "excl-1" }));
    screeningEntityFindMany.mockResolvedValueOnce([
      { id: "row-1", providerRecordId: "excl-1" },
      { id: "row-2", providerRecordId: "excl-removed" },
    ]);

    const result = await SamGovExclusionsIngestionService.fetchAndIngest();

    expect(screeningEntityUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["row-2"] } },
      data: expect.objectContaining({ publicationStatus: "SUPERSEDED" }),
    });
    expect(result.supersededCount).toBe(1);

    vi.unstubAllGlobals();
  });

  it("throws when no download URL can be found in the extracts response", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ someField: "no url here" }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(SamGovExclusionsIngestionService.fetchAndIngest()).rejects.toThrow(/did not contain a download URL/);

    vi.unstubAllGlobals();
  });

  it("throws when SAM_GOV_API_KEY is not configured", async () => {
    delete process.env.SAM_GOV_API_KEY;
    await expect(SamGovExclusionsIngestionService.fetchAndIngest()).rejects.toThrow(/SAM_GOV_API_KEY is not configured/);
  });
});
