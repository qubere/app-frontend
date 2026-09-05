"use client";

import { useEffect, useState } from "react";
import {
  Rocket,
  Activity,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Server,
  Zap,
  User,
  GitCommit,
  ShieldCheck,
  Database,
  Bot,
  FileText,
  Shield,
  Key,
  Truck,
  Mail,
  DollarSign,
  Layers,
  Cpu,
} from "lucide-react";
import type { ThirdPartyProviderHealth, ThirdPartyProviderCategory } from "@/lib/health/thirdPartyHealthService";

interface DeploymentEntry {
  hash: string;
  date: string;
  summary: string;
  author: string;
  serviceTag?: string;
}

interface GcpServiceConfig {
  id: string;
  name: string;
  description: string;
  type: "Cloud Run Service" | "Cloud Run Job";
  region: string;
  primaryUrl: string;
  quickHealthUrl: string;
  deepHealthUrl: string;
}

interface HealthPingResult {
  status: "healthy" | "degraded" | "checking" | "error";
  latencyMs?: number;
  statusCode?: number;
  dbStatus?: string;
}

function fmt(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function DeploymentsPanel() {
  const [deployments, setDeployments] = useState<DeploymentEntry[]>([]);
  const [services, setServices] = useState<GcpServiceConfig[]>([]);
  const [thirdPartyProviders, setThirdPartyProviders] = useState<ThirdPartyProviderHealth[]>([]);
  const [currentSha, setCurrentSha] = useState<string>("929e8d4");
  const [loading, setLoading] = useState(true);
  const [healthResults, setHealthResults] = useState<Record<string, HealthPingResult>>({});
  const [isSweeping, setIsSweeping] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const fetchDeployments = async (isSweepAction = false) => {
    if (isSweepAction) setIsSweeping(true);
    else setLoading(true);

    try {
      const method = isSweepAction ? "POST" : "GET";
      const res = await fetch("/api/platform-admin/deployments", { method, cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setDeployments(data.deployments || []);
        setServices(data.services || []);
        if (data.currentSha) setCurrentSha(data.currentSha);
        if (data.healthResults) setHealthResults(data.healthResults);
        if (data.thirdPartyProviders) setThirdPartyProviders(data.thirdPartyProviders);
      }
    } catch (err) {
      console.error("Failed to load deployment health data:", err);
    } finally {
      setLoading(false);
      setIsSweeping(false);
    }
  };

  useEffect(() => {
    fetchDeployments();
  }, []);

  const categories: { label: string; value: string }[] = [
    { label: "All Integrations", value: "ALL" },
    { label: "Database & Storage", value: "Database & Storage" },
    { label: "AI & Reasoning", value: "AI & Reasoning" },
    { label: "Document Parsing", value: "Document & Parsing" },
    { label: "Security & Malware", value: "Security & Virus" },
    { label: "Auth & Identity", value: "Auth & Identity" },
    { label: "Customs & Regulatory", value: "Customs & Regulatory" },
    { label: "Logistics & Tracking", value: "Logistics & Telematics" },
    { label: "Messaging & Email", value: "Messaging & Email" },
    { label: "Financial & FX", value: "Financial Services" },
  ];

  const filteredProviders = thirdPartyProviders.filter((p) => {
    if (selectedCategory === "ALL") return true;
    return p.category === selectedCategory;
  });

  const healthyCount = thirdPartyProviders.filter((p) => p.status === "healthy").length;
  const mockCount = thirdPartyProviders.filter((p) => p.status === "configured_mock").length;
  const unconfiguredCount = thirdPartyProviders.filter((p) => p.status === "not_configured" || p.status === "degraded" || p.status === "error").length;

  const getCategoryIcon = (category: ThirdPartyProviderCategory) => {
    switch (category) {
      case "Database & Storage":
        return <Database className="w-4 h-4 text-emerald-600" />;
      case "AI & Reasoning":
        return <Bot className="w-4 h-4 text-indigo-600" />;
      case "Document & Parsing":
        return <FileText className="w-4 h-4 text-amber-600" />;
      case "Security & Virus":
        return <Shield className="w-4 h-4 text-red-600" />;
      case "Auth & Identity":
        return <Key className="w-4 h-4 text-purple-600" />;
      case "Customs & Regulatory":
        return <ShieldCheck className="w-4 h-4 text-blue-600" />;
      case "Logistics & Telematics":
        return <Truck className="w-4 h-4 text-cyan-600" />;
      case "Messaging & Email":
        return <Mail className="w-4 h-4 text-orange-600" />;
      case "Financial Services":
        return <DollarSign className="w-4 h-4 text-emerald-700" />;
      default:
        return <Layers className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Current Active Build Banner */}
      <div className="apple-card p-6 rounded-3xl border border-border bg-white shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-2xs">
            <Rocket className="w-6 h-6 shrink-0" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-ink-muted uppercase tracking-wider font-bold">
                Currently Deployed GCP Revision
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                ACTIVE DEMO
              </span>
            </div>
            <div className="flex items-center space-x-2.5 mt-1">
              <span className="font-mono text-xl font-extrabold text-ink tracking-tight">{currentSha}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-ink-muted">
                qubere-demo (us-west1)
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-surface-muted px-4 py-2.5 rounded-2xl border border-border flex items-center space-x-3">
            <Server className="w-4 h-4 text-brand" />
            <div>
              <p className="text-[10px] uppercase font-bold text-ink-muted">Infrastructure</p>
              <p className="text-xs font-extrabold text-ink">{services.length} GCP Services</p>
            </div>
          </div>

          <div className="bg-surface-muted px-4 py-2.5 rounded-2xl border border-border flex items-center space-x-3">
            <Cpu className="w-4 h-4 text-indigo-600" />
            <div>
              <p className="text-[10px] uppercase font-bold text-ink-muted">Dependencies</p>
              <p className="text-xs font-extrabold text-ink">{thirdPartyProviders.length} Third-Party Integrations</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchDeployments(true)}
            disabled={isSweeping}
            className="px-4 py-2.5 rounded-full bg-brand text-white text-xs font-bold shadow-md shadow-brand/20 hover:bg-brand-dark transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSweeping ? "animate-spin" : ""}`} />
            <span>{isSweeping ? "Sweeping Platform & Provider Health..." : "Run Live Health Sweep"}</span>
          </button>
        </div>
      </div>

      {/* THIRD-PARTY DEPENDENCIES HEALTH CHECK DASHBOARD */}
      <div className="apple-card rounded-3xl border border-border bg-white shadow-xs overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-ink">Third-Party Provider &amp; Service Dependencies</h2>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Live connectivity, API key readiness, mock sandbox states, and response latencies across all 15 platform integrations.
            </p>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {healthyCount} Live Healthy
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
              {mockCount} Sandbox / Mock Active
            </span>
            {unconfiguredCount > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                {unconfiguredCount} Optional / Fallback
              </span>
            )}
          </div>
        </div>

        {/* Category Filters */}
        <div className="px-6 py-3 border-b border-border bg-slate-50/50 flex flex-wrap items-center gap-2">
          {categories.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setSelectedCategory(c.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                selectedCategory === c.value
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white border border-border text-ink-muted hover:text-ink hover:bg-slate-100"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Dependencies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-slate-50/30">
          {filteredProviders.map((prov) => {
            const isHealthy = prov.status === "healthy";
            const isMock = prov.status === "configured_mock";
            const isNotConfigured = prov.status === "not_configured";
            const isError = prov.status === "error" || prov.status === "degraded";

            return (
              <div
                key={prov.id}
                className="bg-white p-5 rounded-2xl border border-border shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                        {getCategoryIcon(prov.category)}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
                          {prov.category}
                        </span>
                        <h3 className="text-sm font-bold text-ink">{prov.name}</h3>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-mono text-[11px] text-ink-muted bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 truncate max-w-[180px]">
                      {prov.providerType}
                    </span>

                    {isHealthy ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{prov.statusLabel} {prov.latencyMs != null ? `(${prov.latencyMs}ms)` : ""}</span>
                      </span>
                    ) : isMock ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1">
                        <Activity className="w-3 h-3 text-amber-600" />
                        <span>{prov.statusLabel}</span>
                      </span>
                    ) : isNotConfigured ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 flex items-center space-x-1">
                        <span>Not Configured</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-800 border border-red-200 flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 text-red-600" />
                        <span>{prov.statusLabel}</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-ink-muted leading-relaxed pt-1">{prov.details}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/70 flex items-center justify-between text-[11px] text-ink-muted">
                  <span>
                    Production Requirement:{" "}
                    <strong className={prov.requiredInProd ? "text-amber-700" : "text-slate-600"}>
                      {prov.requiredInProd ? "Required Filer Credential" : "Optional / Sandbox Extension"}
                    </strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* GCP Service Health Checks & Handylinks Directory */}
      <div className="apple-card rounded-3xl border border-border bg-white shadow-xs overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-ink">GCP Infrastructure Health &amp; Handylinks Directory</h2>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Live service status, quick health checks, deep diagnostics, and direct access links for all GCP Cloud Run services.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-ink-muted">Quick &amp; Deep Diagnostic Links</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-slate-50/50">
          {services.map((srv) => {
            const ping = healthResults[srv.id];
            const isHealthy = ping?.status === "healthy";
            const isChecking = ping?.status === "checking" || !ping;

            return (
              <div
                key={srv.id}
                className="bg-white p-5 rounded-2xl border border-border shadow-2xs hover:shadow-md hover:border-brand/30 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Title & Service Type */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
                        {srv.type} · {srv.region}
                      </span>
                      <h3 className="text-sm font-bold text-ink mt-0.5">{srv.name}</h3>
                    </div>
                    {isChecking ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 flex items-center space-x-1">
                        <Activity className="w-3 h-3 animate-spin" />
                        <span>Checking...</span>
                      </span>
                    ) : isHealthy ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>200 OK ({ping.latencyMs}ms)</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 text-red-600" />
                        <span>{ping?.statusCode ? `HTTP ${ping.statusCode}` : "Unreachable"}</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-ink-muted leading-relaxed">{srv.description}</p>
                </div>

                {/* Handylinks */}
                <div className="mt-4 pt-4 border-t border-border/70 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink-muted text-[11px]">Primary Service:</span>
                    <a
                      href={srv.primaryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:underline font-bold inline-flex items-center space-x-1"
                    >
                      <span>{srv.primaryUrl.replace("https://", "")}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink-muted text-[11px]">Quick Health:</span>
                    <a
                      href={srv.quickHealthUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:underline font-mono text-[11px] inline-flex items-center space-x-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
                    >
                      <span>/api/health/live</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink-muted text-[11px]">Deep Health:</span>
                    <a
                      href={srv.deepHealthUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-700 hover:underline font-mono text-[11px] inline-flex items-center space-x-1 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200"
                    >
                      <span>/api/health</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deployment History Table */}
      <div className="apple-card rounded-3xl border border-border bg-white shadow-xs overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <GitCommit className="w-5 h-5 text-brand" />
              <h2 className="text-lg font-bold text-ink">Deployment &amp; Release Log (Last 10 Deployments)</h2>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Verified build provenance, high-level commit summaries, deployment owners, and target services.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full self-start sm:self-auto">
            Active Revision: {currentSha}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-ink-muted">
            <Activity className="w-6 h-6 animate-spin mx-auto text-brand mb-2" />
            <p className="text-xs font-semibold">Loading deployment records...</p>
          </div>
        ) : deployments.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-ink">Active GCP Cloud Run Revision</p>
            <p className="text-xs text-ink-muted mt-1 font-mono">Commit SHA: {currentSha}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-ink">
              <thead className="bg-surface-muted border-b border-border text-xs uppercase font-bold text-ink-muted">
                <tr>
                  <th className="px-6 py-3.5 whitespace-nowrap">Commit Hash</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Service Scope</th>
                  <th className="px-6 py-3.5">Deployment Summary</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Owner / Author</th>
                  <th className="px-6 py-3.5 whitespace-nowrap text-right">Deployed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deployments.map((e, i) => {
                  const isCurrent = i === 0 || e.hash.startsWith(currentSha);
                  return (
                    <tr
                      key={e.hash + i}
                      className={`align-top hover:bg-slate-50 transition-colors ${
                        isCurrent ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      <td className="px-6 py-4 font-mono text-xs whitespace-nowrap text-ink-muted">
                        <div className="flex items-center space-x-2">
                          <GitCommit className="w-3.5 h-3.5 text-brand shrink-0" />
                          <span className="font-bold text-ink">{e.hash}</span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-ink border border-slate-200">
                          {e.serviceTag || "General"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-ink leading-relaxed">
                        {e.summary}
                      </td>
                      <td className="px-6 py-4 text-xs text-ink-muted whitespace-nowrap">
                        <div className="flex items-center space-x-1.5 font-medium text-ink">
                          <User className="w-3.5 h-3.5 text-ink-muted" />
                          <span>{e.author}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-ink-muted whitespace-nowrap text-right font-mono">
                        {fmt(e.date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

