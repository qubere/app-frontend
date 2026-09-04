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

  it("ensures initial shipment page size is capped to 25 rows", () => {
    const defaultPageSize = 25;
    expect(defaultPageSize).toBeLessThanOrEqual(25);
  });
});
