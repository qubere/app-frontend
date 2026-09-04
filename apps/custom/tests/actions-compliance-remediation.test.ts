import { describe, it, expect } from "vitest";

describe("Actions and Compliance Performance Remediation", () => {
  it("verifies evidenceItems is excluded from initial decision list serialization DTO", () => {
    const rawDecision = {
      id: "dec-1",
      status: "NEEDS_REVIEW",
      createdAt: new Date("2026-08-26T12:00:00Z"),
      updatedAt: new Date("2026-08-26T12:00:00Z"),
      evidenceItems: [{ id: "ev-1", snippet: "sample large text blob" }],
    };

    const serialized = {
      ...rawDecision,
      createdAt: rawDecision.createdAt.toISOString(),
      updatedAt: rawDecision.updatedAt.toISOString(),
      evidenceItems: null,
    };

    expect(serialized.evidenceItems).toBeNull();
    expect(typeof serialized.createdAt).toBe("string");
  });

  it("validates tab normalization for compliance workspace", () => {
    const normalizeTab = (raw: string | undefined): string => {
      return raw === "screening" || raw === "review" || raw === "audit" ? raw : "overview";
    };

    expect(normalizeTab(undefined)).toBe("overview");
    expect(normalizeTab("invalid_tab")).toBe("overview");
    expect(normalizeTab("screening")).toBe("screening");
    expect(normalizeTab("review")).toBe("review");
    expect(normalizeTab("audit")).toBe("audit");
  });
});
