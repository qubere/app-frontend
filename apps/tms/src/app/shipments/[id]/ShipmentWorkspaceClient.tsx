"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Truck, Package,
  FileText, ShieldCheck, TriangleAlert, CheckCircle2, Clock,
  Upload, Layers, Activity, Shield
} from "lucide-react";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { Card, Button } from "@/components/ui";
import { DocumentWorkspacePanel } from "@/components/DocumentWorkspacePanel";
import { DocumentUploadModal } from "@/components/DocumentUploadModal";
import { TmsPipelineProgressRibbon } from "@/components/TmsPipelineProgressRibbon";
import { ShipmentLifecycleRibbon } from "@/components/ShipmentLifecycleRibbon";
import { CustomsHandoffCard } from "@/components/CustomsHandoffCard";
import { AgentExecutionsAuditLog } from "@/components/AgentExecutionsAuditLog";
import { ShipmentTrackingExperience } from "./ShipmentTrackingExperience";

const TMS_PIPELINE_STAGES = [
  { id: "document-intake", name: "1. Intake", surface: "document-intake", icon: FileText, agentName: "Document Intake Agent" },
  { id: "shipment-enrichment", name: "2. Enrichment", surface: "shipment-enrichment", icon: Layers, agentName: "Shipment Enrichment Agent" },
  { id: "document-readiness", name: "3. Documents", surface: "document-readiness", icon: ShieldCheck, agentName: "Document Readiness Agent" },
  { id: "movement-readiness", name: "4. Movement", surface: "movement-readiness", icon: Truck, agentName: "Movement Readiness Agent" },
  { id: "cost-carrier-readiness", name: "5. Commercial", surface: "cost-carrier-readiness", icon: Activity, agentName: "Cost & Carrier Readiness Agent" },
  { id: "operational-risk", name: "6. Risk", surface: "operational-risk", icon: TriangleAlert, agentName: "Operational Risk Agent" },
];

function formatOperationalDate(value: string | Date | null | undefined): string {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not provided";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function cleanFieldValue(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    if (v && typeof v === "string" && v.trim() !== "" && v.trim() !== "-" && v.trim() !== "Not provided") {
      return v.trim();
    }
  }
  return "-";
}

function locationLabel(value: any): string | null {
  if (!value || typeof value !== "object") return null;
  return value.unlocode || value.name || value.city || value.country || null;
}

export function ShipmentWorkspaceClient({
  shipment,
  journey: _journey,
  crossDomainRisks: _crossDomainRisks,
  healthSnapshot,
  financials,
  lifecycleStatus,
}: {
  shipment: any;
  journey: any[];
  crossDomainRisks: any[];
  healthSnapshot: any;
  financials: any;
  lifecycleStatus?: any;
}) {
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "TRACKING" | "CUSTOMS" | "DOCUMENTS" | "CARGO" | "FINANCIALS" | "ACTIVITY">("OVERVIEW");
  const [_activityCategoryFilter, _setActivityCategoryFilter] = useState<string>("ALL");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [renderedAt] = useState(() => Date.now());

  const customsCaseId = shipment.customsCaseLinks?.[0]?.customsCaseId;
  const customsCaseNumber = shipment.customsCaseLinks?.[0]?.customsCase?.caseNumber;
  const workspaceStatus = shipment.productWorkspaces?.find((pw: any) => pw.product === "CUSTOMS")?.status;
  const customsRequired = Boolean(shipment.customsRequired);
  const isHandoffComplete = Boolean(customsCaseId || workspaceStatus === "ACTIVE");



  const docExtractions = (shipment.documents ?? []).map((d: any) => {
    if (!d.extractedJson) return null;
    try {
      return typeof d.extractedJson === "string" ? JSON.parse(d.extractedJson) : d.extractedJson;
    } catch {
      return null;
    }
  }).filter(Boolean);

  const docOrigin = docExtractions.map((e: any) => e.originName || e.originCountry || e.originUnlocode).find(Boolean);
  const docMode = docExtractions.map((e: any) => e.mode).find(Boolean);
  const docDischarge = docExtractions.map((e: any) => e.destinationUnlocode || e.destinationName).find(Boolean);
  const docDestination = docExtractions.map((e: any) => e.destinationCountry || e.destinationName).find(Boolean);

  const latestOrder = shipment.transportationOrders?.[0];
  const originStop = shipment.trackingStops?.find((stop: any) => stop.role === "ORIGIN") ?? shipment.trackingStops?.[0];
  const destinationStop = shipment.trackingStops?.find((stop: any) => ["PORT_OF_DISCHARGE", "DESTINATION"].includes(stop.role)) ?? shipment.trackingStops?.at(-1);
  const route = {
    origin: cleanFieldValue(shipment.countryOfExport, originStop?.unlocode, originStop?.name, locationLabel(latestOrder?.origin), docOrigin),
    portOfDischarge: cleanFieldValue(shipment.portOfEntry, destinationStop?.unlocode, destinationStop?.name, locationLabel(latestOrder?.destination), docDischarge),
    finalDestination: cleanFieldValue(shipment.destinationCountry, destinationStop?.name, destinationStop?.unlocode, locationLabel(latestOrder?.destination), docDestination),
    modes: cleanFieldValue(shipment.transportMode, latestOrder?.mode, docMode),
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
  const latestMovement = shipment.shipmentMovements?.[0]?.movement;
  const latestTrackingEvent = shipment.trackingEvents?.[0];
  const trackingAgeHours = latestTrackingEvent?.receivedAt
    ? Math.max(0, (renderedAt - new Date(latestTrackingEvent.receivedAt).getTime()) / 3_600_000)
    : null;
  const primaryReferences = (shipment.trackingIdentifiers ?? []).filter((item: any) => item.isPrimary).slice(0, 3);
  const equipment = shipment.trackingEquipment ?? [];
  const latestFiling = shipment.customsFilings?.[0];

  const handleApproveRecommendation = () => {
    setActionSuccessMsg("AI Recommendation approved.");
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleActionRequiredClick = () => {
    setActiveTab("OVERVIEW");
    setTimeout(() => {
      document.getElementById("action-required-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const agentDecisions = shipment.agentDecisions ?? [];
  const trackingEvents = shipment.trackingEvents ?? [];

  // Match executed decisions to stages for the tracker bar
  const stageStatusMap = new Map<string, { status: "COMPLETED" | "ACTIVE" | "PENDING"; count: number }>();
  TMS_PIPELINE_STAGES.forEach((st) => {
    const matching = agentDecisions.filter((ad: any) =>
      (ad.agentName ?? "").toLowerCase() === st.agentName.toLowerCase()
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
    source: "UI" | "CHAT" | "SYSTEM" | "API" | "AGENT" | "EMAIL";
    user: { name: string };
    timestamp: string;
  }> = [];

  (shipment.auditLogs ?? []).forEach((log: any, i: number) => {
    const metadata = log.metadata && typeof log.metadata === "object" ? log.metadata : {};
    const action = String(log.action ?? "SYSTEM_EVENT");
    const category = action.includes("AGENT") || action.includes("PIPELINE")
      ? "AGENT_EXECUTION"
      : action.includes("TRACKING") || action.includes("ETA")
        ? "TRACKING_EVENT"
        : "SYSTEM_AUDIT";
    const actorName = [log.user?.firstName, log.user?.lastName].filter(Boolean).join(" ") || log.user?.email || (log.source === "AGENT" ? "Qubere Agent" : "System");
    auditEntries.push({
      id: log.id ?? `audit-${i}`,
      action,
      category,
      title: action.replaceAll("_", " ").replaceAll(".", " "),
      description: metadata.summary ?? metadata.fileName ?? metadata.error ?? `${log.entity ?? "Record"} ${log.entityId ?? ""}`,
      source: (log.source ?? "SYSTEM") as any,
      user: { name: actorName },
      timestamp: log.createdAt ? new Date(log.createdAt).toLocaleString() : "Unknown",
    });
  });

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

  auditEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex w-full">
      <TmsSidebar accountName="Enterprise Freight" />

      <div className="flex-1 flex flex-col min-w-0">
        <TmsHeader tenantName="Enterprise Freight" userName="Operations Lead" />

        <main className="flex-1 p-8 overflow-y-auto space-y-6">
          {/* Section 1: Operational Shipment Header */}
          <div className="bg-white rounded-2xl border border-border p-4 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                <Link href="/shipments" className="p-2 rounded-xl bg-surface-muted border border-border text-ink-muted hover:text-ink transition-colors cursor-pointer">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                
                <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
                  <h1 className="text-xl font-black text-ink font-mono tracking-tight">{shipment.shipmentNumber}</h1>
                  
                  {healthSnapshot?.overallHealth === "ON_TRACK" ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase border bg-emerald-100 text-emerald-900 border-emerald-300">
                      ✓ ON TRACK
                    </span>
                  ) : healthSnapshot?.overallHealth === "UNKNOWN" ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase border bg-slate-100 text-slate-700 border-slate-300">
                      STATUS PENDING
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleActionRequiredClick}
                      title="Action required — Click to view details"
                      className="px-2 py-0.5 rounded-full text-[11px] font-black border bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
                    >
                      <TriangleAlert className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                    </button>
                  )}

                  <span className="text-[11px] font-bold text-ink-muted bg-surface-muted px-2.5 py-0.5 rounded-full border border-border">
                    {clientName}
                  </span>

                  {/* Inline Compact Route Info on Same Line */}
                  <div className="flex items-center gap-2 pl-2 border-l border-border text-[11px] flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-ink-muted font-bold text-[10px] uppercase tracking-wider">Origin:</span>
                      <span className="font-bold text-ink bg-surface-muted px-2 py-0.5 rounded border border-border">
                        {route.origin}
                      </span>
                    </div>

                    <span className="text-ink-muted/30 font-light">•</span>

                    <div className="flex items-center gap-1">
                      <span className="text-ink-muted font-bold text-[10px] uppercase tracking-wider">Mode:</span>
                      <span className="font-bold text-brand bg-blue-50 text-blue-900 px-2 py-0.5 rounded border border-blue-200 font-mono">
                        {route.modes}
                      </span>
                    </div>

                    <span className="text-ink-muted/30 font-light">•</span>

                    <div className="flex items-center gap-1">
                      <span className="text-ink-muted font-bold text-[10px] uppercase tracking-wider">Discharge:</span>
                      <span className="font-bold text-ink bg-surface-muted px-2 py-0.5 rounded border border-border">
                        {route.portOfDischarge}
                      </span>
                    </div>

                    <span className="text-ink-muted/30 font-light">•</span>

                    <div className="flex items-center gap-1">
                      <span className="text-ink-muted font-bold text-[10px] uppercase tracking-wider">Destination:</span>
                      <span className="font-extrabold text-brand bg-brand/5 px-2 py-0.5 rounded border border-brand/20">
                        {route.finalDestination}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button onClick={() => setIsUploadOpen(true)} variant="secondary" size="sm" className="cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-brand" />
                  <span>Upload Document</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Action Success Toast Banner */}
          {actionSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center space-x-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
          )}


          <TmsPipelineProgressRibbon
            shipmentId={shipment.id}
            onNavigateToActivity={() => setActiveTab("ACTIVITY")}
          />

          <ShipmentLifecycleRibbon
            status={lifecycleStatus}
            shipmentId={shipment.id}
          />

          {/* Navigation Tabs */}
          <div className="flex max-w-full overflow-x-auto bg-white p-1 rounded-2xl border border-border text-xs w-fit shadow-2xs">
            {[
              { key: "OVERVIEW", label: "Overview" },
              { key: "TRACKING", label: `Tracking (${shipment.trackingEvents?.length ?? 0})` },
              { key: "DOCUMENTS", label: `Documents (${shipment.documents?.length ?? 0})` },
              { key: "CARGO", label: `Cargo (${shipment.lineItems?.length ?? 0})` },
              { key: "FINANCIALS", label: `Financials ($${safeFinancials.totalSellAmount.toLocaleString()})` },
              { key: "CUSTOMS", label: "Customs" },
              { key: "ACTIVITY", label: `Agent Executions & Audit Log (${auditEntries.length})` },
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
                <Card id="action-required-card" className="p-6 border-amber-300 bg-gradient-to-r from-white via-amber-50/20 to-amber-50/40 space-y-4 shadow-2xs">
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

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <Card className="p-5 bg-white border border-border space-y-3">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                    <Clock className="w-4 h-4 text-brand" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink">Schedule & Promise</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="block text-[10px] uppercase text-ink-muted font-bold">Current ETA</span><span className="font-bold text-ink">{formatOperationalDate(shipment.estimatedArrival)}</span></div>
                    <div><span className="block text-[10px] uppercase text-ink-muted font-bold">Customer Promise</span><span className="font-bold text-ink">{formatOperationalDate(shipment.customerPromiseDate)}</span></div>
                    <div><span className="block text-[10px] uppercase text-ink-muted font-bold">Last Free Day</span><span className="font-bold text-ink">{formatOperationalDate(shipment.lastFreeDay)}</span></div>
                    <div><span className="block text-[10px] uppercase text-ink-muted font-bold">Promise State</span><span className="font-bold text-ink">{shipment.promiseState?.replaceAll("_", " ") ?? "Not evaluated"}</span></div>
                  </div>
                </Card>

                <Card className="p-5 bg-white border border-border space-y-3">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                    <Truck className="w-4 h-4 text-brand" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink">Carrier & Movement</h3>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Carrier</span><span className="font-bold text-ink text-right">{shipment.carrierName ?? latestMovement?.carrierParty?.names?.[0]?.rawName ?? "Not assigned"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Movement</span><span className="font-bold text-ink text-right">{latestMovement ? `${latestMovement.mode} · ${latestMovement.status}` : "Not planned"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Booking / Bill</span><span className="font-mono font-bold text-ink text-right">{primaryReferences.map((item: any) => `${item.type}: ${item.value}`).join(" · ") || latestMovement?.bookingNumber || "Not provided"}</span></div>
                  </div>
                </Card>

                <Card className="p-5 bg-white border border-border space-y-3">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                    <Package className="w-4 h-4 text-brand" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink">Cargo & Equipment</h3>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Commodity</span><span className="font-bold text-ink text-right">{latestOrder?.commodityDescription ?? "Not provided"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Weight / Volume</span><span className="font-bold text-ink text-right">{latestOrder?.totalWeight != null ? `${Number(latestOrder.totalWeight).toLocaleString()} weight units` : "—"} · {latestOrder?.totalVolume != null ? `${Number(latestOrder.totalVolume).toLocaleString()} volume units` : "—"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Equipment</span><span className="font-bold text-ink text-right">{equipment.map((item: any) => item.containerNumber ? `${item.containerNumber} (${item.type})` : item.type).join(" · ") || (Array.isArray(latestOrder?.equipmentRequirements) ? latestOrder.equipmentRequirements.join(", ") : "Not provided")}</span></div>
                  </div>
                </Card>

                <Card className="p-5 bg-white border border-border space-y-3">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                    <Activity className="w-4 h-4 text-brand" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink">Tracking Freshness</h3>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Last Signal</span><span className="font-bold text-ink text-right">{latestTrackingEvent?.eventType?.replaceAll("_", " ") ?? "No signal received"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Received</span><span className={`font-bold text-right ${trackingAgeHours != null && trackingAgeHours > 24 ? "text-amber-700" : "text-ink"}`}>{trackingAgeHours == null ? "Not connected" : `${trackingAgeHours.toFixed(1)}h ago`}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Provider</span><span className="font-bold text-ink text-right">{latestTrackingEvent?.provider ?? latestMovement?.trackingProvider ?? "Not connected"}</span></div>
                  </div>
                </Card>

                <Card className="p-5 bg-white border border-border space-y-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-brand" />
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink">Customs & Exceptions</h3>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Handoff</span><span className="font-bold text-ink text-right">{isHandoffComplete ? `Case Active (${customsCaseNumber || customsCaseId || "Active"})` : customsRequired ? "Not sent" : "Not required"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Filing Status</span><span className="font-bold text-ink text-right">{latestFiling?.filingStatus ?? "No filing linked"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Open Exceptions</span><span className="font-bold text-ink text-right">{(shipment.exceptionItems ?? []).filter((item: any) => ["Open", "OPEN"].includes(item.status)).length}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Documents</span><span className="font-bold text-ink text-right">{shipment.documents?.length ?? 0} on file</span></div>
                  </div>
                  <div className="pt-2 border-t border-border/60 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveTab("CUSTOMS")}
                      className="text-xs font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      View Customs →
                    </button>
                  </div>
                </Card>

                <Card className="p-5 bg-white border border-border space-y-3">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                    <ShieldCheck className="w-4 h-4 text-brand" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink">Commercial Health</h3>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Sell</span><span className="font-bold text-ink text-right">{safeFinancials.totalSellAmount ? `${safeFinancials.currency} ${safeFinancials.totalSellAmount.toLocaleString()}` : "Not rated"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Expected Buy</span><span className="font-bold text-ink text-right">{safeFinancials.totalBuyAmount ? `${safeFinancials.currency} ${safeFinancials.totalBuyAmount.toLocaleString()}` : "Not costed"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-ink-muted">Gross Margin</span><span className="font-bold text-ink text-right">{safeFinancials.totalSellAmount ? `${safeFinancials.grossMarginPct.toFixed(1)}%` : "Not calculated"}</span></div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB: TRACKING */}
          {activeTab === "TRACKING" && (
            <ShipmentTrackingExperience shipment={shipment} />
          )}

          {/* TAB 2: CUSTOMS */}
          {activeTab === "CUSTOMS" && (
            <div className="space-y-6">
              <CustomsHandoffCard
                shipmentId={shipment.id}
                shipmentNumber={shipment.shipmentNumber}
                customsRequired={customsRequired}
                customsCaseId={customsCaseId}
                customsCaseNumber={customsCaseNumber}
                workspaceStatus={workspaceStatus}
                filingStatus={latestFiling?.filingStatus}
              />
            </div>
          )}

          {/* TAB: AGENT EXECUTIONS & AUDIT LOG */}
          {activeTab === "ACTIVITY" && (
            <AgentExecutionsAuditLog
              shipmentId={shipment.id}
              auditEntries={auditEntries}
              pipelineJobs={shipment.pipelineJobs}
              agentDecisions={shipment.agentDecisions}
            />
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
