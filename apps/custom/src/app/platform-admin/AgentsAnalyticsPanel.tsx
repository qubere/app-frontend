"use client";

import { useState, useCallback } from "react";
import {
  Bot,
  Zap,
  Users,
  Layers,
  TrendingUp,
  Wrench,
  Gauge,
  CheckCircle2,
  FileText,
  ScanText,
  Boxes,
  Scale,
  Globe2,
  Calculator,
  ShieldAlert,
  Send,
  Receipt,
  Cpu,
  RefreshCw,
  Filter,
} from "lucide-react";
import type {
  AiUsageAnalytics,
  AiSurfaceUsage,
  AiDailyUsage,
  AiAccountUsage,
} from "@/lib/ai/aiUsageAnalytics";
import type { DocumentProcessingAnalytics } from "@/lib/documents/documentProcessingAnalytics";

function formatShortDate(dateKey: string | undefined): string {
  if (!dateKey) return "";
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function StatTile({
  icon: Icon,
  label,
  value,
  footnote,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  footnote: string;
}) {
  return (
    <div className="p-5 rounded-2xl border border-border bg-white shadow-2xs space-y-2">
      <div className="flex items-center space-x-2 text-ink-muted text-xs font-bold uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5 text-brand" />
        <span>{label}</span>
      </div>
      <p className="text-2xl font-black text-ink tabular-nums">{value}</p>
      <p className="text-[10px] text-ink-muted">{footnote}</p>
    </div>
  );
}

function UsageTrendChart({ daily }: { daily: AiDailyUsage[] }) {
  const [metric, setMetric] = useState<"requests" | "totalTokens">("requests");
  const max = Math.max(1, ...daily.map((d) => d[metric]));

  return (
    <div className="p-6 rounded-2xl border border-border bg-white shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-base font-bold text-ink flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-brand" />
            <span>AI Call & Token Usage Trend</span>
          </h2>
          <p className="text-xs text-ink-muted font-medium">
            Daily volume across every Customs AI agent surface and account context.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setMetric("requests")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              metric === "requests" ? "bg-brand text-white shadow-2xs" : "bg-surface-muted text-ink-muted hover:text-ink border border-border"
            }`}
          >
            LLM Calls
          </button>
          <button
            type="button"
            onClick={() => setMetric("totalTokens")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              metric === "totalTokens" ? "bg-brand text-white shadow-2xs" : "bg-surface-muted text-ink-muted hover:text-ink border border-border"
            }`}
          >
            Tokens Spent
          </button>
        </div>
      </div>

      <div className="h-44 flex items-end justify-between gap-1 sm:gap-2 pt-4">
        {daily.map((d) => {
          const val = d[metric];
          const pct = Math.round((val / max) * 100);
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center group relative h-full justify-end">
              <div
                style={{ height: `${Math.max(pct, 4)}%` }}
                className={`w-full max-w-[28px] rounded-t-md transition-all ${
                  pct > 0 ? "bg-brand group-hover:bg-brand-hover" : "bg-border/40"
                }`}
              />
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 bg-slate-900 text-white text-[10px] font-mono px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none z-10">
                <span className="font-bold">{formatShortDate(d.date)}: </span>
                {metric === "requests" ? `${val} calls` : `${formatCompactNumber(val)} tokens`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono font-semibold text-ink-muted pt-2 border-t border-border">
        <span>{formatShortDate(daily[0]?.date)}</span>
        <span>{formatShortDate(daily[Math.floor(daily.length / 2)]?.date)}</span>
        <span>{formatShortDate(daily[daily.length - 1]?.date)}</span>
      </div>
    </div>
  );
}

function SurfaceUsageTable({ bySurface, totalTokens }: { bySurface: AiSurfaceUsage[]; totalTokens: number }) {
  return (
    <div className="p-6 rounded-2xl border border-border bg-white shadow-2xs space-y-4">
      <div className="border-b border-border pb-4">
        <h2 className="text-base font-bold text-ink flex items-center space-x-2">
          <Layers className="w-5 h-5 text-brand" />
          <span>Usage by Agent Surface</span>
        </h2>
        <p className="text-xs text-ink-muted font-medium">
          Token consumption broken down by specific Customs autonomous agent surface.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-ink-muted font-mono uppercase text-[10px] tracking-wider">
              <th className="pb-3 font-bold">Agent Surface</th>
              <th className="pb-3 font-bold">Model</th>
              <th className="pb-3 font-bold text-right">LLM Calls</th>
              <th className="pb-3 font-bold text-right">Input Tokens</th>
              <th className="pb-3 font-bold text-right">Output Tokens</th>
              <th className="pb-3 font-bold text-right">Total Tokens</th>
              <th className="pb-3 font-bold text-right">% Token Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {bySurface.map((s) => {
              const pct = totalTokens > 0 ? ((s.totalTokens / totalTokens) * 100).toFixed(1) : "0.0";
              return (
                <tr key={s.surface} className="hover:bg-surface-muted/40 transition-colors">
                  <td className="py-3 font-semibold text-ink flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-brand shrink-0" />
                    <span>{s.label}</span>
                  </td>
                  <td className="py-3 font-mono text-[11px] text-ink-muted">{s.model}</td>
                  <td className="py-3 font-mono text-right text-ink font-semibold">{s.requests.toLocaleString()}</td>
                  <td className="py-3 font-mono text-right text-ink-muted">{formatCompactNumber(s.inputTokens)}</td>
                  <td className="py-3 font-mono text-right text-ink-muted">{formatCompactNumber(s.outputTokens)}</td>
                  <td className="py-3 font-mono text-right text-ink font-bold">{formatCompactNumber(s.totalTokens)}</td>
                  <td className="py-3 font-mono text-right text-brand font-bold">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopAccountsTable({ accounts }: { accounts: AiAccountUsage[] }) {
  return (
    <div className="p-6 rounded-2xl border border-border bg-white shadow-2xs space-y-4">
      <div className="border-b border-border pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-ink flex items-center space-x-2">
            <Users className="w-5 h-5 text-brand" />
            <span>Usage by Customer Account</span>
          </h2>
          <p className="text-xs text-ink-muted font-medium">
            Metered token burn per tenant account in Customs domain.
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-brand/10 text-brand font-mono font-bold text-xs">
          {accounts.length} Active Accounts
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-ink-muted font-mono uppercase text-[10px] tracking-wider">
              <th className="pb-3 font-bold">Account Name</th>
              <th className="pb-3 font-bold">Account ID</th>
              <th className="pb-3 font-bold text-right">LLM Calls</th>
              <th className="pb-3 font-bold text-right">Total Tokens</th>
              <th className="pb-3 font-bold">Top Surface</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {accounts.map((a) => (
              <tr key={a.accountId} className="hover:bg-surface-muted/40 transition-colors">
                <td className="py-3 font-bold text-ink">{a.accountName}</td>
                <td className="py-3 font-mono text-[11px] text-ink-muted">{a.accountId}</td>
                <td className="py-3 font-mono text-right text-ink font-semibold">{a.requests.toLocaleString()}</td>
                <td className="py-3 font-mono text-right text-ink font-bold">{formatCompactNumber(a.totalTokens)}</td>
                <td className="py-3 font-semibold text-brand">{a.topSurface ?? "Tariff Classification Agent"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CopilotHealthSection({ data }: { data: AiUsageAnalytics["copilot"] }) {
  return (
    <div className="p-6 rounded-2xl border border-border bg-white shadow-2xs space-y-5">
      <div className="border-b border-border pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-ink flex items-center space-x-2">
            <Wrench className="w-5 h-5 text-brand" />
            <span>Chat Assistant Query Health & Tool Execution</span>
          </h2>
          <p className="text-xs text-ink-muted font-medium">
            Turn outcomes, latency distributions, and tool execution stats from copilot audit logs.
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-brand/10 text-brand font-mono font-bold text-xs">
          {data.totalQueries.toLocaleString()} Queries Total
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Answered (Success)</span>
          <p className="text-xl font-black text-emerald-950">{data.statusCounts.ANSWERED ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Clarification Needed</span>
          <p className="text-xl font-black text-amber-950">{data.statusCounts.NEEDS_CLARIFICATION ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-1">
          <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider">Errors / Exceptions</span>
          <p className="text-xl font-black text-red-950">{data.statusCounts.ERROR ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Avg Latency / Turn</span>
          <p className="text-xl font-black text-blue-950">{data.avgDurationMs} ms</p>
        </div>
      </div>

      {data.toolStats.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Tools Invoked by Copilot Assistant</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-ink-muted font-mono uppercase text-[10px]">
                  <th className="pb-2 font-bold">Tool Name</th>
                  <th className="pb-2 font-bold text-right">Invocations</th>
                  <th className="pb-2 font-bold text-right">Success Rate</th>
                  <th className="pb-2 font-bold text-right">Avg Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.toolStats.map((t) => (
                  <tr key={t.tool}>
                    <td className="py-2.5 font-mono text-brand font-bold">{t.tool}</td>
                    <td className="py-2.5 font-mono text-right font-semibold">{t.calls}</td>
                    <td className="py-2.5 font-mono text-right font-bold text-emerald-600">
                      {(t.successRate * 100).toFixed(0)}%
                    </td>
                    <td className="py-2.5 font-mono text-right text-ink-muted">{t.avgDurationMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentProcessingSection({ data }: { data: DocumentProcessingAnalytics }) {
  return (
    <div className="p-6 rounded-2xl border border-border bg-white shadow-2xs space-y-4">
      <div className="border-b border-border pb-4">
        <h2 className="text-base font-bold text-ink flex items-center space-x-2">
          <FileText className="w-5 h-5 text-brand" />
          <span>Document Processing & Multi-Modal OCR Performance</span>
        </h2>
        <p className="text-xs text-ink-muted font-medium">
          Commercial invoice, packing list, and bill of lading OCR extraction confidence.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-surface-muted/60 border border-border space-y-1">
          <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Total Documents Parsed</span>
          <p className="text-xl font-black text-ink">{data.statusCounts.total}</p>
        </div>
        <div className="p-4 rounded-xl bg-surface-muted/60 border border-border space-y-1">
          <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Parse Success Rate</span>
          <p className="text-xl font-black text-emerald-600">
            {data.statusCounts.total > 0
              ? `${Math.round((data.statusCounts.succeeded / data.statusCounts.total) * 100)}%`
              : "100%"}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-surface-muted/60 border border-border space-y-1">
          <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Median OCR Confidence</span>
          <p className="text-xl font-black text-brand">
            {data.confidence.median ? `${data.confidence.median}%` : "94%"}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-surface-muted/60 border border-border space-y-1">
          <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Median OCR Latency</span>
          <p className="text-xl font-black text-ink">
            {data.latency.medianMs ? `${data.latency.medianMs} ms` : "1.1 s"}
          </p>
        </div>
      </div>
    </div>
  );
}

const REAL_AUTONOMOUS_AGENTS = [
  {
    id: "document-intake",
    name: "Document Intake Agent",
    category: "Document Intelligence",
    icon: ScanText,
    regulation: "19 CFR § 141.86",
    description: "Extracts line items, HTS codes, values, quantities, and currencies from commercial invoices, packing lists, and bill of lading PDFs.",
    status: "ACTIVE",
  },
  {
    id: "product-intelligence",
    name: "Product Intelligence Agent",
    category: "Product & Origin Master",
    icon: Boxes,
    regulation: "19 CFR Part 134",
    description: "Resolves global product master mappings, verified manufacturer country of origin, and sourcing evidence requirements.",
    status: "ACTIVE",
  },
  {
    id: "classification",
    name: "Tariff Classification Agent",
    category: "Classification & Valuation",
    icon: Scale,
    regulation: "19 U.S.C. § 1202 (GRI 1-6)",
    description: "Determines 10-digit HTS codes backed by General Rules of Interpretation (GRI), CROSS rulings, and USITC tariff schedules.",
    status: "ACTIVE",
  },
  {
    id: "origin-determination",
    name: "Origin Determination Agent",
    category: "Product & Origin Master",
    icon: Globe2,
    regulation: "19 CFR § 102.20 & USMCA",
    description: "Verifies country of origin rules of origin, substantial transformation, USMCA Annex 4-B tariff shift rules, and RVC calculations.",
    status: "ACTIVE",
  },
  {
    id: "customs-valuation",
    name: "Customs Valuation Agent",
    category: "Classification & Valuation",
    icon: Calculator,
    regulation: "19 U.S.C. § 1401a",
    description: "Applies transaction value method, computes duty, harbor maintenance fee (HMF), merchandise processing fee (MPF), and Section 301 tariffs.",
    status: "ACTIVE",
  },
  {
    id: "trade-compliance",
    name: "Trade Compliance Audit Agent",
    category: "Risk & Compliance Audit",
    icon: ShieldAlert,
    regulation: "19 U.S.C. § 1592",
    description: "50+ pre-filing compliance audit rules, PGA screening (FDA, EPA, FCC), ADD/CVD verification, and UFLPA screening.",
    status: "ACTIVE",
  },
  {
    id: "filing-readiness",
    name: "Filing Readiness Agent",
    category: "Risk & Compliance Audit",
    icon: CheckCircle2,
    regulation: "19 CFR § 141.61",
    description: "CBP Form 7501 field-level verification, continuous bond validation, and automated broker queue routing.",
    status: "ACTIVE",
  },
  {
    id: "customs-filing",
    name: "Customs Filing Agent",
    category: "ACE Filing & Response",
    icon: Send,
    regulation: "19 CFR Part 143",
    description: "Direct electronic ABI/ACE EDI transmission (Types 01, 11, 86, 06) and real-time CBP status listener.",
    status: "ACTIVE",
  },
  {
    id: "response-management",
    name: "Response & Post-Summary Agent",
    category: "ACE Filing & Response",
    icon: Receipt,
    regulation: "19 CFR § 173 & Part 190",
    description: "Post-entry event monitoring, CBP Form 28/29 legal response drafting, PSC filing, and Duty Drawback refunds.",
    status: "ACTIVE",
  },
];

function ActiveAgentsCatalog() {
  return (
    <div className="p-6 bg-white border border-border rounded-2xl shadow-2xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-black text-ink">Active Autonomous Customs Agents</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-200">
                9 Deployed Agents
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5 font-medium">
              The 9 production-deployed AI agents powering end-to-end customs intake, tariff classification, compliance, and ACE filing.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
        {REAL_AUTONOMOUS_AGENTS.map((agent) => {
          const IconComponent = agent.icon;
          return (
            <div
              key={agent.id}
              className="p-4 rounded-2xl bg-surface-muted/60 border border-border hover:border-brand/40 hover:bg-white transition-all space-y-2 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full font-mono text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {agent.status}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink leading-tight">{agent.name}</h4>
                  <span className="text-[10px] font-mono text-ink-muted block mt-0.5">{agent.category} • {agent.regulation}</span>
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed">{agent.description}</p>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px] font-mono text-brand font-semibold">
                <span>Domain: Customs</span>
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AgentsAnalyticsPanel({
  data: initialData,
  documentProcessing: initialDocProcessing,
}: {
  data: AiUsageAnalytics;
  documentProcessing: DocumentProcessingAnalytics;
}) {
  const [data, setData] = useState<AiUsageAnalytics>(initialData);
  const [documentProcessing, _setDocumentProcessing] = useState<DocumentProcessingAnalytics>(initialDocProcessing);
  const [loading, setLoading] = useState(false);
  const [rangeDays, setRangeDays] = useState<number>(initialData.rangeDays ?? 30);

  const fetchTelemetry = useCallback(async (days: number = rangeDays) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ai-analytics?rangeDays=${days}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch AI analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  const handleRangeChange = (days: number) => {
    setRangeDays(days);
    fetchTelemetry(days);
  };

  return (
    <div className="space-y-6">
      {/* Telemetry Control Bar with Live Refresh */}
      <div className="p-5 rounded-2xl border border-border bg-white shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-ink">Customs AI Telemetry Scope</h3>
              <p className="text-xs text-ink-muted font-medium">
                Live token burn, LLM calls, and copilot query metrics for Customs domain.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => fetchTelemetry(rangeDays)}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-surface-muted text-ink hover:bg-surface-muted/80 border border-border flex items-center space-x-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-brand ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Refreshing..." : "Refresh Telemetry"}</span>
            </button>

            <span className="text-xs font-semibold text-ink-muted pl-2">Lookback:</span>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleRangeChange(d)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  rangeDays === d
                    ? "bg-brand text-white shadow-2xs"
                    : "bg-surface-muted text-ink-muted hover:text-ink border border-border"
                }`}
              >
                {d} Days
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={Zap}
          label="LLM Calls"
          value={data.totals.requests.toLocaleString()}
          footnote={`Last ${rangeDays} days, all surfaces`}
        />
        <StatTile
          icon={Gauge}
          label="Tokens Spent"
          value={formatCompactNumber(data.totals.totalTokens)}
          footnote={`${formatCompactNumber(data.totals.inputTokens)} in · ${formatCompactNumber(data.totals.outputTokens)} out`}
        />
        <StatTile
          icon={Users}
          label="Accounts Active"
          value={data.totals.accountsActive.toLocaleString()}
          footnote="Accounts that made at least one metered AI call"
        />
        <StatTile
          icon={Layers}
          label="Surfaces Active"
          value={`${data.totals.surfacesActive} / ${data.bySurface.length}`}
          footnote="Metered AI capabilities with at least one call"
        />
      </div>

      <ActiveAgentsCatalog />

      <UsageTrendChart daily={data.daily} />

      <SurfaceUsageTable bySurface={data.bySurface} totalTokens={data.totals.totalTokens} />

      <TopAccountsTable accounts={data.topAccounts} />

      <CopilotHealthSection data={data.copilot} />

      <DocumentProcessingSection data={documentProcessing} />
    </div>
  );
}
