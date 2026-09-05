import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocking pattern follows tests/leg-routes.test.ts: vi.hoisted() dbMock,
// $transaction supporting both the callback and array forms.
const { dbMock, rows } = vi.hoisted(() => {
  const rows: any[] = [];
  let idCounter = 0;

  const entrySummaryDraft = {
    findFirst: vi.fn(async ({ where, orderBy }: any) => {
      let matches = rows.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));
      if (orderBy?.version === "desc") matches = matches.slice().sort((a, b) => b.version - a.version);
      return matches[0] ?? null;
    }),
    create: vi.fn(async ({ data }: any) => {
      if (rows.some((r) => r.shipmentId === data.shipmentId && r.version === data.version)) {
        const err: any = new Error("Unique constraint failed");
        err.code = "P2002";
        throw err;
      }
      const row = { id: `row_${++idCounter}`, supersededAt: null, approvedAt: null, approvedBy: null, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const row = rows.find((r) => r.id === where.id);
      if (!row) throw new Error("not found");
      Object.assign(row, data);
      return row;
    }),
  };

  const base = { entrySummaryDraft };
  return {
    rows,
    dbMock: {
      ...base,
      $transaction: vi.fn(async (arg: any) => (typeof arg === "function" ? arg(base) : Promise.all(arg))),
    },
  };
});

import {
  approveDraft,
  DraftLocked,
  DraftNotExportable,
  generateDraft,
  getDraft,
  updateDraftData,
} from "@/modules/entrySummary/draft.service";

beforeEach(() => {
  rows.length = 0;
  vi.clearAllMocks();
});

function genInput(overrides: Partial<Parameters<typeof generateDraft>[1]> = {}) {
  return {
    accountId: "acct_1",
    shipmentId: "shp_1",
    normalizedInput: { a: 1 },
    draft: {} as any,
    validation: { findings: [], blockingCount: 0, warningCount: 0, isExportable: true },
    generatedBy: "system",
    ...overrides,
  };
}

describe("generateDraft", () => {
  it("first generation creates version 1 with supersededAt null", async () => {
    const row = await generateDraft(dbMock as any, genInput());
    expect(row.version).toBe(1);
    expect(row.supersededAt).toBeNull();
  });

  it("regenerating with changed input creates version 2 and supersedes version 1", async () => {
    await generateDraft(dbMock as any, genInput({ normalizedInput: { a: 1 } }));
    const v2 = await generateDraft(dbMock as any, genInput({ normalizedInput: { a: 2 } }));
    expect(v2.version).toBe(2);
    const v1 = rows.find((r) => r.version === 1);
    expect(v1.supersededAt).not.toBeNull();
  });

  it("regenerating with unchanged input returns version 1 and creates no version 2", async () => {
    await generateDraft(dbMock as any, genInput({ normalizedInput: { a: 1 } }));
    const again = await generateDraft(dbMock as any, genInput({ normalizedInput: { a: 1 } }));
    expect(again.version).toBe(1);
    expect(rows.filter((r) => r.shipmentId === "shp_1")).toHaveLength(1);
  });

  it("two concurrent generateDraft calls land on versions 1 and 2, never two rows at version 1", async () => {
    const [a, b] = await Promise.all([
      generateDraft(dbMock as any, genInput({ normalizedInput: { a: "x" } })),
      generateDraft(dbMock as any, genInput({ normalizedInput: { a: "y" } })),
    ]);
    const versions = [a.version, b.version].sort();
    expect(versions).toEqual([1, 2]);
    expect(rows.filter((r) => r.version === 1)).toHaveLength(1);
  });
});

describe("approveDraft", () => {
  it("sets approvedAt/approvedBy on an exportable draft", async () => {
    await generateDraft(dbMock as any, genInput());
    const approved = await approveDraft(dbMock as any, { accountId: "acct_1", shipmentId: "shp_1", version: 1, approvedBy: "user_1" });
    expect(approved.approvedAt).not.toBeNull();
    expect(approved.approvedBy).toBe("user_1");
  });

  it("throws DraftNotExportable for a draft with blockingCount > 0 and writes nothing", async () => {
    await generateDraft(dbMock as any, genInput({ validation: { findings: [], blockingCount: 3, warningCount: 0, isExportable: false } }));
    await expect(approveDraft(dbMock as any, { accountId: "acct_1", shipmentId: "shp_1", version: 1, approvedBy: "user_1" })).rejects.toBeInstanceOf(DraftNotExportable);
    const row = rows.find((r) => r.version === 1);
    expect(row.approvedAt).toBeNull();
  });
});

describe("immutability", () => {
  it("mutating an approved draft's draftData throws DraftLocked", async () => {
    await generateDraft(dbMock as any, genInput());
    await approveDraft(dbMock as any, { accountId: "acct_1", shipmentId: "shp_1", version: 1, approvedBy: "user_1" });
    await expect(updateDraftData(dbMock as any, { accountId: "acct_1", shipmentId: "shp_1", version: 1, draftData: {} as any })).rejects.toBeInstanceOf(DraftLocked);
  });

  it("approving an already-approved version throws DraftLocked", async () => {
    await generateDraft(dbMock as any, genInput());
    await approveDraft(dbMock as any, { accountId: "acct_1", shipmentId: "shp_1", version: 1, approvedBy: "user_1" });
    await expect(approveDraft(dbMock as any, { accountId: "acct_1", shipmentId: "shp_1", version: 1, approvedBy: "user_2" })).rejects.toBeInstanceOf(DraftLocked);
  });
});

describe("cross-account isolation", () => {
  it("reading another account's draft returns null, not the record", async () => {
    await generateDraft(dbMock as any, genInput({ accountId: "acct_1", shipmentId: "shp_1" }));
    const result = await getDraft(dbMock as any, "acct_2", "shp_1", 1);
    expect(result).toBeNull();
  });
});
