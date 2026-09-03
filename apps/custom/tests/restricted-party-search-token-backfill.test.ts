import { describe, it, expect, vi, beforeEach } from "vitest";

// Restricted / Denied-Party Screening: restrictedPartySearchTokenBackfill.ts's
// validate-coverage step. Captures the real handler by mocking
// inngest.createFunction to record its (config, handler) args instead of
// registering with the Inngest SDK, then invokes that handler directly with
// a fake `step` (runs each step's callback inline, no queueing) and a fully
// mocked @/lib/db -- same style as candidate-index-service.test.ts.

const datasetRefreshLogFindFirst = vi.fn();
const datasetRefreshLogCreate = vi.fn();
const datasetRefreshLogUpdate = vi.fn();
const screeningEntityFindMany = vi.fn();
const screeningEntityCount = vi.fn();
const screeningSearchTokenFindMany = vi.fn();
const screeningSearchTokenCount = vi.fn();
const syncSearchTokensForEntities = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    datasetRefreshLog: {
      findFirst: datasetRefreshLogFindFirst,
      create: datasetRefreshLogCreate,
      update: datasetRefreshLogUpdate,
    },
    screeningEntity: { findMany: screeningEntityFindMany, count: screeningEntityCount },
    screeningSearchToken: { findMany: screeningSearchTokenFindMany, count: screeningSearchTokenCount },
  },
}));

vi.mock("@/modules/screening/searchTokenSync", () => ({
  syncSearchTokensForEntities,
}));

let capturedHandler: ((args: { step: any; event: any }) => Promise<any>) | null = null;

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: (_config: unknown, handler: any) => {
      capturedHandler = handler;
      return { fn: handler };
    },
  },
}));

function fakeStep() {
  return {
    run: async (_name: string, fn: () => Promise<any>) => fn(),
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  capturedHandler = null;
  // Re-import fresh each time so module-level `capturedHandler` capture from
  // createFunction actually happens (the module is only evaluated once per
  // process without this reset).
  vi.resetModules();
  await import("@/lib/inngest/functions/restrictedPartySearchTokenBackfill");
});

describe("rpsSearchTokenBackfillJob", () => {
  it("marks the run FAILED when the post-backfill zero-token gap exceeds the material threshold", async () => {
    datasetRefreshLogFindFirst.mockResolvedValueOnce(null); // no already-running
    datasetRefreshLogFindFirst.mockResolvedValueOnce(null); // no last-failed checkpoint
    datasetRefreshLogCreate.mockResolvedValue({ id: "log-1" });
    screeningEntityFindMany.mockResolvedValueOnce([{ id: "e1" }]).mockResolvedValueOnce([]);
    screeningSearchTokenCount.mockResolvedValue(1);
    syncSearchTokensForEntities.mockResolvedValue(undefined);

    // 100 total, only 90 indexed -> 10% gap, over the 1% threshold.
    screeningEntityCount.mockResolvedValue(100);
    screeningSearchTokenFindMany.mockResolvedValue(Array.from({ length: 90 }, (_, i) => ({ screeningEntityId: `e${i}` })));

    expect(capturedHandler).toBeTruthy();
    await expect(capturedHandler!({ step: fakeStep(), event: { name: "rps-search-token-backfill/run.requested" } })).rejects.toThrow(
      /exceeds the 1% material-gap threshold/
    );

    const failureUpdate = datasetRefreshLogUpdate.mock.calls.find((call) => call[0].data.status === "FAILED");
    expect(failureUpdate).toBeDefined();
    expect(failureUpdate![0].data.errorMessage).toMatch(/exceeds the 1% material-gap threshold/);
    expect(datasetRefreshLogUpdate.mock.calls.some((call) => call[0].data.status === "SUCCESS")).toBe(false);
  });

  it("marks the run SUCCESS when the zero-token gap is within the material threshold", async () => {
    datasetRefreshLogFindFirst.mockResolvedValueOnce(null);
    datasetRefreshLogFindFirst.mockResolvedValueOnce(null);
    datasetRefreshLogCreate.mockResolvedValue({ id: "log-1" });
    screeningEntityFindMany.mockResolvedValueOnce([{ id: "e1" }]).mockResolvedValueOnce([]);
    screeningSearchTokenCount.mockResolvedValue(1);
    syncSearchTokensForEntities.mockResolvedValue(undefined);

    // 100 total, 100 indexed -> no gap.
    screeningEntityCount.mockResolvedValue(100);
    screeningSearchTokenFindMany.mockResolvedValue(Array.from({ length: 100 }, (_, i) => ({ screeningEntityId: `e${i}` })));

    const result = await capturedHandler!({ step: fakeStep(), event: { name: "rps-search-token-backfill/run.requested" } });

    expect(result.entitiesWithZeroTokens).toBe(0);
    const successUpdate = datasetRefreshLogUpdate.mock.calls.find((call) => call[0].data.status === "SUCCESS");
    expect(successUpdate).toBeDefined();
  });
});
