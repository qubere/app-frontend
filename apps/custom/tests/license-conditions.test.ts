import { describe, it, expect } from "vitest";
import { normalizeConditions } from "@/modules/licenses/conditions";

describe("normalizeConditions", () => {
  it("defaults every flag to UNKNOWN when no input is provided", () => {
    const result = normalizeConditions(undefined);
    expect(result.flags.governmentEndUser).toBe("UNKNOWN");
    expect(result.unknownFlags).toContain("governmentEndUser");
    expect(result.hasSensitiveEndUse).toBe(false);
  });

  it("never collapses UNKNOWN to false for sensitive end-use flags", () => {
    const result = normalizeConditions({ militaryEndUser: "UNKNOWN" });
    expect(result.flags.militaryEndUser).toBe("UNKNOWN");
    expect(result.hasSensitiveEndUse).toBe(false);
    expect(result.unknownFlags).toContain("militaryEndUser");
  });

  it("flags hasSensitiveEndUse when any sensitive condition is TRUE", () => {
    const result = normalizeConditions({ nuclearEndUse: "TRUE" });
    expect(result.hasSensitiveEndUse).toBe(true);
  });

  it("does not treat non-sensitive TRUE flags as sensitive end-use", () => {
    const result = normalizeConditions({ internalUseOnly: "TRUE", usSubsidiary: "TRUE" });
    expect(result.hasSensitiveEndUse).toBe(false);
  });

  it("flags isReplacementParts only when explicitly TRUE", () => {
    expect(normalizeConditions({ replacementPartsIndicator: "TRUE" }).isReplacementParts).toBe(true);
    expect(normalizeConditions({ replacementPartsIndicator: "FALSE" }).isReplacementParts).toBe(false);
    expect(normalizeConditions(undefined).isReplacementParts).toBe(false);
  });
});
