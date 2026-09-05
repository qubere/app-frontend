import { describe, expect, it } from "vitest";

import { DuplicateRuleCodeError, validateDraft, type Rule, type RuleFinding } from "@/modules/entrySummary/validation/engine";
import type { EntrySummaryDraft } from "@/modules/entrySummary/model";

const DRAFT = {} as EntrySummaryDraft;

function makeRule(code: string, findings: RuleFinding[] | null | (() => RuleFinding[])): Rule<unknown> {
  return {
    code,
    severity: "INFO",
    blocks: [],
    title: code,
    evaluate: () => (typeof findings === "function" ? findings() : findings),
  };
}

function finding(overrides: Partial<RuleFinding> & Pick<RuleFinding, "code" | "severity">): RuleFinding {
  return { blocks: [], message: "msg", remediation: { label: "fix", anchor: "#x" }, ...overrides };
}

describe("validateDraft", () => {
  it("zero rules -> isExportable true, empty findings", () => {
    const result = validateDraft(DRAFT, [], {});
    expect(result.isExportable).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("one BLOCKING finding -> isExportable false, blockingCount 1", () => {
    const rules = [makeRule("R1", [finding({ code: "R1", severity: "BLOCKING" })])];
    const result = validateDraft(DRAFT, rules, {});
    expect(result.isExportable).toBe(false);
    expect(result.blockingCount).toBe(1);
  });

  it("only WARNINGs -> isExportable true, warningCount > 0", () => {
    const rules = [makeRule("R1", [finding({ code: "R1", severity: "WARNING" })])];
    const result = validateDraft(DRAFT, rules, {});
    expect(result.isExportable).toBe(true);
    expect(result.warningCount).toBeGreaterThan(0);
  });

  it("sorts by severity (BLOCKING > WARNING > INFO), then lineNumber asc (undefined last), then code asc", () => {
    const mixed: RuleFinding[] = [
      finding({ code: "Z", severity: "INFO" }),
      finding({ code: "B", severity: "BLOCKING", lineNumber: 3 }),
      finding({ code: "A", severity: "BLOCKING", lineNumber: 1 }),
      finding({ code: "C", severity: "BLOCKING" }), // no lineNumber -> last among BLOCKING
      finding({ code: "W2", severity: "WARNING", lineNumber: 2 }),
      finding({ code: "W1", severity: "WARNING", lineNumber: 1 }),
      finding({ code: "W0", severity: "WARNING" }),
      finding({ code: "I1", severity: "INFO", lineNumber: 1 }),
    ];
    const rules = [makeRule("R1", mixed)];
    const result = validateDraft(DRAFT, rules, {});
    expect(result.findings.map((f) => f.code)).toEqual(["A", "B", "C", "W1", "W2", "W0", "I1", "Z"]);
  });

  it("throws naming the code when a rule code is registered twice", () => {
    const rules = [makeRule("DUP", []), makeRule("DUP", [])];
    expect(() => validateDraft(DRAFT, rules, {})).toThrow(DuplicateRuleCodeError);
    expect(() => validateDraft(DRAFT, rules, {})).toThrow(/DUP/);
  });

  it("a throwing rule produces E7501.ENGINE.RULE_ERROR; a later rule's finding still runs", () => {
    const rules: Rule<unknown>[] = [
      { code: "BOOM", severity: "BLOCKING", blocks: [], title: "boom", evaluate: () => { throw new Error("kaboom"); } },
      makeRule("OK", [finding({ code: "OK", severity: "WARNING" })]),
    ];
    const result = validateDraft(DRAFT, rules, {});
    expect(result.findings.some((f) => f.code === "E7501.ENGINE.RULE_ERROR")).toBe(true);
    expect(result.findings.some((f) => f.code === "OK")).toBe(true);
  });

  it("is deterministic across 10 runs for the same draft+rules", () => {
    const rules = [
      makeRule("R1", [finding({ code: "R1", severity: "BLOCKING", lineNumber: 2 })]),
      makeRule("R2", [finding({ code: "R2", severity: "WARNING" })]),
    ];
    const runs = Array.from({ length: 10 }, () => JSON.stringify(validateDraft(DRAFT, rules, {})));
    expect(new Set(runs).size).toBe(1);
  });
});
