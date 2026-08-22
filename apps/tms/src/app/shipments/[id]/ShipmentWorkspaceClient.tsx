"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowUpRight, Anchor, Plane, Truck, Package,
  FileText, ShieldCheck, TriangleAlert, Sparkles, CheckCircle2, Clock,
  Upload, X, Layers, Activity, Bot, Cpu, ChevronRight, CheckCircle, AlertCircle, Filter, User as UserIcon, Edit3, Send, Shield
} from "lucide-react";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { Card, Badge, Button } from "@/components/ui";
import { DocumentWorkspacePanel } from "@/components/DocumentWorkspacePanel";
import { DocumentUploadModal } from "@/components/DocumentUploadModal";

const TMS_PIPELINE_STAGES = [
  { id: "intake", name: "1. Intake", surface: "freight-intake", icon: FileText, agentName: "Inbound Freight Intake Agent" },
  { id: "planner", name: "2. Planner", surface: "movement-planner", icon: Layers, agentName: "Movement & Stop Planning Agent" },
  { id: "rating", name: "3. Rating", surface: "carrier-rating", icon: Activity, agentName: "Carrier Rating & Quote Agent" },
  { id: "tender", name: "4. Tender", surface: "tender-dispatch", icon: Truck, agentName: "Autonomous Tender Dispatch Agent" },
  { id: "tracking", name: "5. Tracking", surface: "tracking-eta", icon: Plane, agentName: "Tracking & ETA Cascade Agent" },
  { id: "demurrage", name: "6. Demurrage", surface: "demurrage-risk", icon: Anchor, agentName: "Demurrage & LFD Defense Agent" },
  { id: "audit", name: "7. Audit", surface: "freight-audit", icon: ShieldCheck, agentName: "3-Way Linehaul & FSC Audit Agent" },
];

export function ShipmentWorkspaceClient({
  shipment,
  journey,
  crossDomainRisks,
  healthSnapshot,
  financials,
}: {
  shipment: any;
  journey: any[];
  crossDomainRisks: any[];
  healthSnapshot: any;
  financials: any;
}) {
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "DOCUMENTS" | "CARGO" | "FINANCIALS" | "ACTIVITY">("OVERVIEW");
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<string>("ALL");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const route = {
    origin: shipment.countryOfExport ?? shipment.portOfEntry ?? "Origin",
    portOfDischarge: shipment.destinationCountry ?? shipment.portOfEntry ?? "Destination Port",
    finalDestination: shipment.destinationCountry ?? shipment.portOfEntry ?? "Final Destination",
    modes: shipment.transportMode ?? "OCEAN",
  };

  const qubere = healthSnapshot?.qubereAi ?? {
    needsHumanAction: false,
    headline: "QUBERE — Monitoring shipment status.",
    reasoning: "All operational dimensions monitored.",
    monitoredItems: ["Vessel ETA & positioning", "Customs entry filing status", "Drayage pickup window"],
    nextAutoActions: ["Check tracking updates", "Verify customs entry release", "Track drayage dispatch"],
  };

  const safeFinancials = financials ?? {
    totalSellAmount: 0,
    totalBuyAmount: 0,
    grossProfit: 0,
    grossMarginPct: 0,
    markupOnCostPct: 0,
    currency: "USD",
  };

  const clientName = shipment.client?.name ?? shipment.importerName ?? "Unassigned Client";

  const handleApproveRecommendation = () => {
    setActionSuccessMsg("AI Recommendation approved.");
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const agentDecisions = shipment.agentDecisions ?? [];
  const trackingEvents = shipment.trackingEvents ?? [];

  // Match executed decisions to stages for the tracker bar
  const stageStatusMap = new Map<string, { status: "COMPLETED" | "ACTIVE" | "PENDING"; count: number }>();
  TMS_PIPELINE_STAGES.forEach((st) => {
    const matching = agentDecisions.filter((ad: any) =>
      (ad.agentName ?? "").toLowerCase().includes(st.id) || (ad.agentName ?? "").toLowerCase().includes(st.surface.replace("-", ""))
    );
    if (matching.length > 0) {
      stageStatusMap.set(st.id, { status: "COMPLETED", count: matching.length });
    } else {
      stageStatusMap.set(st.id, { status: "PENDING", count: 0 });
    }
  });

  // Synthesize unified audit entries matching Customs app format
  const auditEntries: Array<{
    id: string;
    action: string;
    category: string;
    title: string;
    description: string;
    source: "UI" | "CHAT" | "SYSTEM" | "API";
    user: { name: string };
    timestamp: string;
  }> = [];

  agentDecisions.forEach((ad: any, i: number) => {
    auditEntries.push({
      id: ad.id ?? `ad-${i}`,
      action: "AGENT_DECISION",
      category: "AGENT_EXECUTION",
      title: ad.agentName ?? "Autonomous Agent",
      description: ad.decisionSummary ?? "Agent decision executed.",
      source: "SYSTEM",
      user: { name: "Autonomous Agent" },
      timestamp: ad.createdAt ? new Date(ad.createdAt).toLocaleString() : "Just now",
    });
  });

  trackingEvents.forEach((te: any, i: number) => {
    auditEntries.push({
      id: te.id ?? `te-${i}`,
      action: "TRACKING_UPDATE",
      category: "TRACKING_EVENT",
      title: te.eventType ?? "Tracking Milestone",
      description: `${te.locationName ?? "Hub"}: ${te.description ?? "GPS telemetry update"}`,
      source: "API",
      user: { name: te.source ?? "EDI 214 Feed" },
      timestamp: te.occurredAt ? new Date(te.occurredAt).toLocaleString() : "Just now",
    });
  });

  if (auditEntries.length === 0) {
    auditEntries.push({
      id: "init-1",
      action: "SHIPMENT_CREATED",
      category: "SYSTEM_AUDIT",
      title: "Shipment Created",
      description: `Shipment ${shipment.shipmentNumber} initialized in platform context.`,
      source: "UI",
      user: { name: "Operations Lead" },
      timestamp: shipment.createdAt ? new Date(shipment.createdAt).toLocaleString() : "Just now",
    });
  }

  const filteredAuditEntries = auditEntries.filter((e) => {
    if (activityCategoryFilter === "ALL") return true;
    if (activityCategoryFilter === "AGENT_EXECUTION") return e.category === "AGENT_EXECUTION";
    if (activityCategoryFilter === "TRACKING_EVENT") return e.category === "TRACKING_EVENT";
    if (activityCategoryFilter === "SYSTEM_AUDIT") return e.category === "SYSTEM_AUDIT";
    return true;
  });

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex w-full">
      <TmsSidebar accountName="Enterprise Freight" />

      <div className="flex-1 flex flex-col min-w-0">
        <TmsHeader tenantName="Enterprise Freight" userName="Operations Lead" />

        <main className="flex-1 p-8 overflow-y-auto space-y-6">
          {/* Section 1: Operational Shipment Header */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center space-x-4">
                <Link href="/shipments" className="p-2 rounded-xl bg-surface-muted border border-border text-ink-muted hover:text-ink transition-colors cursor-pointer">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <div>
                  <div className="flex items-center space-x-3">
                    <h1 className="text-2xl font-black text-ink font-mono tracking-tight">{shipment.shipmentNumber}</h1>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${
                      healthSnapshot?.overallHealth === "ON_TRACK"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                        : "bg-amber-100 text-amber-900 border-amber-300"
                    }`}>
                      {healthSnapshot?.overallHealth === "ON_TRACK" ? "✓ ON TRACK" : "⚠️ ACTION REQUIRED"}
                    </span>
                    <span className="text-xs font-bold text-ink-muted bg-surface-muted px-3 py-1 rounded-full border border-border">
                      {clientName}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button onClick={() => setIsUploadOpen(true)} variant="secondary" size="sm" className="cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-brand" />
                  <span>Upload Document</span>
                </Button>
                <Button size="sm" variant="primary" className="cursor-pointer shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask Qubere AI</span>
                </Button>
              </div>
            </div>

            {/* End-to-End Route Banner */}
            <div className="p-4 rounded-xl bg-surface-muted/60 border border-border flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-4 text-xs font-semibold text-ink">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-ink text-sm">{route.origin}</span>
                </div>
                <div className="flex items-center space-x-1 text-brand text-[11px] font-mono bg-white px-2.5 py-1 rounded-lg border border-border">
                  <Anchor className="w-3.5 h-3.5 text-blue-600" />
                  <span>↓ {route.modes}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-ink text-sm">{route.portOfDischarge}</span>
                </div>
                <div className="flex items-center space-x-1 text-amber-700 text-[11px] font-mono bg-white px-2.5 py-1 rounded-lg border border-border">
                  <Truck className="w-3.5 h-3.5 text-amber-600" />
                  <span>↓ Delivery</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-extrabold text-brand text-sm">{route.finalDestination}</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-ink-muted">
                Mode: {route.modes}
              </span>
            </div>
          </div>

          {/* Action Success Toast Banner */}
          {actionSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center space-x-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex bg-white p-1 rounded-2xl border border-border text-xs w-fit shadow-2xs">
            {[
              { key: "OVERVIEW", label: "Overview" },
              { key: "DOCUMENTS", label: `Documents (${shipment.documents?.length ?? 0})` },
              { key: "CARGO", label: `Cargo (${shipment.lineItems?.length ?? 0})` },
              { key: "FINANCIALS", label: `Financials ($${safeFinancials.totalSellAmount.toLocaleString()})` },
              { key: "ACTIVITY", label: `Activity Timeline (${auditEntries.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-brand text-white shadow-2xs"
                    : "text-ink-muted hover:text-ink hover:bg-surface-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "OVERVIEW" && (
            <div className="space-y-6">
              {qubere.needsHumanAction ? (
                <Card className="p-6 border-amber-300 bg-gradient-to-r from-white via-amber-50/20 to-amber-50/40 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                    <div className="flex items-center space-x-2">
                      <TriangleAlert className="w-5 h-5 text-amber-600" />
                      <h2 className="font-extrabold text-base text-amber-950">ACTION REQUIRED</h2>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-ink">{qubere.reasoning}</p>
                  {qubere.recommendedAction && (
                    <Button onClick={handleApproveRecommendation} className="bg-brand text-white font-bold cursor-pointer">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{qubere.recommendedAction}</span>
                    </Button>
                  )}
                </Card>
              ) : (
                <Card className="p-4 bg-white border border-border flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <Clock className="w-4 h-4 text-brand" />
                    <div>
                      <span className="font-extrabold text-ink text-sm">NEXT: {healthSnapshot?.nextMilestone?.title ?? "Filing Prep"}</span>
                      <p className="text-ink-muted font-medium">{healthSnapshot?.nextMilestone?.location ?? route.origin} • {healthSnapshot?.nextMilestone?.scheduledTime ?? "Scheduled"}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full font-bold border border-emerald-200">
                    {healthSnapshot?.overallHealth === "ON_TRACK" ? "On Schedule" : "Under Review"}
                  </span>
                </Card>
              )}
            </div>
          )}

          {/* TAB: ACTIVITY TIMELINE (CONTAINS WATERFALL TRACKER, AGENT EXECUTION RUNS, & AUDIT LOG TABLE) */}
          {activeTab === "ACTIVITY" && (
            <div className="space-y-6">
              {/* 1. TMS AUTONOMOUS AGENT EXECUTION WATERFALL TRACKER BAR */}
              <div className="p-5 rounded-2xl border border-border bg-white shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider text-ink">TMS Autonomous Agent Execution Waterfall</h3>
                      <p className="text-[11px] text-ink-muted font-medium">Sequential execution status across 7 freight execution stages.</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full font-mono text-[10px] font-bold bg-brand/10 text-brand border border-brand/20">
                    {agentDecisions.length} Decisions Logged
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                  {TMS_PIPELINE_STAGES.map((stage) => {
                    const info = stageStatusMap.get(stage.id);
                    const isDone = info?.status === "COMPLETED" || agentDecisions.length > 0;
                    const IconComp = stage.icon;
                    return (
                      <div
                        key={stage.id}
                        className={`p-3 rounded-xl border transition-all flex flex-col justify-between space-y-2 ${
                          isDone
                            ? "bg-brand/5 border-brand/30 text-ink"
                            : "bg-surface-muted/60 border-border text-ink-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isDone ? "bg-brand/10 text-brand" : "bg-white text-ink-muted border border-border"}`}>
                            <IconComp className="w-3.5 h-3.5" />
                          </div>
                          {isDone ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-xs text-ink block leading-tight">{stage.name}</span>
                          <span className={`text-[10px] font-mono font-bold block mt-1 ${isDone ? "text-emerald-700" : "text-ink-muted"}`}>
                            {isDone ? "EXECUTED" : "PENDING"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. AGENT EXECUTION RUNS WATERFALL TIMELINE */}
              <Card className="p-6 bg-white border border-border space-y-6 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-ink">Agent Execution Runs & Waterfall Logs</h2>
                      <p className="text-xs text-ink-muted font-medium">
                        Detailed decision summaries, model versions, and policy verification logs written by background AI agents.
                      </p>
                    </div>
                  </div>
                  <Badge variant="success" className="font-mono text-xs font-bold self-start sm:self-auto">
                    {agentDecisions.length} Agent Runs
                  </Badge>
                </div>

                {agentDecisions.length > 0 ? (
                  <div className="relative border-l-2 border-brand/20 ml-4 pl-6 space-y-6">
                    {agentDecisions.map((decision: any, index: number) => (
                      <div key={decision.id ?? index} className="relative group">
                        <div className="absolute -left-[33px] top-1.5 w-4 h-4 rounded-full bg-brand border-2 border-white ring-4 ring-brand/10 flex items-center justify-center text-white">
                          <CheckCircle2 className="w-3 h-3" />
                        </div>

                        <div className="p-5 rounded-2xl bg-surface-muted/60 border border-border hover:border-brand/40 hover:bg-white transition-all space-y-3 shadow-2xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                            <div className="flex items-center space-x-2.5">
                              <span className="w-7 h-7 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-bold text-xs">
                                #{index + 1}
                              </span>
                              <div>
                                <h3 className="text-sm font-extrabold text-ink">{decision.agentName ?? "Autonomous Agent"}</h3>
                                <span className="text-[10px] font-mono text-ink-muted">
                                  Model: {decision.modelVersion ?? "gemini-2.5-flash"} • {decision.createdAt ? new Date(decision.createdAt).toLocaleString() : "Just now"}
                                </span>
                              </div>
                            </div>

                            <span className="px-2.5 py-1 rounded-full font-mono text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
                              {decision.status ?? "AUTO_VERIFIED"}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs font-bold text-ink leading-snug">{decision.decisionSummary}</p>
                            {decision.purpose && (
                              <p className="text-xs text-ink-muted leading-relaxed font-medium">{decision.purpose}</p>
                            )}
                          </div>

                          {(decision.dataSources?.length > 0 || decision.regulations?.length > 0) && (
                            <div className="pt-2 border-t border-border/40 flex flex-wrap items-center gap-2 text-[10px] font-mono">
                              {decision.regulations?.map((reg: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 rounded bg-white border border-border text-ink-muted font-bold">
                                  📜 {reg}
                                </span>
                              ))}
                              {decision.dataSources?.map((src: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 rounded bg-brand/5 border border-brand/20 text-brand font-semibold">
                                  📊 {src}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-surface-muted/40 rounded-2xl border border-border space-y-2">
                    <Bot className="w-8 h-8 text-ink-muted mx-auto" />
                    <p className="text-xs font-bold text-ink">No Agent Decision Runs Logged Yet</p>
                    <p className="text-[11px] text-ink-muted font-medium">As autonomous freight intake, routing, and tendering agents execute, their waterfall decision logs will stream here.</p>
                  </div>
                )}
              </Card>

              {/* 3. AUDIT LOG & EVENT TABLE (MATCHING CUSTOMS APP AUDIT TRAIL LAYOUT) */}
              <Card className="p-6 bg-white border border-border space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-ink">Audit Log & Event Table</h2>
                      <p className="text-xs text-ink-muted font-medium">
                        System event log tracking user mutations, agent invocations, tracking updates, and API webhooks.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 bg-surface-muted p-1 rounded-xl border border-border text-xs">
                    {["ALL", "AGENT_EXECUTION", "TRACKING_EVENT", "SYSTEM_AUDIT"].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActivityCategoryFilter(cat)}
                        className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          activityCategoryFilter === cat
                            ? "bg-white text-brand shadow-3xs"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        {cat === "ALL" ? "All Events" : cat.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-ink-muted font-mono uppercase text-[10px] tracking-wider">
                        <th className="pb-3 font-bold">Event Title & Details</th>
                        <th className="pb-3 font-bold">Category</th>
                        <th className="pb-3 font-bold">Source</th>
                        <th className="pb-3 font-bold">Actor / User</th>
                        <th className="pb-3 font-bold text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredAuditEntries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-surface-muted/40 transition-colors">
                          <td className="py-3">
                            <span className="font-bold text-ink block">{entry.title}</span>
                            <span className="text-[11px] text-ink-muted leading-tight block mt-0.5">{entry.description}</span>
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold bg-surface-muted border border-border text-ink">
                              {entry.category}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full font-mono text-[9px] font-bold bg-brand/10 text-brand border border-brand/20">
                              {entry.source}
                            </span>
                          </td>
                          <td className="py-3 font-medium text-ink flex items-center space-x-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-ink-muted" />
                            <span>{entry.user.name}</span>
                          </td>
                          <td className="py-3 font-mono text-right text-ink-muted text-[11px]">{entry.timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 3: DOCUMENTS */}
          {activeTab === "DOCUMENTS" && (
            <div className="space-y-6">
              <DocumentWorkspacePanel shipmentId={shipment.id} shipmentNumber={shipment.shipmentNumber} documents={shipment.documents ?? []} />
            </div>
          )}
        </main>
      </div>

      <DocumentUploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} shipmentId={shipment.id} />
    </div>
  );
}
