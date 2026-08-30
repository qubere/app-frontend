import { describe, it, expect } from "vitest";
import {
  mapEmbargoResult,
  mapPgaResult,
  mapReconResult,
} from "@/app/app/shipments/[id]/complianceCheckResults";

describe("mapEmbargoResult", () => {
  it("clears when nothing matches", () => {
    expect(mapEmbargoResult({ embargoResult: { isEmbargoed: false, status: "CLEARED", matchedRules: [] } })).toEqual({
      status: "clear",
      headline: "No OFAC / UFLPA embargo match.",
    });
  });

  it("blocks when a rule matches and carries the action", () => {
    const r = mapEmbargoResult({
      embargoResult: {
        isEmbargoed: true,
        status: "BLOCKED_SANCTIONED_REGION",
        matchedRules: [{ id: "1" }, { id: "2" }],
        actionRequired: "Obtain OFAC license.",
      },
    });
    expect(r.status).toBe("blocked");
    expect(r.headline).toBe("2 embargo rule match. Obtain OFAC license.");
  });

  it("reports not-screened when no rules are loaded (503 body)", () => {
    const r = mapEmbargoResult({ embargoResult: { status: "NOT_SCREENED", actionRequired: "No embargo rules loaded." } });
    expect(r.status).toBe("not-screened");
    expect(r.headline).toBe("No embargo rules loaded.");
  });

  it("is null-safe", () => {
    expect(mapEmbargoResult(null).status).toBe("not-screened");
  });
});

describe("mapPgaResult", () => {
  it("flags the agencies that require a filing", () => {
    const r = mapPgaResult({
      pgaScreening: {
        requiresPgaFiling: true,
        pgaFlagsCount: 2,
        flaggedAgencies: ["FDA", "FCC"],
        agenciesScreened: ["FDA", "FCC", "EPA"],
      },
    });
    expect(r).toEqual({
      status: "attention",
      headline: "2 requirements — FDA, FCC.",
      detail: "Screened FDA, FCC, EPA.",
    });
  });

  it("clears when nothing is flagged", () => {
    expect(mapPgaResult({ pgaScreening: { requiresPgaFiling: false, flaggedAgencies: [], agenciesScreened: ["FDA"] } }).status).toBe("clear");
  });

  it("reports not-screened when there was nothing to screen", () => {
    const r = mapPgaResult({ pgaScreening: { requiresPgaFiling: null, notScreenedReason: "No line items." } });
    expect(r).toEqual({ status: "not-screened", headline: "No line items." });
  });
});

describe("mapReconResult", () => {
  it("blocks on a critical mismatch", () => {
    expect(mapReconResult({ reconciliation: { status: "BLOCKED", issuesCount: 3, criticalCount: 1 } })).toEqual({
      status: "blocked",
      headline: "1 critical mismatch of 3.",
    });
  });

  it("warns on non-critical mismatches", () => {
    expect(mapReconResult({ reconciliation: { status: "WARNINGS", issuesCount: 2, criticalCount: 0 } }).headline).toBe(
      "2 mismatches to review."
    );
  });

  it("reports partial when checks were skipped", () => {
    const r = mapReconResult({ reconciliation: { status: "INCOMPLETE", skippedChecks: ["qty", "value"] } });
    expect(r).toEqual({ status: "not-screened", headline: "Partial — 2 check(s) skipped (missing documents)." });
  });

  it("clears on MATCHED", () => {
    expect(mapReconResult({ reconciliation: { status: "MATCHED", issuesCount: 0 } }).status).toBe("clear");
  });
});
