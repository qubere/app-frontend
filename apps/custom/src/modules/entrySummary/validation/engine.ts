/**
 * Generic, data-driven validation rule runner (U5). Zero 7501-specific
 * knowledge lives here — that's U6's rules7501.ts. This module only knows how
 * to run a list of Rule objects against a draft and fold the results into a
 * deterministic ValidationResult.
 */

import type { Block, EntrySummaryDraft } from "../model";

export type Severity = "BLOCKING" | "WARNING" | "INFO";

const SEVERITY_RANK: Record<Severity, number> = { BLOCKING: 0, WARNING: 1, INFO: 2 };

export interface RuleFinding {
  code: string;
  severity: Severity;
  blocks: Block[];
  lineNumber?: number;
  message: string;
  remediation: { label: string; anchor: string };
}

export interface Rule<Ctx = unknown> {
  code: string;
  severity: Severity;
  blocks: Block[];
  title: string;
  cite?: string;
  evaluate(draft: EntrySummaryDraft, ctx: Ctx): RuleFinding[] | null;
}

export interface ValidationResult {
  findings: RuleFinding[];
  blockingCount: number;
  warningCount: number;
  isExportable: boolean;
}

export class DuplicateRuleCodeError extends Error {
  constructor(code: string) {
    super(`Rule code "${code}" is registered more than once. Rule codes must be unique.`);
    this.name = "DuplicateRuleCodeError";
  }
}

/** Throws if any two rules share a code. Call this wherever a rule set is assembled. */
export function assertUniqueRuleCodes<Ctx>(rules: Array<Rule<Ctx>>): void {
  const seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.code)) throw new DuplicateRuleCodeError(rule.code);
    seen.add(rule.code);
  }
}

function sortFindings(findings: RuleFinding[]): RuleFinding[] {
  return findings.slice().sort((a, b) => {
    const sevDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sevDiff !== 0) return sevDiff;
    const aLine = a.lineNumber ?? Number.POSITIVE_INFINITY;
    const bLine = b.lineNumber ?? Number.POSITIVE_INFINITY;
    if (aLine !== bLine) return aLine - bLine;
    return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });
}

/**
 * Runs every rule against the draft. A rule that throws does not abort the
 * run — its error is caught and converted into an INFO finding naming the
 * failed rule code, and the remaining rules still run.
 */
export function validateDraft<Ctx>(draft: EntrySummaryDraft, rules: Array<Rule<Ctx>>, ctx: Ctx): ValidationResult {
  assertUniqueRuleCodes(rules);

  const findings: RuleFinding[] = [];
  for (const rule of rules) {
    try {
      const result = rule.evaluate(draft, ctx);
      if (result) findings.push(...result);
    } catch (err) {
      findings.push({
        code: "E7501.ENGINE.RULE_ERROR",
        severity: "INFO",
        blocks: rule.blocks,
        message: `Rule "${rule.code}" threw while evaluating: ${err instanceof Error ? err.message : String(err)}`,
        remediation: { label: "Report this to engineering", anchor: "#rule-error" },
      });
    }
  }

  const sorted = sortFindings(findings);
  const blockingCount = sorted.filter((f) => f.severity === "BLOCKING").length;
  const warningCount = sorted.filter((f) => f.severity === "WARNING").length;

  return {
    findings: sorted,
    blockingCount,
    warningCount,
    isExportable: blockingCount === 0,
  };
}
