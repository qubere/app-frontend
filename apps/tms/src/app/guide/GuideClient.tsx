"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  BookOpen, Search, ArrowRight, ExternalLink, Bot, Truck, FileText, Receipt,
  ShieldCheck, ArrowUpRight, Cpu, Layers, Sparkles, CheckCircle2, HelpCircle,
  BarChart3, Scale, Clock, AlertTriangle, Zap, Terminal, Command, Globe, Check, Eye
} from "lucide-react";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { Card, Badge, Button } from "@/components/ui";
import { FeatureDetailModal } from "./FeatureDetailModal";
import { StatTileModal } from "./StatTileModal";

interface FeatureGuideItem {
  id: string;
  title: string;
  category: "Intake & Orders" | "Tenders & Rating" | "Shipments & Tracking" | "Freight Audit" | "AI Supervisor & Admin";
  icon: any;
  route: string;
  badge: string;
  summary: string;
  keyCapabilities: string[];
  howToSteps: { stepNumber: number; title: string; instruction: string }[];
  proTip?: string;
}

const FEATURE_GUIDE_DATA: FeatureGuideItem[] = [
  {
    id: "action-workbench",
    title: "Action & Exceptions Workbench",
    category: "Shipments & Tracking",
    icon: AlertTriangle,
    route: "/",
    badge: "Command Center",
    summary: "Real-time operational exception queue prioritizing high-risk freight shipments requiring human dispatcher review or approval.",
    keyCapabilities: [
      "Automated risk scoring (Critical, High, Warning)",
      "Carrier tender dispatch SLA timeout detection",
      "Demurrage & Last Free Day (LFD) expiration alerts",
      "One-click action resolution with signed audit trail",
    ],
    howToSteps: [
      { stepNumber: 1, title: "Navigate to Action Workbench", instruction: "Click Home or Action Workbench from the sidebar menu." },
      { stepNumber: 2, title: "Select High-Risk Shipment", instruction: "Click any blocked shipment card on the left panel (sorted by urgency)." },
      { stepNumber: 3, title: "Review AI Recommendation", instruction: "Inspect what happened, why it matters, and Qubere AI's recommended action." },
      { stepNumber: 4, title: "Execute Resolution", instruction: "Click 'Re-Tender Carrier' or 'Approve Action' to automatically sign and dispatch." },
    ],
    proTip: "You can filter shipments by category (Blocked, Needs Review, Verified) using the categorization stat tiles.",
  },
  {
    id: "freight-intake",
    title: "Inbound Freight Orders & Intake",
    category: "Intake & Orders",
    icon: FileText,
    route: "/orders",
    badge: "Multi-Modal OCR",
    summary: "Automated ingestion and AI extraction of transportation orders, PDF rate confirmations, customer emails, and EDI 204 packets.",
    keyCapabilities: [
      "Multi-modal OCR for PDF, image, and raw email text",
      "Automatic origin/destination port and stop parsing",
      "Equipment requirement detection (53' Dry Van, Reefer, Flatbed, Container Dray)",
      "Instant promotion into active shipment execution records",
    ],
    howToSteps: [
      { stepNumber: 1, title: "Open Orders Intake", instruction: "Navigate to 'Orders & Intake' from the sidebar." },
      { stepNumber: 2, title: "Paste or Upload Order", instruction: "Click 'Ingest Order' and drop a PDF rate sheet or paste email text." },
      { stepNumber: 3, title: "Review Extracted Attributes", instruction: "Verify Parsed Confidence score, commodity details, and stop locations." },
      { stepNumber: 4, title: "Promote to Active Shipment", instruction: "Click 'Promote Order' to generate an active tracking shipment." },
    ],
    proTip: "The intake agent automatically extracts pickup windows, hazmat flags, and temperature constraints.",
  },
  {
    id: "carrier-tendering",
    title: "Carrier Rating & Tender Dispatch",
    category: "Tenders & Rating",
    icon: Truck,
    route: "/tenders",
    badge: "Waterfall Engine",
    summary: "Automated freight quote rating, contract tariff matching, and waterfall carrier tender dispatch with SLA monitoring.",
    keyCapabilities: [
      "Dynamic rate calculation ($/mile linehaul + FSC)",
      "Waterfall carrier dispatch (Primary ➔ Secondary ➔ Tertiary)",
      "60-minute tender response timeout SLA monitoring",
      "Spot rate RFQ generation for uncontracted lanes",
    ],
    howToSteps: [
      { stepNumber: 1, title: "Access Tenders & Spot Quotes", instruction: "Select 'Tenders & Spot Quotes' from the sidebar." },
      { stepNumber: 2, title: "Review Active Waterfall Tenders", instruction: "View load tender statuses (Dispatched, Acknowledged, Timed Out)." },
      { stepNumber: 3, title: "Trigger Waterfall Re-Tender", instruction: "If primary carrier times out, click 'Auto-Tender Next Carrier'." },
      { stepNumber: 4, title: "Evaluate Spot Rate Proposals", instruction: "Compare spot market quotes against historical contract baselines." },
    ],
    proTip: "Tender dispatch policies follow 49 CFR § 395.3 HOS safety guidelines to ensure driver compliance.",
  },
  {
    id: "shipments-telematics",
    title: "Shipments Control Tower & Telematics",
    category: "Shipments & Tracking",
    icon: Layers,
    route: "/shipments",
    badge: "GPS & Telematics",
    summary: "Full lifecycle tracking dashboard for ocean, drayage, truckload, and rail freight shipments across all customer accounts.",
    keyCapabilities: [
      "Real-time GPS telematics and EDI 214 status event stream",
      "Port container Last Free Day (LFD) demurrage countdown",
      "Interactive multi-stop leg map and milestone tracking",
      "Dynamic customer promise date recalculation",
    ],
    howToSteps: [
      { stepNumber: 1, title: "Open Shipments Workbench", instruction: "Click 'Shipments & Tracking' on the sidebar." },
      { stepNumber: 2, title: "Filter by Status or Mode", instruction: "Use filters for Mode (Ocean, Truckload, Dray) or Risk Status." },
      { stepNumber: 3, title: "Open Shipment Workspace", instruction: "Click any shipment number (e.g. SHP-2026-000002) to open its detail view." },
      { stepNumber: 4, title: "Manage Stops & Documents", instruction: "Inspect leg timeline, driver assignment, POD uploads, and financials." },
    ],
    proTip: "Demurrage risk highlights containers approaching Last Free Day to avoid $350/day terminal penalties.",
  },
  {
    id: "freight-audit",
    title: "3-Way Linehaul & FSC Freight Audit",
    category: "Freight Audit",
    icon: Receipt,
    route: "/invoices",
    badge: "Automated 3-Way Match",
    summary: "Automated reconciliation of carrier linehaul invoices, fuel surcharges (FSC), and accessorial fees against contracted tariffs and proof of delivery.",
    keyCapabilities: [
      "Linehaul & FSC contract rate sheet comparison",
      "Proof of Delivery (POD) presence & signature verification",
      "Automated price variance detection (>5% variance flag)",
      "Batch invoice approval and payment queue settlement",
    ],
    howToSteps: [
      { stepNumber: 1, title: "Navigate to Freight Invoices", instruction: "Click 'Freight Audit & Invoices' on the sidebar." },
      { stepNumber: 2, title: "Run Audit Sweep", instruction: "Click 'Run 3-Way Audit Sweep' to evaluate all pending carrier invoices." },
      { stepNumber: 3, title: "Review Discrepancies", instruction: "Inspect flagged items showing rate variance or missing PODs." },
      { stepNumber: 4, title: "Approve Payment", instruction: "Approve verified 3-way matches for automated accounting export." },
    ],
    proTip: "3-Way match requires verified Proof of Delivery before carrier settlement is authorized.",
  },
  {
    id: "ai-supervisor",
    title: "Qubere Autonomous AI Freight Supervisor",
    category: "AI Supervisor & Admin",
    icon: Bot,
    route: "/chat",
    badge: "Gemini 2.5 Copilot",
    summary: "Conversational AI assistant capable of executing tools across shipments, rate sheets, carrier tenders, and exception resolution.",
    keyCapabilities: [
      "Natural language querying ('Which shipments are at risk of demurrage today?')",
      "Direct tool execution (`search_shipments`, `recommend_carrier`, `plan_movement_stops`)",
      "Context-aware freight memory and customer instruction lookup",
      "Multi-modal document question answering",
    ],
    howToSteps: [
      { stepNumber: 1, title: "Launch AI Copilot", instruction: "Click 'AI Supervisor Copilot' from the sidebar or header." },
      { stepNumber: 2, title: "Ask a Natural Language Question", instruction: "Type queries like 'Find carriers for LAX to Chicago with rate under $2,500'." },
      { stepNumber: 3, title: "Inspect Tool Execution", instruction: "View structured tool call arguments and live database response cards." },
      { stepNumber: 4, title: "Execute Action Directly", instruction: "Click action buttons inside assistant responses to dispatch or update." },
    ],
    proTip: "You can ask the AI Supervisor to draft carrier emails or recalculate demurrage exposure in real-time.",
  },
  {
    id: "admin-analytics",
    title: "TMS Admin Workbench & Metered AI Analytics",
    category: "AI Supervisor & Admin",
    icon: BarChart3,
    route: "/admin",
    badge: "Multi-Scoped Telemetry",
    summary: "Comprehensive administration dashboard featuring multi-scoped AI token metering, copilot query health, document processing runs, roles, and API integrations.",
    keyCapabilities: [
      "Multi-scoped AI usage metering (Overall TMS, Customer Account, Client, User)",
      "Daily token burn trend charts and agent surface usage breakdown",
      "Chat assistant turn health & tool execution metrics",
      "Document OCR processing confidence & failure diagnostics",
    ],
    howToSteps: [
      { stepNumber: 1, title: "Open TMS Admin Console", instruction: "Navigate to 'TMS Admin & Workbench' from the sidebar." },
      { stepNumber: 2, title: "Select Agents & Telemetry Tab", instruction: "Click the '🤖 AI Freight Agents & Telemetry' tab." },
      { stepNumber: 3, title: "Apply Multi-Level Scoping", instruction: "Toggle scope filters between Overall TMS, Customer Account, or User." },
      { stepNumber: 4, title: "Inspect Token & Tool Performance", instruction: "Review LLM calls, token breakdown by surface, and OCR confidence." },
    ],
    proTip: "Admin workbench allows managing tenant organization profiles, API keys, and background cron schedules.",
  },
];

export function GuideClient() {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFeature, setSelectedFeature] = useState<FeatureGuideItem | null>(null);
  const [activeStatModal, setActiveStatModal] = useState<"modules" | "agents" | "sla" | "demurrage" | null>(null);

  const categories = ["All", "Intake & Orders", "Tenders & Rating", "Shipments & Tracking", "Freight Audit", "AI Supervisor & Admin"];

  const filteredFeatures = useMemo(() => {
    return FEATURE_GUIDE_DATA.filter((feat) => {
      const matchesCategory = activeCategory === "All" || feat.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        feat.title.toLowerCase().includes(q) ||
        feat.summary.toLowerCase().includes(q) ||
        feat.keyCapabilities.some((c) => c.toLowerCase().includes(q)) ||
        feat.howToSteps.some((s) => s.title.toLowerCase().includes(q) || s.instruction.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex w-full">
      <TmsSidebar accountName="Enterprise Freight" />

      <div className="flex-1 flex flex-col min-w-0">
        <TmsHeader tenantName="Enterprise Freight" userName="Operations Lead" />

        <main className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6 max-w-[1600px] mx-auto w-full">
          {/* HEADER TOOLBAR */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-border shadow-2xs">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                <BookOpen className="w-5 h-5 text-brand" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-black text-ink tracking-tight">Qubere TMS User Guide & Feature Index</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800">
                    Production Guide v2.5
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5 font-medium">
                  Interactive reference manual and step-by-step instructions. Click any box for module details or direct product access.
                </p>
              </div>
            </div>

            {/* Filter Search Input */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search features, workflows, or tools…"
                  className="pl-8 pr-4 py-2 text-xs bg-surface-muted border border-border rounded-xl focus:outline-none focus:border-brand focus:bg-white text-ink w-64 md:w-72 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* QUICK ACCESS CREDENTIALS & ARCHITECTURE BANNER */}
          <div className="bg-white p-5 rounded-2xl border border-border shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center space-x-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-black text-ink tracking-tight">Live Demo Credentials & Access Quick Reference</h3>
              </div>
              <span className="text-[11px] font-mono font-bold text-brand bg-brand/10 px-2.5 py-1 rounded-lg border border-brand/20">
                Default Password: QuberePass2026!
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-surface-muted/60 border border-border space-y-1.5 hover:border-brand/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-ink">Platform & TMS Admin</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                    OWNER
                  </span>
                </div>
                <p className="font-mono text-ink text-[11px] font-bold">admin@qubere.ai</p>
                <p className="text-[10px] text-ink-muted font-medium">Full platform, dispatcher, & admin rights</p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-muted/60 border border-border space-y-1.5 hover:border-brand/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-ink">Target Enterprise Admin</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ADMIN
                  </span>
                </div>
                <p className="font-mono text-ink text-[11px] font-bold">admin@target.com</p>
                <p className="text-[10px] text-ink-muted font-medium">Target enterprise account administrator</p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-muted/60 border border-border space-y-1.5 hover:border-brand/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-ink">Target Logistics Planner</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                    PLANNER
                  </span>
                </div>
                <p className="font-mono text-ink text-[11px] font-bold">sarah@target.com</p>
                <p className="text-[10px] text-ink-muted font-medium">Shipment planner & document intake</p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-muted/60 border border-border space-y-1.5 hover:border-brand/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-ink">Acme Enterprise Owner</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                    OWNER
                  </span>
                </div>
                <p className="font-mono text-ink text-[11px] font-bold">owner.acme@qubere.ai</p>
                <p className="text-[10px] text-ink-muted font-medium">Acme Corporation enterprise owner</p>
              </div>
            </div>
          </div>

          {/* OVERVIEW STAT CARDS GRID (CLICKABLE TO OPEN OVERVIEW MODAL) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setActiveStatModal("modules")}
              className="block text-left w-full group cursor-pointer"
            >
              <Card className="p-5 bg-white border border-border group-hover:border-brand/50 group-hover:shadow-xs transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">TMS Modules</span>
                  <Eye className="w-4 h-4 text-ink-muted group-hover:text-brand transition-colors" />
                </div>
                <p className="text-2xl font-black text-ink group-hover:text-brand transition-colors">7 Core Modules</p>
                <p className="text-[10px] text-brand font-semibold">Click to View All 7 Modules ➔</p>
              </Card>
            </button>

            <button
              onClick={() => setActiveStatModal("agents")}
              className="block text-left w-full group cursor-pointer"
            >
              <Card className="p-5 bg-white border border-border group-hover:border-brand/50 group-hover:shadow-xs transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">AI Autonomous Agents</span>
                  <Eye className="w-4 h-4 text-ink-muted group-hover:text-brand transition-colors" />
                </div>
                <p className="text-2xl font-black text-ink group-hover:text-brand transition-colors">8 Deployed Agents</p>
                <p className="text-[10px] text-emerald-600 font-semibold">View Agent Roster ➔</p>
              </Card>
            </button>

            <button
              onClick={() => setActiveStatModal("sla")}
              className="block text-left w-full group cursor-pointer"
            >
              <Card className="p-5 bg-white border border-border group-hover:border-brand/50 group-hover:shadow-xs transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">SLA Governance</span>
                  <Eye className="w-4 h-4 text-ink-muted group-hover:text-brand transition-colors" />
                </div>
                <p className="text-2xl font-black text-ink group-hover:text-brand transition-colors">60-Min SLA</p>
                <p className="text-[10px] text-brand font-semibold">Waterfall Rules ➔</p>
              </Card>
            </button>

            <button
              onClick={() => setActiveStatModal("demurrage")}
              className="block text-left w-full group cursor-pointer"
            >
              <Card className="p-5 bg-white border border-border group-hover:border-brand/50 group-hover:shadow-xs transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Demurrage Shield</span>
                  <Eye className="w-4 h-4 text-ink-muted group-hover:text-brand transition-colors" />
                </div>
                <p className="text-2xl font-black text-emerald-600 group-hover:text-emerald-700 transition-colors">$350/Day Exposure</p>
                <p className="text-[10px] text-ink-muted font-semibold">LFD Protection Rules ➔</p>
              </Card>
            </button>
          </div>

          {/* INSTANT ACCESS DIRECTORY CARD */}
          <Card className="p-6 bg-white border border-border shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-ink flex items-center space-x-2">
                  <Command className="w-4 h-4 text-brand" />
                  <span>Instant Access Directory</span>
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">Click any module box below to jump directly into that product route.</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-brand/10 text-brand font-mono font-bold text-xs">
                6 Access Points
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { title: "Command Center", path: "/", desc: "High-risk exception queue & decisions", icon: AlertTriangle },
                { title: "Orders & Intake", path: "/orders", desc: "OCR PDF & Email order parser", icon: FileText },
                { title: "Tenders & Rating", path: "/tenders", desc: "Waterfall carrier tender engine", icon: Truck },
                { title: "Shipments Control", path: "/shipments", desc: "Telematics, LFD & container maps", icon: Layers },
                { title: "Freight Audit", path: "/invoices", desc: "3-Way linehaul & FSC invoice match", icon: Receipt },
                { title: "TMS Admin", path: "/admin", desc: "AI telemetry & system settings", icon: BarChart3 },
              ].map((routeItem) => {
                const IconComponent = routeItem.icon;
                return (
                  <Link
                    key={routeItem.path}
                    href={routeItem.path}
                    className="p-4 rounded-2xl bg-surface-muted/60 border border-border hover:border-brand/50 hover:bg-white hover:shadow-xs transition-all group space-y-1.5 block cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0 group-hover:bg-brand group-hover:text-white transition-colors">
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-xs text-ink group-hover:text-brand transition-colors">
                          {routeItem.title}
                        </span>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-brand transition-colors" />
                    </div>
                    <p className="text-[11px] text-ink-muted leading-relaxed pl-9">{routeItem.desc}</p>
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* CATEGORY TABBED NAVIGATION BAR */}
          <div className="flex bg-white p-1.5 rounded-2xl border border-border shadow-2xs space-x-2 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === cat
                    ? "bg-brand text-white shadow-2xs"
                    : "text-ink-muted hover:text-ink hover:bg-surface-muted/60"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* FEATURE CARDS LIST (CLICKABLE FOR DETAIL MODAL + DIRECT PRODUCT BTN) */}
          <div className="space-y-5">
            {filteredFeatures.map((feature) => {
              const IconComponent = feature.icon;
              return (
                <div
                  key={feature.id}
                  onClick={() => setSelectedFeature(feature)}
                  className="block group cursor-pointer transition-all"
                >
                  <Card className="p-6 bg-white border border-border group-hover:border-brand/50 group-hover:shadow-xs transition-all space-y-5">
                    {/* Feature Title Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0 group-hover:bg-brand group-hover:text-white transition-colors">
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-base font-black text-ink group-hover:text-brand transition-colors">
                              {feature.title}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-brand/10 text-brand">
                              {feature.badge}
                            </span>
                          </div>
                          <p className="text-xs text-ink-muted mt-0.5">{feature.summary}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFeature(feature);
                          }}
                          className="px-3 py-2 rounded-xl bg-surface-muted border border-border text-xs font-bold text-ink hover:bg-white transition-all inline-flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-brand" />
                          <span>View Blueprint</span>
                        </button>

                        <Link
                          href={feature.route}
                          onClick={(e) => e.stopPropagation()}
                          className="px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover transition-all inline-flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
                        >
                          <span>Launch Live Route</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* Capabilities & Step-by-step How-to Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                      {/* Left: Key Capabilities (5 cols) */}
                      <div className="lg:col-span-5 space-y-3 bg-surface-muted/60 p-4 rounded-2xl border border-border group-hover:bg-surface-muted/80 transition-colors">
                        <h4 className="text-xs font-black uppercase tracking-wider text-ink flex items-center space-x-1.5">
                          <Zap className="w-3.5 h-3.5 text-brand" />
                          <span>Key Capabilities</span>
                        </h4>
                        <ul className="space-y-2">
                          {feature.keyCapabilities.map((cap, idx) => (
                            <li key={idx} className="flex items-start space-x-2 text-xs text-ink-muted">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="leading-relaxed font-medium text-ink">{cap}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Right: How to Use (7 cols) */}
                      <div className="lg:col-span-7 space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-ink flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>How to Use (Step-by-Step)</span>
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {feature.howToSteps.map((step) => (
                            <div key={step.stepNumber} className="p-3.5 rounded-xl bg-surface-muted/40 border border-border space-y-1 group-hover:border-brand/30 transition-colors">
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 rounded-full bg-brand text-white font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {step.stepNumber}
                                </span>
                                <span className="font-bold text-xs text-ink">{step.title}</span>
                              </div>
                              <p className="text-[11px] text-ink-muted leading-relaxed pl-7">{step.instruction}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Pro Tip Callout Banner */}
                    {feature.proTip && (
                      <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start space-x-2.5">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold text-amber-950">Pro Tip: </strong>
                          <span className="text-amber-900 leading-relaxed font-medium">{feature.proTip}</span>
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              );
            })}
          </div>

          {/* KEYBOARD SHORTCUTS CHEAT SHEET */}
          <Card className="p-6 bg-white border border-border shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-ink flex items-center space-x-2">
                  <Command className="w-4 h-4 text-brand" />
                  <span>Keyboard Shortcuts & Power Controls</span>
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">Click any shortcut card below to jump to that module.</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-brand/10 text-brand font-mono font-bold text-xs">
                Shortcuts
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { keyCombo: "⌘ / Ctrl + K", action: "Global Freight Search", path: "/" },
                { keyCombo: "Shift + H", action: "Jump to Action Workbench", path: "/" },
                { keyCombo: "Shift + O", action: "Open Orders & Intake", path: "/orders" },
                { keyCombo: "Shift + T", action: "Open Tenders & Rating", path: "/tenders" },
                { keyCombo: "Shift + S", action: "Open Shipments Workbench", path: "/shipments" },
                { keyCombo: "Shift + I", action: "Open Freight Invoices Audit", path: "/invoices" },
                { keyCombo: "Shift + C", action: "Launch AI Copilot Chat", path: "/chat" },
                { keyCombo: "Shift + A", action: "Open TMS Admin Console", path: "/admin" },
              ].map((shortcut) => (
                <Link
                  key={shortcut.keyCombo}
                  href={shortcut.path}
                  className="p-3.5 rounded-xl bg-surface-muted/60 border border-border hover:border-brand/40 hover:bg-white transition-all flex items-center justify-between group cursor-pointer"
                >
                  <span className="text-xs text-ink font-semibold group-hover:text-brand transition-colors">
                    {shortcut.action}
                  </span>
                  <kbd className="px-2.5 py-1 rounded bg-white text-brand font-mono font-bold text-[10px] border border-border shadow-3xs group-hover:bg-brand group-hover:text-white transition-colors">
                    {shortcut.keyCombo}
                  </kbd>
                </Link>
              ))}
            </div>
          </Card>
        </main>
      </div>

      {/* FEATURE DETAIL BLUEPRINT MODAL */}
      <FeatureDetailModal
        isOpen={Boolean(selectedFeature)}
        onClose={() => setSelectedFeature(null)}
        feature={selectedFeature}
      />

      {/* STAT TILE OVERVIEW MODAL */}
      <StatTileModal
        type={activeStatModal}
        onClose={() => setActiveStatModal(null)}
      />
    </div>
  );
}
