import { describe, it, expect } from "vitest";
import { buildShipmentActionGroups } from "./shipmentActions";
import type { DecisionGroup, DecisionRow } from "@/modules/decisions/groupDecisions";

function decision(overrides: Partial<DecisionRow> & { id: string; agentName: string }): DecisionRow {
  return {
    status: "Needs Review",
    proposedDescription: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    shipmentId: "s1",
    confidence: 0,
    ...overrides,
  } as DecisionRow;
}

function group(agentName: string, dec: DecisionRow): DecisionGroup {
  return {
    id: dec.id,
    shipmentId: "s1",
    shipmentNumber: "SHP-1",
    documentName: "Power of Attorney.pdf",
    documentId: "doc1",
    decisions: [dec],
    status: "Needs Review",
    latestCreatedAt: dec.createdAt,
  };
}

describe("buildShipmentActionGroups", () => {
  it("hides HTS/Origin cascade cards while the root product-description blocker is open", () => {
    const groups: DecisionGroup[] = [
      group(
        "Product Intelligence Agent",
        decision({ id: "pi", agentName: "Product Intelligence Agent", blockedReason: "WAITING_FOR_EXTRACTION" } as any)
      ),
      group(
        "HTS Classification Agent",
        decision({ id: "hts", agentName: "HTS Classification Agent", blockedReason: "BLOCKED_MISSING_DESCRIPTION" } as any)
      ),
      group(
        "Origin Agent",
        decision({ id: "origin", agentName: "Origin Agent", blockedReason: "BLOCKED_MISSING_ORIGIN" } as any)
      ),
    ];

    const result = buildShipmentActionGroups(groups, []);
    const ids = result.flatMap((g) => g.items.filter((i) => i.kind === "decision").map((i) => i.id));

    expect(ids).toEqual(["pi"]);
  });

  it("shows HTS/Origin cards once the root blocker is no longer present", () => {
    const groups: DecisionGroup[] = [
      group(
        "HTS Classification Agent",
        decision({ id: "hts", agentName: "HTS Classification Agent", blockedReason: "BLOCKED_MISSING_DESCRIPTION" } as any)
      ),
    ];

    const result = buildShipmentActionGroups(groups, []);
    const ids = result.flatMap((g) => g.items.filter((i) => i.kind === "decision").map((i) => i.id));

    expect(ids).toEqual(["hts"]);
  });
});
