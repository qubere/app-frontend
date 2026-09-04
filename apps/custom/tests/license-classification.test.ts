import { describe, it, expect } from "vitest";
import { normalizeClassification, isKnownClassificationType, CLASSIFICATION_TYPES } from "@/modules/licenses/classification";

describe("normalizeClassification", () => {
  it("accepts a well-formed ECCN", () => {
    const result = normalizeClassification({ type: "ECCN", value: "5a002.a.1" });
    expect(result.formatValid).toBe(true);
    expect(result.normalizedValue).toBe("5A002.A.1");
  });

  it("rejects a malformed ECCN", () => {
    const result = normalizeClassification({ type: "ECCN", value: "NOT-AN-ECCN" });
    expect(result.formatValid).toBe(false);
    expect(result.formatError).toBeTruthy();
  });

  it("rejects an empty value without throwing", () => {
    const result = normalizeClassification({ type: "HTS", value: "   " });
    expect(result.formatValid).toBe(false);
    expect(result.formatError).toContain("empty");
  });

  it("accepts a well-formed HTS code", () => {
    const result = normalizeClassification({ type: "HTS", value: "8471.30.01" });
    expect(result.formatValid).toBe(true);
  });

  it("accepts a well-formed Schedule B code", () => {
    const result = normalizeClassification({ type: "SCHEDULE_B", value: "8471300100" });
    expect(result.formatValid).toBe(true);
  });

  it("rejects a Schedule B code with the wrong digit count", () => {
    const result = normalizeClassification({ type: "SCHEDULE_B", value: "123" });
    expect(result.formatValid).toBe(false);
  });
});

describe("isKnownClassificationType", () => {
  it("recognizes every declared classification type", () => {
    for (const type of CLASSIFICATION_TYPES) {
      expect(isKnownClassificationType(type)).toBe(true);
    }
  });

  it("rejects an unknown type string", () => {
    expect(isKnownClassificationType("NOT_A_TYPE")).toBe(false);
  });
});
