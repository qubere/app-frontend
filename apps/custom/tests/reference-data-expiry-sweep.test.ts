import { describe, it, expect, vi, beforeEach } from "vitest";

// referenceDataExpirySweep: supersedes PUBLISHED entities whose own
// expirationDate has passed and records an EXPIRED ReferenceDataChangeSet
// for each -- distinct from SUPERSEDED (sweep-by-omission or an explicit
// delist) so reference-data-health and the Reference Changes UI can tell
// "this entity's own effective window ended" apart from "the source list no
// longer lists this entity at all".

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    screeningEntity: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const recordReferenceDataChanges = vi.fn().mockResolvedValue(undefined);
vi.mock("@/modules/screening/referenceDataChangeTracking", () => ({
  recordReferenceDataChanges: (...args: unknown[]) => recordReferenceDataChanges(...args),
}));

const { sweepExpiredReferenceData } = await import("@/modules/screening/referenceDataExpirySweep");

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.screeningEntity.updateMany.mockResolvedValue({ count: 0 });
  recordReferenceDataChanges.mockResolvedValue(undefined);
});

describe("sweepExpiredReferenceData", () => {
  it("is a no-op (no changes recorded) when nothing is past its expirationDate", async () => {
    dbMock.screeningEntity.findMany.mockResolvedValue([]);

    const result = await sweepExpiredReferenceData(new Date("2026-08-28T00:00:00Z"));

    expect(result.entitiesExpired).toBe(0);
    expect(result.ingestionRunId).toBeNull();
    expect(recordReferenceDataChanges).not.toHaveBeenCalled();
    expect(dbMock.screeningEntity.updateMany).not.toHaveBeenCalled();
  });

  it("supersedes each expired PUBLISHED candidate and records an EXPIRED change for it", async () => {
    dbMock.screeningEntity.findMany
      .mockResolvedValueOnce([
        { id: "se_1", sourceList: "SDN", provider: null },
        { id: "se_2", sourceList: "CSL", provider: null },
      ])
      .mockResolvedValueOnce([]);

    const now = new Date("2026-08-28T00:00:00Z");
    const result = await sweepExpiredReferenceData(now);

    expect(result.entitiesExpired).toBe(2);
    expect(dbMock.screeningEntity.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["se_1", "se_2"] } },
      data: { publicationStatus: "SUPERSEDED", supersededAt: now },
    });
    expect(recordReferenceDataChanges).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ screeningEntityId: "se_1", changeType: "EXPIRED" }),
        expect.objectContaining({ screeningEntityId: "se_2", changeType: "EXPIRED" }),
      ])
    );
  });

  it("only scans PUBLISHED entities whose expirationDate has passed", async () => {
    dbMock.screeningEntity.findMany.mockResolvedValue([]);
    const now = new Date("2026-08-28T00:00:00Z");

    await sweepExpiredReferenceData(now);

    expect(dbMock.screeningEntity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publicationStatus: "PUBLISHED", expirationDate: { lte: now } } })
    );
  });

  it("terminates after a final partial batch instead of looping forever", async () => {
    // A single batch smaller than SWEEP_BATCH_SIZE ends the loop without a second findMany.
    dbMock.screeningEntity.findMany.mockResolvedValueOnce([{ id: "se_1", sourceList: "SDN", provider: null }]);

    const result = await sweepExpiredReferenceData(new Date("2026-08-28T00:00:00Z"));

    expect(result.entitiesExpired).toBe(1);
    expect(dbMock.screeningEntity.findMany).toHaveBeenCalledTimes(1);
  });
});
