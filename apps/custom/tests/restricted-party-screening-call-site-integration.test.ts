import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Restricted / Denied-Party Screening: structural regression guard, not new
// behavior. The indexed-candidate work (RPS_CANDIDATE_MODE branching in
// restrictedPartyScreening.ts's runOnePass) is only recall-safe because every
// caller funnels through that single implementation -- a duplicated or
// shadow implementation elsewhere would silently bypass the coverage gate,
// SHADOW/CANDIDATE_PRIMARY branching, and the recall-safety fallbacks tested
// in candidate-index-service.test.ts.

const SRC_ROOT = join(__dirname, "..", "src");
const CANONICAL_MODULE = "restrictedPartyScreening";

const KNOWN_CALL_SITES = [
  "modules/agents/compliance/restrictedParty/shipmentScreening.ts",
  "modules/compliance/communityScreening/evaluator.ts",
  "modules/agents/compliance/restrictedParty/partyScreeningLifecycle.ts",
  "app/api/compliance/restricted-party-screening/ad-hoc/route.ts",
  "app/api/v1/screening/restricted-party/route.ts",
  "modules/complianceBatch/processing.ts",
  "modules/assistant/tools.ts",
];

describe("runRestrictedPartyScreening call sites", () => {
  it("every known call site imports the canonical implementation, not a shadow copy", () => {
    for (const relativePath of KNOWN_CALL_SITES) {
      const contents = readFileSync(join(SRC_ROOT, relativePath), "utf8");
      expect(contents).toMatch(/import\s*\{[^}]*runRestrictedPartyScreening[^}]*\}\s*from\s*["'][^"']*restrictedPartyScreening["']/);
      expect(contents).toContain("runRestrictedPartyScreening(");
    }
  });

  it("defines runRestrictedPartyScreening exactly once, in the canonical module", () => {
    const contents = readFileSync(join(SRC_ROOT, "modules/agents/compliance/restrictedParty/restrictedPartyScreening.ts"), "utf8");
    expect(contents).toContain("export async function runRestrictedPartyScreening(");

    for (const relativePath of KNOWN_CALL_SITES) {
      const callerContents = readFileSync(join(SRC_ROOT, relativePath), "utf8");
      expect(callerContents).not.toContain("export async function runRestrictedPartyScreening(");
      expect(callerContents).not.toContain("export function runRestrictedPartyScreening(");
    }
  });

  it("keeps RPS_CANDIDATE_MODE branching centralized in the canonical module (no per-caller candidate-mode logic)", () => {
    for (const relativePath of KNOWN_CALL_SITES) {
      const contents = readFileSync(join(SRC_ROOT, relativePath), "utf8");
      expect(contents).not.toContain("RPS_CANDIDATE_MODE");
    }
  });

  it("index.ts re-exports the same canonical implementation", () => {
    const indexContents = readFileSync(join(SRC_ROOT, "modules/agents/compliance/restrictedParty/index.ts"), "utf8");
    expect(indexContents).toMatch(new RegExp(`export\\s*\\{\\s*runRestrictedPartyScreening\\s*\\}\\s*from\\s*["']\\./${CANONICAL_MODULE}["']`));
  });
});
