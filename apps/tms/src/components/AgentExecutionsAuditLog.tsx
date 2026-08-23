"use client";

import { Layers } from "lucide-react";
import { buildTmsAgentInvocations } from "@/lib/tmsAgentInvocations";
import { AgentExecutionTimeline } from "./AgentExecutionTimeline";
import { ShipmentAuditTrail, type ShipmentAuditEntry } from "./ShipmentAuditTrail";

export interface AgentExecutionsAuditLogProps {
  shipmentId: string;
  auditEntries?: ShipmentAuditEntry[];
  pipelineJobs?: any[];
  agentDecisions?: any[];
}

export function AgentExecutionsAuditLog({
  shipmentId,
  auditEntries = [],
  pipelineJobs = [],
  agentDecisions = [],
}: AgentExecutionsAuditLogProps) {
  const invocations = buildTmsAgentInvocations(pipelineJobs, agentDecisions);

  return (
    <div className="space-y-6">
      {/* Incremental Audit Log Table */}
      <ShipmentAuditTrail entries={auditEntries} />

      {/* Agent Execution Waterfall */}
      <div id="waterfall-view" className="apple-card p-6 rounded-3xl border border-border bg-white shadow-2xs space-y-6">
        <div>
          <h3 className="text-lg font-bold text-ink flex items-center space-x-2">
            <Layers className="w-5 h-5 text-brand" />
            <span>Agent Execution Runs</span>
          </h3>
          <p className="text-xs text-ink-muted mt-0.5">
            Every agent run on this shipment, grouped by invocation. Expand a run to see the per-agent waterfall.
          </p>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-extrabold uppercase text-ink-muted tracking-wider">
            Run History ({invocations.length})
          </h4>
          <AgentExecutionTimeline invocations={invocations} shipmentId={shipmentId} />
        </div>
      </div>
    </div>
  );
}
