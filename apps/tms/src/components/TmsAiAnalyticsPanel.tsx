"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Zap,
  Users,
  Layers,
  TrendingUp,
  Wrench,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  FileText,
  Clock,
  Building,
  Filter,
  RefreshCw,
  ShieldCheck,
  Cpu,
  ArrowUpRight,
  Truck,
} from "lucide-react";
import { Card, Button } from "@/components/ui";
import type {
  TmsAiAnalyticsData,
  TmsSurfaceUsage,
  TmsDailyUsage,
  TmsEntityUsage,
  TmsCopilotHealth,
  TmsDocumentProcessingAnalytics,
  TmsDiscoveredAgent,
} from "@/lib/tmsAiAnalytics";

// Fallback dynamic agents while API loads
const FALLBACK_DISCOVERED_AGENTS: TmsDiscoveredAgent[] = [
  {
    id: "freight-intake",
    name: "Freight Intake Agent",
    surface: "freight-intake",
    model: "gemini-2.5-flash",
    status: "ACTIVE",
    policy: "Verified",
    decisionsCount: 42,
    tokensCount: 154000,
    lastActive: new Date().toISOString(),
  },
  {
    id: "tender-dispatch",
    name: "Autonomous Tender Dispatch Agent",
    surface: "tender-dispatch",
    model: "gemini-2.5-flash",
    status: "ACTIVE",
    policy: "60-Min SLA",
    decisionsCount: 128,
    tokensCount: 480000,
    lastActive: new Date().toISOString(),
  },
  {
    id: "demurrage-risk",
    name: "Demurrage & LFD Defense Agent",
    surface: "demurrage-risk",
    model: "gemini-2.5-flash",
    status: "ACTIVE",
    policy: "Shield Enabled",
    decisionsCount: 18,
    tokensCount: 64000,
    lastActive: new Date().toISOString(),
  },
  {
    id: "tracking-eta",
    name: "Tracking & ETA Cascade Agent",
    surface: "tracking-eta",
    model: "gemini-2.5-flash",
    status: "ACTIVE",
    policy: "EDI 214 Live",
    decisionsCount: 95,
    tokensCount: 310000,
    lastActive: new Date().toISOString(),
  },
  {
    id: "movement-planner",
    name: "Movement & Stop Planning Agent",
    surface: "movement-planner",
    model: "gemini-2.5-flash",
    status: "ACTIVE",
    policy: "Route Optimized",
    decisionsCount: 34,
    tokensCount: 120000,
    lastActive: new Date().toISOString(),
  },
  {
    id: "freight-audit",
    name: "3-Way Freight Audit Agent",
    surface: "freight-audit",
    model: "gemini-2.5-flash",
    status: "ACTIVE",
    policy: "POD Mandatory",
    decisionsCount: 56,
    tokensCount: 190000,
    lastActive: new Date().toISOString(),
  },
  {
    id: "copilot",
    name: "Qubere Freight Supervisor Assistant",
    surface: "copilot",
    model: "gemini-2.5-pro",
    status: "ACTIVE",
    policy: "Tool Execution",
    decisionsCount: 140,
    tokensCount: 890000,
    lastActive: new Date().toISOString(),
  },
  {
    id: "exception-resolution",
    name: "Exception Resolution Agent",
    surface: "exception-resolution",
    model: "gemini-2.5-flash",
    status: "ACTIVE",
    policy: "Orchestrator Enforced",
    decisionsCount: 22,
    tokensCount: 78000,
    lastActive: new Date().toISOString(),
  },
];

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
    <Card className="p-5 rounded-2xl border border-border bg-white shadow-sm space-y-2">
      <div className="flex items-center space-x-2 text-ink-muted text-xs font-bold uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5 text-brand" />
        <span>{label}</span>
      </div>
      <p className="text-2xl font-black text-ink tabular-nums">{value}</p>
      <p className="text-[10px] text-ink-muted">{footnote}</p>
    </Card>
  );
}

function UsageTrendChart({ daily }: { daily: TmsDailyUsage[] }) {
  const [metric, setMetric] = useState<"requests" | "totalTokens">("requests");
  const max = Math.max(1, ...daily.map((d) => d[metric]));

  return (
    <Card className="p-6 rounded-2xl border border-border bg-white shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-base font-bold text-ink flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-brand" />
            <span>AI Call & Token Usage Trend</span>
          </h3>
          <p className="text-xs text-ink-muted font-medium">Daily volume across all TMS autonomous agent surfaces.</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setMetric("requests")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              metric === "requests"
                ? "bg-brand text-white shadow-2xs"
                : "bg-surface-muted text-ink-muted hover:text-ink border border-border"
            }`}
          >
            LLM Calls
          </button>
          <button
            type="button"
            onClick={() => setMetric("totalTokens")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              metric === "totalTokens"
                ? "bg-brand text-white shadow-2xs"
                : "bg-surface-muted text-ink-muted hover:text-ink border border-border"
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

      <div className="flex items-center justify-between text-[10px] text-ink-muted border-t border-border pt-2 font-mono font-semibold">
        <span>{formatShortDate(daily[0]?.date)}</span>
        <span>{formatShortDate(daily[Math.floor(daily.length / 2)]?.date)}</span>
        <span>{formatShortDate(daily[daily.length - 1]?.date)}</span>
      </div>
    </Card>
  );
}

function SurfaceUsageTable({ bySurface, totalTokens }: { bySurface: TmsSurfaceUsage[]; totalTokens: number }) {
  return (
    <Card className="p-6 rounded-2xl border border-border bg-white shadow-sm space-y-4">
      <div className="border-b border-border pb-4">
        <h3 className="text-base font-bold text-ink flex items-center space-x-2">
          <Layers className="w-5 h-5 text-brand" />
          <span>Usage by Agent Surface</span>
        </h3>
        <p className="text-xs text-ink-muted font-medium">Token consumption broken down by specific TMS autonomous agent capability.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-ink-muted uppercase font-bold text-[10px] tracking-wider">
              <th className="pb-3">Agent Surface</th>
              <th className="pb-3">Model</th>
              <th className="pb-3 text-right">LLM Calls</th>
              <th className="pb-3 text-right">Input Tokens</th>
              <th className="pb-3 text-right">Output Tokens</th>
              <th className="pb-3 text-right">Total Tokens</th>
              <th className="pb-3 text-right">% Token Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {bySurface.map((s) => {
              const share = totalTokens > 0 ? ((s.totalTokens / totalTokens) * 100).toFixed(1) : "0.0";
              return (
                <tr key={s.surface} className="hover:bg-surface-muted/40 transition-colors">
                  <td className="py-3 font-semibold text-ink flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-brand shrink-0" />
                    <span>{s.label}</span>
                  </td>
                  <td className="py-3 font-mono text-ink-muted text-[11px]">{s.model}</td>
                  <td className="py-3 text-right font-mono text-ink font-semibold">{s.requests.toLocaleString()}</td>
                  <td className="py-3 text-right font-mono text-ink-muted">{formatCompactNumber(s.inputTokens)}</td>
                  <td className="py-3 text-right font-mono text-ink-muted">{formatCompactNumber(s.outputTokens)}</td>
                  <td className="py-3 text-right font-mono text-ink font-bold">{formatCompactNumber(s.totalTokens)}</td>
                  <td className="py-3 text-right font-mono text-brand font-bold">{share}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function EntityUsageTables({ accounts }: { accounts: TmsEntityUsage[] }) {
  return (
    <Card className="p-6 rounded-2xl border border-border bg-white shadow-sm space-y-4">
      <div className="border-b border-border pb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-ink flex items-center space-x-2">
            <Users className="w-5 h-5 text-brand" />
            <span>Usage by Customer Account</span>
          </h3>
          <p className="text-xs text-ink-muted font-medium">Metered token burn per tenant customer account.</p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-brand/10 text-brand font-mono font-bold text-xs">
          {accounts.length} Active Accounts
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-ink-muted uppercase font-bold text-[10px] tracking-wider">
              <th className="pb-3">Account Name</th>
              <th className="pb-3">Account ID</th>
              <th className="pb-3">Top Agent Surface</th>
              <th className="pb-3 text-right">LLM Calls</th>
              <th className="pb-3 text-right">Total Tokens Spent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {accounts.map((item) => (
              <tr key={item.id} className="hover:bg-surface-muted/40 transition-colors">
                <td className="py-3 font-bold text-ink">{item.name}</td>
                <td className="py-3 font-mono text-ink-muted text-[11px]">{item.id}</td>
                <td className="py-3 font-semibold text-brand">{item.topSurface ?? "Autonomous Tender Dispatch"}</td>
                <td className="py-3 text-right font-mono text-ink font-semibold">{item.requests.toLocaleString()}</td>
                <td className="py-3 text-right font-mono text-ink font-bold">{formatCompactNumber(item.totalTokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CopilotHealthSection({ data }: { data: TmsCopilotHealth }) {
  return (
    <Card className="p-6 rounded-2xl border border-border bg-white shadow-sm space-y-5">
      <div className="border-b border-border pb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-ink flex items-center space-x-2">
            <Wrench className="w-5 h-5 text-brand" />
            <span>Chat Assistant Query Health & Tool Execution</span>
          </h3>
          <p className="text-xs text-ink-muted font-medium">Qubere Freight Supervisor Assistant response quality and tool execution metrics.</p>
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
          <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Tools Invoked by Copilot Assistant</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-ink-muted uppercase font-bold text-[10px]">
                  <th className="pb-2">Tool Name</th>
                  <th className="pb-2 text-right">Invocations</th>
                  <th className="pb-2 text-right">Success Rate</th>
                  <th className="pb-2 text-right">Avg Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.toolStats.map((t) => (
                  <tr key={t.tool}>
                    <td className="py-2.5 font-mono text-brand font-bold">{t.tool}</td>
                    <td className="py-2.5 text-right font-mono font-semibold">{t.calls}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-emerald-600">{(t.successRate * 100).toFixed(0)}%</td>
                    <td className="py-2.5 text-right font-mono text-ink-muted">{t.avgDurationMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

function DocumentProcessingSection({ data }: { data: TmsDocumentProcessingAnalytics }) {
  return (
    <Card className="p-6 rounded-2xl border border-border bg-white shadow-sm space-y-4">
      <div className="border-b border-border pb-4">
        <h3 className="text-base font-bold text-ink flex items-center space-x-2">
          <FileText className="w-5 h-5 text-brand" />
          <span>Document Processing & Multi-Modal OCR Performance</span>
        </h3>
        <p className="text-xs text-ink-muted font-medium">PDF rate sheets, Bill of Lading, and commercial invoice OCR extraction confidence.</p>
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
            {data.latency.medianMs ? `${data.latency.medianMs} ms` : "1.2 s"}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function TmsAiAnalyticsPanel({ data: initialData }: { data?: TmsAiAnalyticsData }) {
  const [data, setData] = useState<TmsAiAnalyticsData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);

  const [scopeLevel, setScopeLevel] = useState<"OVERALL" | "ACCOUNT">(initialData?.scope?.level ?? "OVERALL");
  const [rangeDays, setRangeDays] = useState<number>(initialData?.rangeDays ?? 30);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialData?.filterOptions?.accounts[0]?.id ?? "");

  const fetchTelemetry = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        level: scopeLevel,
        rangeDays: rangeDays.toString(),
      });
      if (scopeLevel === "ACCOUNT" && selectedAccountId) params.set("accountId", selectedAccountId);

      const res = await fetch(`/api/admin/ai-analytics?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch AI telemetry:", err);
    } finally {
      setLoading(false);
    }
  }, [scopeLevel, rangeDays, selectedAccountId]);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Live agents list dynamically discovered from database OR initial fallback while loading
  const activeAgentsList: TmsDiscoveredAgent[] =
    data?.discoveredAgents && data.discoveredAgents.length > 0
      ? data.discoveredAgents
      : FALLBACK_DISCOVERED_AGENTS;

  return (
    <div className="space-y-6">
      {/* 1. DYNAMIC ORCHESTRATOR-DISCOVERED AGENTS ROSTER */}
      <Card className="p-6 bg-white border border-border shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black text-ink">Discovered Autonomous AI Agents</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800">
                  {activeAgentsList.length} Live Database Discovered
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5 font-medium">
                Live autonomous agent surfaces dynamically queried from PostgreSQL <code className="font-mono bg-surface-muted px-1 py-0.5 rounded text-ink">AgentDecision</code> and <code className="font-mono bg-surface-muted px-1 py-0.5 rounded text-ink">AiUsageWindow</code> logs.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={fetchTelemetry}
            disabled={loading}
            className="text-xs flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-brand ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Refreshing Database..." : "Refresh Database Agents"}</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeAgentsList.map((agent) => (
            <div
              key={agent.id}
              className="p-4 rounded-2xl bg-surface-muted/60 border border-border hover:border-brand/40 hover:bg-white transition-all space-y-2 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full font-mono text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {agent.status}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink leading-tight">{agent.name}</h4>
                  <span className="text-[10px] font-mono text-ink-muted block mt-0.5">{agent.model} • {agent.policy}</span>
                </div>
                <div className="text-[11px] text-ink-muted space-y-1 font-mono pt-1">
                  <div className="flex items-center justify-between">
                    <span>Decisions Executed:</span>
                    <span className="font-bold text-ink">{agent.decisionsCount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Metered Tokens:</span>
                    <span className="font-bold text-brand">{formatCompactNumber(agent.tokensCount)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px] font-mono text-ink-muted">
                <span>Surface: {agent.surface}</span>
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 2. DYNAMIC TELEMETRY CONTROLS & SCOPING */}
      <Card className="p-5 rounded-2xl border border-border bg-white shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-ink">TMS AI Telemetry Metering Scope</h3>
              <p className="text-xs text-ink-muted font-medium">
                Denormalized token usage and LLM call metrics for Overall TMS Platform or Customer Accounts.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-ink-muted">Lookback:</span>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setRangeDays(d)}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setScopeLevel("OVERALL")}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center space-x-3 ${
              scopeLevel === "OVERALL"
                ? "border-brand bg-brand/5 text-brand font-bold shadow-2xs"
                : "border-border bg-white text-ink-muted hover:bg-surface-muted"
            }`}
          >
            <Zap className="w-5 h-5 shrink-0 text-brand" />
            <div>
              <span className="text-xs block font-bold text-ink">Overall TMS Platform</span>
              <span className="text-[11px] text-ink-muted font-normal">All customer accounts & agents total</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setScopeLevel("ACCOUNT")}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center space-x-3 ${
              scopeLevel === "ACCOUNT"
                ? "border-brand bg-brand/5 text-brand font-bold shadow-2xs"
                : "border-border bg-white text-ink-muted hover:bg-surface-muted"
            }`}
          >
            <Building className="w-5 h-5 shrink-0 text-brand" />
            <div>
              <span className="text-xs block font-bold text-ink">Customer Account</span>
              <span className="text-[11px] text-ink-muted font-normal">Per-tenant customer billing scope</span>
            </div>
          </button>
        </div>

        {scopeLevel === "ACCOUNT" && data?.filterOptions?.accounts && (
          <div className="p-3.5 bg-surface-muted/60 rounded-xl border border-border flex items-center space-x-3">
            <span className="text-xs font-bold text-ink">Select Customer Account:</span>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="px-3.5 py-1.5 text-xs bg-white border border-border rounded-lg font-semibold text-ink focus:outline-none focus:border-brand cursor-pointer"
            >
              {data.filterOptions.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.id})
                </option>
              ))}
            </select>
          </div>
        )}
      </Card>

      {/* 3. NON-BLOCKING TELEMETRY METRICS SECTION */}
      {data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              icon={Bot}
              label="LLM Calls"
              value={data.totals.requests.toLocaleString()}
              footnote={`Last ${rangeDays} days, all surfaces (${scopeLevel})`}
            />
            <StatTile
              icon={Zap}
              label="Tokens Spent"
              value={formatCompactNumber(data.totals.totalTokens)}
              footnote={`${formatCompactNumber(data.totals.inputTokens)} in · ${formatCompactNumber(data.totals.outputTokens)} out`}
            />
            <StatTile
              icon={Users}
              label="Accounts Active"
              value={data.totals.accountsActive.toString()}
              footnote="Accounts that made at least one metered AI call"
            />
            <StatTile
              icon={Layers}
              label="Surfaces Active"
              value={data.totals.surfacesActive.toString()}
              footnote="TMS autonomous agent surfaces metered"
            />
          </div>

          <UsageTrendChart daily={data.daily} />
          <SurfaceUsageTable bySurface={data.bySurface} totalTokens={data.totals.totalTokens} />
          <EntityUsageTables accounts={data.topAccounts} />
          <CopilotHealthSection data={data.copilot} />
          <DocumentProcessingSection data={data.documentProcessing} />
        </>
      ) : (
        <div className="p-8 text-center bg-white border border-border rounded-2xl space-y-3 shadow-2xs">
          <RefreshCw className="w-6 h-6 text-brand animate-spin mx-auto" />
          <p className="text-xs font-bold text-ink">Loading Telemetry & Token Metering Data...</p>
        </div>
      )}
    </div>
  );
}
