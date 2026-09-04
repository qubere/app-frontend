import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Party-level Pre-Approval must never let a newly created (or re-screened)
// Party bypass Restricted Party Screening. This is enforced structurally,
// not just behaviorally: the PARTY_MASTER screening path never imports or
// calls checkPreApprovalGate at all, and PARTY_MASTER is not in the
// pre-approval gate's reuse-eligible source set. Both are asserted here so a
// future edit that wires the gate into party creation/lifecycle screening
// fails a test rather than silently shipping a bypass.

const LIFECYCLE_FILE = join(process.cwd(), "src/modules/agents/compliance/restrictedParty/partyScreeningLifecycle.ts");
const PRE_APPROVAL_FILE = join(process.cwd(), "src/modules/agents/compliance/restrictedParty/preApproval.ts");

describe("Party creation/lifecycle screening never consults the pre-approval gate", () => {
  it("partyScreeningLifecycle.ts (rescreenParty) does not import checkPreApprovalGate", () => {
    const content = readFileSync(LIFECYCLE_FILE, "utf8");
    expect(content).not.toContain("checkPreApprovalGate");
  });

  it("partyScreeningLifecycle.ts screens with source PARTY_MASTER, not a reuse-eligible source", () => {
    const content = readFileSync(LIFECYCLE_FILE, "utf8");
    expect(content).toMatch(/source:\s*"PARTY_MASTER"/);
  });

  it("PARTY_MASTER is not in the pre-approval gate's reuse-eligible source set", () => {
    const content = readFileSync(PRE_APPROVAL_FILE, "utf8");
    const match = content.match(/REUSE_ELIGIBLE_SOURCES[^=]*=\s*new Set\(\[([^\]]*)\]\)/);
    expect(match).not.toBeNull();
    const eligible = match![1];
    expect(eligible).not.toContain("PARTY_MASTER");
  });
});

const {
  checkPreApprovalGate,
} = await import("@/modules/agents/compliance/restrictedParty/preApproval");

describe("checkPreApprovalGate itself refuses PARTY_MASTER regardless of any existing approval", () => {
  it("returns applied=false for source PARTY_MASTER without ever querying for an approval", async () => {
    const result = await checkPreApprovalGate({
      accountId: "acct_1",
      partyId: "party_1",
      source: "PARTY_MASTER",
    });
    expect(result.applied).toBe(false);
  });
});
