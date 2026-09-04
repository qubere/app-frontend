import { describe, it, expect, vi, beforeEach } from "vitest";

// RDPS reference-data-health rollup: getReferenceDataHealth() must attribute
// each dataset's Added/Updated/Removed/Expired counts to that dataset's own
// LATEST ingestion run only (never cumulative across all runs), and must
// surface the new EXPIRED count for the cross-cutting expiry-sweep dataset
// (reference-data-expiry-sweep.ts) as its own row.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    datasetRefreshLog: { findMany: vi.fn() },
    referenceDataChangeSet: { findMany: vi.fn(), groupBy: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/modules/agents/compliance/restrictedParty/impactAnalysis", () => ({
  buildPartyIdentityIndex: vi.fn(),
  findImpactedParties: vi.fn(),
}));

const { getReferenceDataHealth } = await import("@/modules/compliance/rdps/rdpsQueryService");

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.datasetRefreshLog.findMany.mockResolvedValue([]);
  dbMock.referenceDataChangeSet.findMany.mockResolvedValue([]);
  dbMock.referenceDataChangeSet.groupBy.mockResolvedValue([]);
});

describe("getReferenceDataHealth: per-dataset rollup", () => {
  it("returns one row per known dataset, including the expiry-sweep dataset, even with no data at all", async () => {
    const rows = await getReferenceDataHealth();

    expect(rows.map((r) => r.datasetId)).toContain("reference-data-expiry-sweep");
    for (const row of rows) {
      expect(row.added).toBe(0);
      expect(row.updated).toBe(0);
      expect(row.removed).toBe(0);
      expect(row.expired).toBe(0);
      expect(row.importStatus).toBeNull();
    }
  });

  it("surfaces the expiry sweep's EXPIRED count on its own dataset row", async () => {
    dbMock.referenceDataChangeSet.findMany.mockResolvedValue([
      { datasetId: "reference-data-expiry-sweep", ingestionRunId: "run_sweep_1" },
    ]);
    dbMock.referenceDataChangeSet.groupBy.mockResolvedValue([
      { datasetId: "reference-data-expiry-sweep", ingestionRunId: "run_sweep_1", changeType: "EXPIRED", _count: { _all: 3 } },
    ]);

    const rows = await getReferenceDataHealth();
    const sweepRow = rows.find((r) => r.datasetId === "reference-data-expiry-sweep");

    expect(sweepRow?.expired).toBe(3);
    expect(sweepRow?.added).toBe(0);
    expect(sweepRow?.removed).toBe(0);
  });

  it("attributes counts to each dataset's own latest run only, never mixing runs or datasets", async () => {
    dbMock.referenceDataChangeSet.findMany.mockResolvedValue([
      { datasetId: "ofac-sdn", ingestionRunId: "run_ofac_latest" },
      { datasetId: "bis-csl", ingestionRunId: "run_bis_latest" },
    ]);
    dbMock.referenceDataChangeSet.groupBy.mockResolvedValue([
      // Latest OFAC run: counted.
      { datasetId: "ofac-sdn", ingestionRunId: "run_ofac_latest", changeType: "ADDED", _count: { _all: 5 } },
      { datasetId: "ofac-sdn", ingestionRunId: "run_ofac_latest", changeType: "SUPERSEDED", _count: { _all: 2 } },
      // A stale prior OFAC run: must NOT be added into the latest-run counts.
      { datasetId: "ofac-sdn", ingestionRunId: "run_ofac_stale", changeType: "ADDED", _count: { _all: 999 } },
      // BIS CSL's own latest run: must not leak into OFAC's counts.
      { datasetId: "bis-csl", ingestionRunId: "run_bis_latest", changeType: "UPDATED", _count: { _all: 7 } },
    ]);

    const rows = await getReferenceDataHealth();
    const ofacRow = rows.find((r) => r.datasetId === "ofac-sdn");
    const bisRow = rows.find((r) => r.datasetId === "bis-csl");

    expect(ofacRow).toMatchObject({ added: 5, removed: 2, updated: 0, expired: 0 });
    expect(bisRow).toMatchObject({ added: 0, updated: 7, removed: 0, expired: 0 });
  });

  it("reports lastSuccessfulImportAt/recordCount from the last SUCCESS run, and importStatus/errorMessage from the last run of any status", async () => {
    dbMock.datasetRefreshLog.findMany.mockImplementation(({ where }: any) => {
      if (where.status === "SUCCESS") {
        return Promise.resolve([
          {
            datasetId: "ofac-sdn",
            status: "SUCCESS",
            startedAt: new Date("2026-08-20T00:00:00Z"),
            completedAt: new Date("2026-08-20T01:00:00Z"),
            errorMessage: null,
            sourcePublishDate: new Date("2026-08-19T00:00:00Z"),
            itemsIngested: 12000,
            sourceReportedTotal: 12000,
          },
        ]);
      }
      return Promise.resolve([
        {
          datasetId: "ofac-sdn",
          status: "FAILED",
          startedAt: new Date("2026-08-27T00:00:00Z"),
          completedAt: new Date("2026-08-27T00:05:00Z"),
          errorMessage: "source unreachable",
          sourcePublishDate: null,
          itemsIngested: null,
          sourceReportedTotal: null,
        },
      ]);
    });

    const rows = await getReferenceDataHealth();
    const ofacRow = rows.find((r) => r.datasetId === "ofac-sdn");

    expect(ofacRow?.importStatus).toBe("FAILED");
    expect(ofacRow?.lastImportErrorMessage).toBe("source unreachable");
    expect(ofacRow?.lastSuccessfulImportAt).toEqual(new Date("2026-08-20T01:00:00Z"));
    expect(ofacRow?.recordCount).toBe(12000);
  });
});
