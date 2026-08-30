import { describe, it, expect } from "vitest";
import {
  FILTERS,
  bucketCounts,
  filterCases,
} from "@/app/app/classification/classificationInboxFilters";

const mk = (id: string, status: string, description = "widget") => ({ id, status, description });

const cases = [
  mk("c1", "PROPOSED", "steel bolt"),
  mk("c2", "HUMAN_REVIEW_REQUIRED", "copper wire"),
  mk("c3", "PROCESSING", "aluminium sheet"),
  mk("c4", "APPROVED", "steel pipe"),
  mk("c5", "FAILED", "unknown part"),
  mk("c6", "SUPERSEDED", "old classification"),
];

describe("classification inbox filters", () => {
  it("every filter key is unique and 'all' has a null status list", () => {
    expect(new Set(FILTERS.map((f) => f.key)).size).toBe(FILTERS.length);
    expect(FILTERS.find((f) => f.key === "all")?.statuses).toBeNull();
  });

  it("buckets each status into exactly one triage group (plus All)", () => {
    const counts = bucketCounts(cases);
    expect(counts).toEqual({
      review: 2, // PROPOSED, HUMAN_REVIEW_REQUIRED
      "in-progress": 1, // PROCESSING
      decided: 2, // APPROVED, SUPERSEDED
      failed: 1, // FAILED
      all: 6,
    });
  });

  it("filterCases narrows by status group", () => {
    expect(filterCases(cases, "review", "").map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(filterCases(cases, "all", "")).toHaveLength(6);
  });

  it("filterCases also matches the search query against description and id", () => {
    expect(filterCases(cases, "all", "steel").map((c) => c.id)).toEqual(["c1", "c4"]);
    expect(filterCases(cases, "all", "c3").map((c) => c.id)).toEqual(["c3"]);
    expect(filterCases(cases, "review", "copper").map((c) => c.id)).toEqual(["c2"]);
  });
});
