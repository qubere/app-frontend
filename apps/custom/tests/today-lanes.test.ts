import { describe, it, expect } from "vitest";
import {
  billingExceptionToItem,
  groupLaneItems,
  normalizeReviewFindingSeverity,
  normalizeUpperSeverity,
  reviewFindingToItem,
  screeningFindingToItem,
  summarizeLane,
  type BillingExceptionRow,
  type ReviewFindingRow,
  type ScreeningFindingRow,
  type TodayLaneItem,
} from "@/modules/today/todayLanes";

const T0 = new Date("2026-08-01T00:00:00.000Z");
const T1 = new Date("2026-08-02T00:00:00.000Z");

describe("severity normalizers", () => {
  it("maps ComplianceFinding severities", () => {
    expect(normalizeReviewFindingSeverity("Critical")).toBe("critical");
    expect(normalizeReviewFindingSeverity("High")).toBe("high");
    expect(normalizeReviewFindingSeverity("Warning")).toBe("normal");
    expect(normalizeReviewFindingSeverity("Info")).toBe("normal");
  });

  it("maps UPPER-case severities and is case-insensitive", () => {
    expect(normalizeUpperSeverity("CRITICAL")).toBe("critical");
    expect(normalizeUpperSeverity("high")).toBe("high");
    expect(normalizeUpperSeverity("MEDIUM")).toBe("normal");
    expect(normalizeUpperSeverity("LOW")).toBe("normal");
  });
});

describe("row -> item mappers", () => {
  it("groups a review finding by its shipment and links to the review tab", () => {
    const row: ReviewFindingRow = {
      id: "cf1",
      rule: "Valuation Variance",
      severity: "High",
      description: "Declared value 12% below transfer price",
      status: "Open",
      createdAt: T0,
      filing: {
        id: "fil1",
        entryNumber: "ENT-1",
        shipment: { id: "shp1", shipmentNumber: "SHP-1", client: { id: "c1", name: "Globex" } },
      },
    };
    const item = reviewFindingToItem(row);
    expect(item).toMatchObject({
      lane: "compliance",
      kind: "review-finding",
      severity: "high",
      groupKey: "shp1",
      groupLabel: "SHP-1",
      clientName: "Globex",
      shipmentNumber: "SHP-1",
      href: "/app/compliance?tab=review",
    });
  });

  it("falls back to the entry number when a finding has no shipment", () => {
    const row: ReviewFindingRow = {
      id: "cf2",
      rule: "HTS Override",
      severity: "Info",
      description: "x",
      status: "Investigating",
      createdAt: T0,
      filing: { id: "fil2", entryNumber: "ENT-9", shipment: null },
    };
    const item = reviewFindingToItem(row);
    expect(item.groupKey).toBe("fil2");
    expect(item.groupLabel).toBe("Entry ENT-9");
    expect(item.clientName).toBeNull();
  });

  it("maps a screening finding with a readable category label", () => {
    const row: ScreeningFindingRow = {
      id: "sf1",
      category: "MILITARY_END_USE",
      ruleName: "EAR 744.21",
      severity: "CRITICAL",
      details: "Consignee on MEU list",
      status: "OPEN",
      createdAt: T1,
      shipment: { id: "shp2", shipmentNumber: "SHP-2", client: null },
    };
    const item = screeningFindingToItem(row);
    expect(item.title).toBe("MILITARY END USE: EAR 744.21");
    expect(item.severity).toBe("critical");
    expect(item.href).toBe("/app/compliance?tab=screening");
    expect(item.groupKey).toBe("shp2");
  });

  it("maps a billing exception, grouping by shipment then client then self", () => {
    const base: BillingExceptionRow = {
      id: "be1",
      type: "RATE_CARD_GAP",
      severity: "HIGH",
      description: "No rate card matches this charge",
      status: "OPEN",
      createdAt: T0,
      shipment: null,
      client: { id: "c9", name: "Initech" },
    };
    expect(billingExceptionToItem(base)).toMatchObject({
      lane: "billing",
      title: "Rate Card Gap",
      groupKey: "c9",
      groupLabel: "Initech",
      href: "/app/billing/exceptions",
    });
    expect(billingExceptionToItem({ ...base, shipment: { id: "s1", shipmentNumber: "SHP-7" } }).groupKey).toBe("s1");
    expect(billingExceptionToItem({ ...base, client: null }).groupKey).toBe("be1");
  });
});

describe("groupLaneItems", () => {
  const mk = (over: Partial<TodayLaneItem>): TodayLaneItem => ({
    id: "x",
    lane: "compliance",
    kind: "k",
    severity: "normal",
    title: "t",
    summary: "s",
    groupKey: "g",
    groupLabel: "G",
    clientName: null,
    shipmentNumber: null,
    href: "/app/compliance",
    createdAt: T0.toISOString(),
    ...over,
  });

  it("buckets by groupKey and orders groups most-severe first", () => {
    const groups = groupLaneItems([
      mk({ id: "a", groupKey: "g1", groupLabel: "G1", severity: "normal" }),
      mk({ id: "b", groupKey: "g2", groupLabel: "G2", severity: "critical" }),
      mk({ id: "c", groupKey: "g1", groupLabel: "G1", severity: "high" }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["g2", "g1"]);
    // group severity is the worst in the group
    expect(groups.find((g) => g.key === "g1")!.severity).toBe("high");
    // items within a group are most-severe first
    expect(groups.find((g) => g.key === "g1")!.items.map((i) => i.id)).toEqual(["c", "a"]);
  });

  it("is stable for equal severity + timestamp (ties break on id / label)", () => {
    const a = groupLaneItems([
      mk({ id: "2", groupKey: "k2", groupLabel: "B" }),
      mk({ id: "1", groupKey: "k1", groupLabel: "A" }),
    ]);
    const b = groupLaneItems([
      mk({ id: "1", groupKey: "k1", groupLabel: "A" }),
      mk({ id: "2", groupKey: "k2", groupLabel: "B" }),
    ]);
    expect(a.map((g) => g.key)).toEqual(b.map((g) => g.key));
    expect(a.map((g) => g.key)).toEqual(["k1", "k2"]);
  });
});

describe("summarizeLane", () => {
  it("counts open + critical and returns grouped cards", () => {
    const items = [
      reviewFindingToItem({
        id: "1", rule: "R", severity: "Critical", description: "d", status: "Open", createdAt: T0,
        filing: { id: "f", entryNumber: "E", shipment: { id: "s", shipmentNumber: "SHP", client: null } },
      }),
      billingExceptionToItem({
        id: "2", type: "T", severity: "LOW", description: "d", status: "OPEN", createdAt: T0,
        shipment: { id: "s", shipmentNumber: "SHP" }, client: null,
      }),
    ];
    const summary = summarizeLane("compliance", items);
    expect(summary.openCount).toBe(2);
    expect(summary.criticalCount).toBe(1);
    expect(summary.groups).toHaveLength(1);
    expect(summary.groups[0].key).toBe("s");
  });

  it("is empty-safe", () => {
    expect(summarizeLane("billing", [])).toEqual({
      lane: "billing",
      openCount: 0,
      criticalCount: 0,
      groups: [],
    });
  });
});
