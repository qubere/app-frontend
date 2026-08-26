import { triageDecision } from "@/modules/decisions/decisionState";

export interface AgentDecisionRow {
  agentName: string;
  shipmentId: string | null;
  status: string;
  triageState: string | null;
  proposedDescription: string | null;
  createdAt: Date | string;
  autoApproved?: boolean;
  currentHtsCode?: string | null;
  proposedHtsCode?: string | null;
}

export interface AgentOperationsRow {
  agentName: string;
  /** Shipments with a current (latest) decision from this agent. */
  processed: number;
  needsReview: number;
  blocked: number;
  verified: number;
  /**
   * Share of human-approved proposals this agent's reviewers changed rather
   * than accepted as-is, or null when this agent doesn't propose a value
   * (currentHtsCode/proposedHtsCode) that a human could override. Computed
   * over every human approval this agent ever received, not just the latest
   * decision per shipment, since a superseded row is still a real override event.
   */
  overrideRate: number | null;
}

/**
 * Per-agent operational counts, using the same "latest decision per agent per
 * shipment" rule the rest of the Command Center already relies on (see
 * page.tsx's aiReview tally) so a superseded decision never double-counts.
 *
 * `decisions` should be the same capped, tenant-scoped list the dashboard
 * already loads — this does not issue its own query.
 */
export function computeAgentOperations(decisions: AgentDecisionRow[]): AgentOperationsRow[] {
  const latestByShipmentAgent = new Map<string, AgentDecisionRow>();
  for (const d of decisions) {
    const key = `${d.shipmentId}::${d.agentName}`;
    const existing = latestByShipmentAgent.get(key);
    if (!existing || new Date(d.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
      latestByShipmentAgent.set(key, d);
    }
  }

  const byAgent = new Map<string, AgentOperationsRow>();
  // Override rate is a historical rate over every human approval this agent
  // ever received, so it's tallied across the full decisions list -- not the
  // latest-per-shipment map above, which would silently drop a superseded
  // decision's override even though a human genuinely overrode it at the time.
  const overrideEligible = new Map<string, number>();
  const overridden = new Map<string, number>();
  for (const d of decisions) {
    if (d.autoApproved || d.status !== "Approved") continue;
    if (!d.currentHtsCode || !d.proposedHtsCode) continue;
    overrideEligible.set(d.agentName, (overrideEligible.get(d.agentName) ?? 0) + 1);
    if (d.currentHtsCode !== d.proposedHtsCode) {
      overridden.set(d.agentName, (overridden.get(d.agentName) ?? 0) + 1);
    }
  }

  for (const d of latestByShipmentAgent.values()) {
    if (!byAgent.has(d.agentName)) {
      byAgent.set(d.agentName, { agentName: d.agentName, processed: 0, needsReview: 0, blocked: 0, verified: 0, overrideRate: null });
    }
    const row = byAgent.get(d.agentName)!;
    row.processed++;
    const triage = triageDecision({ status: d.status, triageState: d.triageState, proposedDescription: d.proposedDescription });
    if (triage === "blocked") row.blocked++;
    else if (triage === "review") row.needsReview++;
    else row.verified++;
  }

  for (const row of byAgent.values()) {
    const eligible = overrideEligible.get(row.agentName) ?? 0;
    row.overrideRate = eligible > 0 ? (overridden.get(row.agentName) ?? 0) / eligible : null;
  }

  return Array.from(byAgent.values()).sort((a, b) => b.processed - a.processed);
}

export interface AgentDecisionGroup {
  agentName: string;
  status: string;
  triageState: string | null;
  /**
   * Only meaningful when triageState is null -- one of the three blocked
   * sentinel values triageDecision checks for, or null otherwise. Collapsing
   * to sentinel-or-null (rather than the raw free-text proposedDescription)
   * keeps this a real aggregate dimension instead of one group per row.
   */
  proposedDescription?: string | null;
  count: number;
}

export interface AgentOverrideGroup {
  agentName: string;
  eligible: number;
  overridden: number;
}

export function computeAgentOperationsFromGroups(
  groups: AgentDecisionGroup[],
  overrides: AgentOverrideGroup[] = []
): AgentOperationsRow[] {
  const byAgent = new Map<string, AgentOperationsRow>();
  const overrideMap = new Map<string, AgentOverrideGroup>();
  for (const o of overrides) {
    overrideMap.set(o.agentName, o);
  }

  for (const g of groups) {
    if (!byAgent.has(g.agentName)) {
      byAgent.set(g.agentName, {
        agentName: g.agentName,
        processed: 0,
        needsReview: 0,
        blocked: 0,
        verified: 0,
        overrideRate: null,
      });
    }
    const row = byAgent.get(g.agentName)!;
    row.processed += g.count;
    const triage = triageDecision({ status: g.status, triageState: g.triageState, proposedDescription: g.proposedDescription ?? null });
    if (triage === "blocked") row.blocked += g.count;
    else if (triage === "review") row.needsReview += g.count;
    else row.verified += g.count;
  }

  for (const row of byAgent.values()) {
    const o = overrideMap.get(row.agentName);
    row.overrideRate = o && o.eligible > 0 ? o.overridden / o.eligible : null;
  }

  return Array.from(byAgent.values()).sort((a, b) => b.processed - a.processed);
}

