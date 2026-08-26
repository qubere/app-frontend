import { describe, it, expect, vi, beforeEach } from "vitest";

// Restricted / Denied-Party Screening: restrictedPartyRepository.ts's
// getApprovedDispositions. Covers: a disposition (APPROVED/FALSE_POSITIVE)
// suppresses future matches against the same screeningEntityId, but only
// while it still speaks to the entity data the reviewer actually saw -- a
// watchlist republish after the reviewer's decision must resume normal
// matching for that entity, not suppress it forever.

const restrictedPartyDispositionFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    restrictedPartyDisposition: { findMany: restrictedPartyDispositionFindMany },
  },
}));

const { getApprovedDispositions } = await import(
  "@/modules/agents/compliance/restrictedParty/restrictedPartyRepository"
);

function dispositionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "disposition_1",
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    result: {
      matches: [
        {
          screeningEntityId: "entity_1",
          screeningEntity: { publishedAt: new Date("2026-01-01T00:00:00Z") },
        },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getApprovedDispositions: freshness of a suppressing disposition", () => {
  it("suppresses a match when the entity has not been republished since the disposition", async () => {
    restrictedPartyDispositionFindMany.mockResolvedValue([dispositionRow()]);
    const map = await getApprovedDispositions("acct_1", "party_1");
    expect(map.get("entity_1")).toBe("disposition_1");
  });

  it("does not suppress once the entity has been republished after the reviewer's decision", async () => {
    restrictedPartyDispositionFindMany.mockResolvedValue([
      dispositionRow({
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        result: {
          matches: [
            {
              screeningEntityId: "entity_1",
              screeningEntity: { publishedAt: new Date("2026-06-01T00:00:00Z") },
            },
          ],
        },
      }),
    ]);
    const map = await getApprovedDispositions("acct_1", "party_1");
    expect(map.has("entity_1")).toBe(false);
  });

  it("still suppresses when the entity has never been republished (publishedAt null)", async () => {
    restrictedPartyDispositionFindMany.mockResolvedValue([
      dispositionRow({
        result: {
          matches: [{ screeningEntityId: "entity_1", screeningEntity: { publishedAt: null } }],
        },
      }),
    ]);
    const map = await getApprovedDispositions("acct_1", "party_1");
    expect(map.get("entity_1")).toBe("disposition_1");
  });

  it("falls back to an older, still-fresh disposition for a different entity when the newest one is stale", async () => {
    restrictedPartyDispositionFindMany.mockResolvedValue([
      dispositionRow({
        id: "disposition_newer_stale",
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        result: {
          matches: [
            {
              screeningEntityId: "entity_1",
              screeningEntity: { publishedAt: new Date("2026-06-01T00:00:00Z") },
            },
          ],
        },
      }),
      dispositionRow({
        id: "disposition_older_fresh",
        updatedAt: new Date("2025-01-01T00:00:00Z"),
        result: {
          matches: [
            {
              screeningEntityId: "entity_2",
              screeningEntity: { publishedAt: new Date("2024-01-01T00:00:00Z") },
            },
          ],
        },
      }),
    ]);
    const map = await getApprovedDispositions("acct_1", "party_1");
    expect(map.has("entity_1")).toBe(false);
    expect(map.get("entity_2")).toBe("disposition_older_fresh");
  });
});
