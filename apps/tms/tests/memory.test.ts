import { describe, expect, it } from "vitest";
import { TmsAccountContextBuilder } from "../src/modules/memory/memory.context-builder";
import { buildLaneKey } from "../src/modules/memory/memory.domain-events";
import { fuseTmsMemoryResults } from "../src/modules/memory/memory.scorer";
import type {
  TmsAccountMemoryContext,
  TmsMemoryRecord,
} from "../src/modules/memory/memory.types";

function memory(overrides: Partial<TmsMemoryRecord> = {}): TmsMemoryRecord {
  const now = new Date();
  return {
    id: "mem-1",
    accountId: "acct-a",
    domain: "TMS",
    task: "CARRIER_SELECTION",
    agentName: "CarrierRecommendationAgent",
    type: "PREFERENCE",
    subjectType: "CARRIER",
    subjectId: "carrier-a",
    content: "Account approved Carrier A for this lane.",
    confidence: 1,
    validFrom: now,
    validUntil: null,
    sourceType: "HUMAN_DECISION",
    sourceId: "review-1",
    eventKey: "TMS:acct-a:review-1",
    supersedesMemoryId: null,
    embedding: [],
    searchVector: null,
    scope: { carrierId: "carrier-a", laneKey: "OCEAN|40HC|CNSHA|USOAK", outcome: "APPROVED" },
    occurrenceCount: 1,
    lastObservedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function context(memories: TmsMemoryRecord[]): TmsAccountMemoryContext {
  return {
    accountId: "acct-a",
    task: "CARRIER_SELECTION",
    memories: fuseTmsMemoryResults(memories, [], 10),
    memoryCount: memories.length,
    formattedText: "",
    retrievalStatus: memories.length ? "AVAILABLE" : "EMPTY",
  };
}

describe("TMS account memory", () => {
  it("creates stable lane keys from operational fields", () => {
    expect(buildLaneKey({
      mode: "ocean",
      equipment: "40HC",
      origin: { unlocode: "CNSHA" },
      destination: { unlocode: "USOAK" },
    })).toBe("OCEAN|40HC|CNSHA|USOAK");
  });

  it("boosts memories whose lane and mode match the current task", () => {
    const matching = memory({ id: "matching" });
    const otherLane = memory({
      id: "other",
      scope: { carrierId: "carrier-a", laneKey: "AIR|ULD|PVG|SFO", outcome: "APPROVED" },
    });
    const scored = fuseTmsMemoryResults([otherLane, matching], [], 10, {
      laneKey: "OCEAN|40HC|CNSHA|USOAK",
    });
    expect(scored[0].id).toBe("matching");
    expect(scored[0].scopeMatches).toBe(1);
  });

  it("applies time decay so equally ranked recent memory wins", () => {
    const recent = memory({ id: "recent", lastObservedAt: new Date() });
    const old = memory({
      id: "old",
      lastObservedAt: new Date(Date.now() - 730 * 86_400_000),
      validFrom: new Date(Date.now() - 730 * 86_400_000),
    });
    const scored = fuseTmsMemoryResults([old, recent], [old, recent], 10);
    expect(scored[0].id).toBe("recent");
    expect(scored[0].score).toBeGreaterThan(scored[1].score);
  });

  it("applies bounded human and tender outcome adjustments to carrier ranking", () => {
    const ctx = context([
      memory({ occurrenceCount: 2 }),
      memory({
        id: "tender-outcome",
        sourceType: "TENDER_OUTCOME",
        type: "PATTERN",
        occurrenceCount: 3,
        scope: { carrierId: "carrier-a", outcome: "ACCEPTED" },
      }),
    ]);
    expect(TmsAccountContextBuilder.carrierPreferenceAdjustment(ctx, { carrierId: "carrier-a" })).toBe(19);
    expect(TmsAccountContextBuilder.carrierPreferenceAdjustment(ctx, { carrierId: "carrier-b" })).toBe(0);
  });

  it("reuses only approved human margin and intake defaults", () => {
    const approved = memory({
      task: "RATE_QUOTING",
      subjectType: "LANE",
      scope: {
        outcome: "APPROVED",
        targetMarginPct: 18,
        mode: "OCEAN",
        equipment: "40HC",
        incoterm: "FOB",
        customsRequired: true,
      },
    });
    const ctx = context([approved]);
    expect(TmsAccountContextBuilder.rememberedTargetMargin(ctx)).toBe(18);
    expect(TmsAccountContextBuilder.rememberedIntakeDefaults(ctx)).toEqual({
      mode: "OCEAN",
      equipment: "40HC",
      serviceLevel: undefined,
      incoterm: "FOB",
      customsRequired: true,
    });
  });
});
