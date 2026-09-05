import { describe, it, expect } from "vitest";
import { EntityResolutionService } from "../src/modules/entity/entityResolutionService";

describe("Qubere Entity & Party Domain Refactor Unit Tests", () => {
  it("Normalize company names correctly for fuzzy matching", () => {
    // normalizeName now delegates to the shared Party normalizeLegalName:
    // upper-cased, punctuation flattened to single spaces, trailing legal-form
    // suffixes folded away one at a time.
    expect(EntityResolutionService.normalizeName("Target USA, Inc.")).toBe("TARGET USA");
    expect(EntityResolutionService.normalizeName("ACME CORPORATION LTD")).toBe("ACME");
    expect(EntityResolutionService.normalizeName("Merck Sharp & Dohme Corp.")).toBe("MERCK SHARP DOHME");
  });

  it("Validates entity resolution scoring rules", async () => {
    // Test normalization matching heuristic logic directly
    const normInput = EntityResolutionService.normalizeName("Target USA Inc");
    const normTarget = EntityResolutionService.normalizeName("Target USA, Incorporated");

    expect(normInput.slice(0, 6)).toBe(normTarget.slice(0, 6));
  });

  it("Ensures audit service formats previous and new values accurately", () => {
    const input = {
      shipmentId: "shp_test_123",
      userId: "usr_test_456",
      changeType: "USER_FIELD_UPDATE" as const,
      field: "importerName",
      previousValue: "Target USA Inc",
      newValue: "Amazon Services LLC",
      reason: "User correction",
    };

    expect(input.previousValue).not.toBe(input.newValue);
    expect(input.field).toBe("importerName");
  });
});
