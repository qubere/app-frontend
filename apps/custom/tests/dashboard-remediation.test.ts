import { describe, it, expect } from "vitest";
import { computeAgentOperationsFromGroups, type AgentDecisionGroup } from "../src/lib/dashboard/agentOperationsSummary";

describe("Dashboard Performance Remediation", () => {
  it("computes agent operations correctly from DB groupBy aggregates for >2,000 decisions", () => {
    const groups: AgentDecisionGroup[] = [
      { agentName: "HTS Classification Agent", status: "Approved", triageState: "APPROVED", count: 1200 },
      { agentName: "HTS Classification Agent", status: "Needs Review", triageState: "NEEDS_REVIEW", count: 350 },
      { agentName: "HTS Classification Agent", status: "Blocked", triageState: "BLOCKED", count: 150 },
      { agentName: "Origin Agent", status: "Approved", triageState: "APPROVED", count: 800 },
    ];

    const result = computeAgentOperationsFromGroups(groups);
    expect(result).toHaveLength(2);

    const htsAgent = result.find((r) => r.agentName === "HTS Classification Agent");
    expect(htsAgent).toBeDefined();
    expect(htsAgent?.processed).toBe(1700);
    expect(htsAgent?.verified).toBe(1200);
    expect(htsAgent?.needsReview).toBe(350);
    expect(htsAgent?.blocked).toBe(150);
  });

  it("keeps the shipment list cap above any realistic account until KPIs move to DB aggregates", async () => {
    // The Command Center's KPI tiles, "Requires Attention" ranking and broker
    // workload panel are all derived client-side from the same shipment list
    // the page loads (CommandCenterClient). Capping that list low silently
    // breaks those numbers for any account past the cap -- issue #200 req 2/14
    // forbid deriving KPIs from a capped list. Until the KPIs are recomputed
    // from DB aggregates, the cap must stay high enough to cover real accounts.
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../src/app/app/dashboard/page.tsx", import.meta.url), "utf8"),
    );
    const match = src.match(/SHIPMENT_ROW_CAP\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(2000);
  });
});
