import { describe, expect, it } from "vitest";
import { importerReadiness, type ImporterReadinessInput } from "../src/modules/importers/importerReadiness";

const now = new Date("2026-09-04T00:00:00.000Z");
const readyImporter: ImporterReadinessInput = {
  id: "importer-1",
  clientId: "client-1",
  registrationStatus: "registered",
  bond: {
    status: "verified",
    expirationDate: "2027-09-04T00:00:00.000Z",
    bondAmount: "250000",
    continuousBondFormulaAmount: "180000",
  },
  powersOfAttorney: [{ status: "executed", expirationDate: "2027-09-04T00:00:00.000Z" }],
  onboardingEntities: [{ screeningStatus: "passed", bondCoverage: "own" }],
};

describe("importerReadiness", () => {
  it("marks a fully evidenced importer ready", () => {
    expect(importerReadiness(readyImporter, now)).toEqual({
      ready: true,
      blockers: [],
      completed: 5,
      total: 5,
      label: "Ready to file",
    });
  });

  it.each([
    ["FIVE_OH_SIX", { registrationStatus: "pending_5106" }],
    ["POA", { powersOfAttorney: [{ status: "executed", expirationDate: "2026-09-03T00:00:00.000Z" }] }],
    ["BOND", { bond: { ...readyImporter.bond!, bondAmount: "50000" } }],
    ["SCREENING", { onboardingEntities: [{ screeningStatus: "blocked", bondCoverage: "own" }] }],
    ["CLIENT", { clientId: null }],
  ])("surfaces the %s blocker independently", (code, patch) => {
    const result = importerReadiness({ ...readyImporter, ...patch }, now);
    expect(result.blockers.map((blocker) => blocker.code)).toContain(code);
    expect(result.ready).toBe(false);
  });

  it("accepts acknowledged single-transaction and broker bond coverage", () => {
    for (const bondCoverage of ["single_transaction", "broker_bond"]) {
      const result = importerReadiness({
        ...readyImporter,
        bond: null,
        onboardingEntities: [{ screeningStatus: "overridden", bondCoverage }],
      }, now);
      expect(result.blockers.map((blocker) => blocker.code)).not.toContain("BOND");
      expect(result.blockers.map((blocker) => blocker.code)).not.toContain("SCREENING");
    }
  });

  it("shows the next operational state rather than a generic failure", () => {
    const result = importerReadiness({
      ...readyImporter,
      powersOfAttorney: [{ status: "out_for_signature", expirationDate: null }],
      onboardingEntities: [{ screeningStatus: "blocked", bondCoverage: "own" }],
    }, now);
    expect(result.blockers.find((blocker) => blocker.code === "POA")?.label).toContain("awaiting signature");
    expect(result.blockers.find((blocker) => blocker.code === "SCREENING")?.label).toContain("compliance authority");
  });
});
