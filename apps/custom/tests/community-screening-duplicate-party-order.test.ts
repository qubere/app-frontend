import { describe, it, expect } from "vitest";
import { deriveLegacyPartyStatusMap } from "@/modules/compliance/communityScreening/aggregation";

// Community Screening: duplicate Party-ID handling is mandatory (see
// CommunityScreening_ImplementationLogic.md). Party ID alone is never the
// internal uniqueness key -- CommunityScreeningPartyResult is keyed by
// (runId, rowNumber) -- so every occurrence for a duplicated Party ID keeps
// its own independent findings. deriveLegacyPartyStatusMap is the one place
// that collapses occurrence-level results down to a Party-ID-keyed view for
// legacy-compatible consumers, and it must never let a later PASSED
// occurrence overwrite an earlier FAILED (or worse) occurrence for the same
// Party ID, regardless of arrival order.

describe("deriveLegacyPartyStatusMap", () => {
  it("keeps FAILED when occurrence A fails and a later occurrence B for the same Party ID passes", () => {
    const map = deriveLegacyPartyStatusMap([
      { partyId: "PARTY-1001", status: "FAILED" },
      { partyId: "PARTY-1001", status: "PASSED" },
    ]);
    expect(map["PARTY-1001"]).toBe("FAILED");
  });

  it("keeps FAILED regardless of order -- PASSED first, then FAILED", () => {
    const map = deriveLegacyPartyStatusMap([
      { partyId: "PARTY-1001", status: "PASSED" },
      { partyId: "PARTY-1001", status: "FAILED" },
    ]);
    expect(map["PARTY-1001"]).toBe("FAILED");
  });

  it("PASSED + PASSED => PASSED", () => {
    const map = deriveLegacyPartyStatusMap([
      { partyId: "PARTY-1002", status: "PASSED" },
      { partyId: "PARTY-1002", status: "PASSED" },
    ]);
    expect(map["PARTY-1002"]).toBe("PASSED");
  });

  it("ERROR + PASSED => ERROR (ERROR outranks every other status)", () => {
    const map = deriveLegacyPartyStatusMap([
      { partyId: "PARTY-1003", status: "ERROR" },
      { partyId: "PARTY-1003", status: "PASSED" },
    ]);
    expect(map["PARTY-1003"]).toBe("ERROR");
  });

  it("INCOMPLETE + PASSED => INCOMPLETE", () => {
    const map = deriveLegacyPartyStatusMap([
      { partyId: "PARTY-1004", status: "INCOMPLETE" },
      { partyId: "PARTY-1004", status: "PASSED" },
    ]);
    expect(map["PARTY-1004"]).toBe("INCOMPLETE");
  });

  it("FAILED + FAILED => FAILED", () => {
    const map = deriveLegacyPartyStatusMap([
      { partyId: "PARTY-1005", status: "FAILED" },
      { partyId: "PARTY-1005", status: "FAILED" },
    ]);
    expect(map["PARTY-1005"]).toBe("FAILED");
  });

  it("preserves independent per-occurrence results alongside the collapsed map -- both occurrences are still distinguishable by the caller", () => {
    const occurrences = [
      { partyId: "PARTY-1001", status: "FAILED" as const, rowNumber: 1 },
      { partyId: "PARTY-1001", status: "PASSED" as const, rowNumber: 2 },
    ];
    const map = deriveLegacyPartyStatusMap(occurrences);

    expect(occurrences).toHaveLength(2);
    expect(occurrences[0].status).toBe("FAILED");
    expect(occurrences[1].status).toBe("PASSED");
    expect(map["PARTY-1001"]).toBe("FAILED");
  });

  it("excludes rows with no Party ID -- there is nothing to key them by in a Party-ID map", () => {
    const map = deriveLegacyPartyStatusMap([
      { partyId: null, status: "FAILED" },
      { partyId: "PARTY-1006", status: "PASSED" },
    ]);
    expect(map).toEqual({ "PARTY-1006": "PASSED" });
  });

  it("tracks multiple distinct Party IDs independently", () => {
    const map = deriveLegacyPartyStatusMap([
      { partyId: "PARTY-A", status: "FAILED" },
      { partyId: "PARTY-B", status: "PASSED" },
      { partyId: "PARTY-A", status: "PASSED" },
    ]);
    expect(map).toEqual({ "PARTY-A": "FAILED", "PARTY-B": "PASSED" });
  });
});
