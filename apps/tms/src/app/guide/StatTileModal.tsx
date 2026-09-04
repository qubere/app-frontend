"use client";

import { X, ArrowRight, Layers, Bot, Clock, AlertTriangle, ShieldCheck, FileText, Truck, Receipt, BarChart3, ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface StatTileModalProps {
  type: "modules" | "agents" | "sla" | "demurrage" | null;
  onClose: () => void;
}

export function StatTileModal({ type, onClose }: StatTileModalProps) {
  if (!type) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl bg-white border border-border rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-surface-muted/60 border-b border-border flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {type === "modules" && (
              <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0 border border-brand/20">
                <Layers className="w-5 h-5" />
              </div>
            )}
            {type === "agents" && (
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                <Bot className="w-5 h-5" />
              </div>
            )}
            {type === "sla" && (
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                <Clock className="w-5 h-5" />
              </div>
            )}
            {type === "demurrage" && (
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 border border-red-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}

            <div>
              <h2 className="text-lg font-black text-ink">
                {type === "modules" && "7 Core Freight Execution Modules"}
                {type === "agents" && "8 Deployed Autonomous AI Freight Agents"}
                {type === "sla" && "SLA Governance & Escalation Policy Rules"}
                {type === "demurrage" && "Demurrage & Last Free Day (LFD) Defense Shield"}
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                {type === "modules" && "Full architectural overview of all 7 core modules operating in Qubere TMS."}
                {type === "agents" && "Policy-verified autonomous AI background agents running across freight execution."}
                {type === "sla" && "Waterfall carrier dispatch response timeouts and driver safety policies."}
                {type === "demurrage" && "Port terminal container Last Free Day tracking preventing $350/day penalties."}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-border hover:bg-surface-muted flex items-center justify-center text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {type === "modules" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  number: "01",
                  title: "Action & Exceptions Workbench",
                  route: "/",
                  badge: "Command Center",
                  icon: AlertTriangle,
                  desc: "Prioritized operational exception queue targeting high-risk shipments, tender timeouts, and demurrage alerts with signed audit logs.",
                },
                {
                  number: "02",
                  title: "Inbound Freight Orders & Intake",
                  route: "/orders",
                  badge: "Multi-Modal OCR",
                  icon: FileText,
                  desc: "Ingest and extract PDF rate confirmations, customer emails, and EDI 204 packets automatically using multi-modal AI OCR.",
                },
                {
                  number: "03",
                  title: "Carrier Rating & Tender Dispatch",
                  route: "/tenders",
                  badge: "Waterfall Engine",
                  icon: Truck,
                  desc: "Contract tariff rate calculator ($/mile linehaul + FSC) with waterfall carrier load tendering and spot RFQ management.",
                },
                {
                  number: "04",
                  title: "Shipments Control Tower",
                  route: "/shipments",
                  badge: "GPS Telematics",
                  icon: Layers,
                  desc: "Real-time tracking telemetry for ocean, drayage, truckload, and rail freight with interactive milestone leg maps.",
                },
                {
                  number: "05",
                  title: "3-Way Linehaul & FSC Freight Audit",
                  route: "/invoices",
                  badge: "Automated Match",
                  icon: Receipt,
                  desc: "Reconciles carrier invoices against contracted tariffs and proof of delivery (POD) to auto-verify linehaul + FSC surcharges.",
                },
                {
                  number: "06",
                  title: "Qubere AI Freight Supervisor",
                  route: "/chat",
                  badge: "Gemini 2.5 Copilot",
                  icon: Bot,
                  desc: "Conversational copilot equipped with tools for searching shipments, recommending carriers, and planning movement stops.",
                },
                {
                  number: "07",
                  title: "TMS Admin Console & AI Telemetry",
                  route: "/admin",
                  badge: "Multi-Scoped Telemetry",
                  icon: BarChart3,
                  desc: "Central administration console featuring 4-level metered AI usage analytics, token burn charts, user roles, and API integrations.",
                },
              ].map((mod) => {
                return (
                  <Link
                    key={mod.number}
                    href={mod.route}
                    onClick={onClose}
                    className="p-4 rounded-2xl bg-surface-muted/50 border border-border hover:border-brand/40 hover:bg-white hover:shadow-xs transition-all space-y-2 block group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-6 h-6 rounded-lg bg-brand/10 text-brand font-mono font-bold text-xs flex items-center justify-center shrink-0">
                          {mod.number}
                        </span>
                        <h3 className="font-extrabold text-xs text-ink group-hover:text-brand transition-colors">
                          {mod.title}
                        </h3>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-brand transition-colors" />
                    </div>
                    <p className="text-[11px] text-ink-muted leading-relaxed pl-8">{mod.desc}</p>
                  </Link>
                );
              })}
            </div>
          )}

          {type === "agents" && (
            <div className="space-y-3">
              {[
                { name: "Document Intake Agent", role: "Classifies trade/logistics PDFs and extracts 100% of visible freight facts into rawMetadataJson and lineItems with Zero Data Loss." },
                { name: "Shipment Enrichment Agent", role: "Synchronizes extracted facts with Shipment DB columns (Origin, Destination, Mode, Port) and TransportationOrder DB rows." },
                { name: "Document Readiness Agent", role: "Checks mode- and customs-dependent document completeness using RAG account memory, raising/resolving ExceptionItems." },
                { name: "Movement Readiness Agent", role: "Validates positioning, stops, equipment requirements, and carrier tracking references to ensure execution readiness." },
                { name: "Cost & Carrier Readiness Agent", role: "Audits linehaul/drayage rate quotes, tenders, and buy/sell margins against approved target margins." },
                { name: "Operational Risk Agent", role: "Assesses tracking freshness, customer promise buffers, LFD detention risk, and open exceptions to assign real-time health status." },
                { name: "AI Supervisor Copilot", role: "Natural language assistant executing shipment, carrier, and exception queries across the TMS workspace." },
                { name: "Metered AI Telemetry Agent", role: "Tracks token burn, LLM call latency, and copilot query health across 4 telemetry scopes." },
              ].map((agent, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-surface-muted/60 border border-border flex items-start space-x-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-ink">{agent.name}</h4>
                    <p className="text-xs text-ink-muted leading-relaxed font-medium">{agent.role}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {type === "sla" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                <h4 className="font-bold text-amber-950 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-700" />
                  <span>Waterfall Carrier Dispatch Rule (60-Minute SLA)</span>
                </h4>
                <p className="leading-relaxed">
                  When a load tender is issued to a primary carrier, the carrier has 60 minutes to acknowledge or accept. If unacknowledged after 60 minutes, Qubere TMS automatically cancels the tender and dispatches to the secondary contracted carrier in the waterfall matrix.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-muted/60 border border-border space-y-2 text-xs">
                <h4 className="font-bold text-ink flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-brand" />
                  <span>FMCSA Safety Rules (49 CFR § 395.3)</span>
                </h4>
                <p className="text-ink-muted leading-relaxed">
                  Carrier selection enforces maximum driving hours and required off-duty rest cycles before load tender acceptance.
                </p>
              </div>
            </div>
          )}

          {type === "demurrage" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-900 space-y-2">
                <h4 className="font-bold text-red-950 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-700" />
                  <span>Last Free Day (LFD) Demurrage Defense</span>
                </h4>
                <p className="leading-relaxed">
                  Port terminals charge up to $350/day in demurrage fees when ocean containers remain uncollected past their Last Free Day. Qubere TMS automatically flags containers within 48 hours of LFD expiration to dispatch priority drayage drivers.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-surface-muted/60 border-t border-border flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-border text-xs font-bold text-ink hover:bg-surface-muted transition-colors cursor-pointer"
          >
            Close Overview
          </button>

          <Link
            href="/"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover transition-all inline-flex items-center space-x-2 shadow-xs cursor-pointer"
          >
            <span>Open Workbench</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
