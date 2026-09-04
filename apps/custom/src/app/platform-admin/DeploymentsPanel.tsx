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
  Terminal,
  ShieldCheck,
  Zap,
  Globe2,
  Clock,
  User,
  GitCommit,
  Layers,
} from "lucide-react";

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
  const [currentSha, setCurrentSha] = useState<string>("929e8d4");
  const [loading, setLoading] = useState(true);
  const [healthResults, setHealthResults] = useState<Record<string, HealthPingResult>>({});
  const [isSweeping, setIsSweeping] = useState(false);

  const fetchDeployments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform-admin/deployments");
      if (res.ok) {
        const data = await res.json();
        setDeployments(data.deployments || []);
        setServices(data.services || []);
        if (data.currentSha) setCurrentSha(data.currentSha);
        if (data.healthResults) setHealthResults(data.healthResults);
      }
    } catch (err) {
      console.error("Failed to load deployments:", err);
    } finally {
      setLoading(false);
    }
  };

  const runHealthSweep = async () => {
    setIsSweeping(true);
    const results: Record<string, HealthPingResult> = {};

    // Initialize all to checking state
    services.forEach((s) => {
      results[s.id] = { status: "checking" };
    });
    setHealthResults({ ...results });

    // Asynchronously ping all health check endpoints
    const pingPromises = services.map(async (service) => {
      const start = Date.now();
      try {
        const res = await fetch(service.quickHealthUrl, { method: "GET", cache: "no-store" });
        const latencyMs = Date.now() - start;
        let dbStatus = "connected";

        try {
          const body = await res.json();
          if (body?.checks?.database?.ok === false) dbStatus = "degraded";
        } catch {
          // ignore non-json
        }

        results[service.id] = {
          status: res.ok ? "healthy" : "degraded",
          latencyMs,
          statusCode: res.status,
          dbStatus,
        };
      } catch (err) {
        results[service.id] = {
          status: "error",
          statusCode: 500,
          latencyMs: Date.now() - start,
        };
      }
    });

    await Promise.all(pingPromises);
    setHealthResults({ ...results });
    setIsSweeping(false);
  };

  useEffect(() => {
    fetchDeployments();
  }, []);

  useEffect(() => {
    if (services.length > 0) {
      runHealthSweep();
    }
  }, [services]);

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
              <p className="text-[10px] uppercase font-bold text-ink-muted">Total Services</p>
              <p className="text-xs font-extrabold text-ink">{services.length} GCP Infrastructure Services</p>
            </div>
          </div>

          <button
            type="button"
            onClick={runHealthSweep}
            disabled={isSweeping}
            className="px-4 py-2.5 rounded-full bg-brand text-white text-xs font-bold shadow-md shadow-brand/20 hover:bg-brand-dark transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSweeping ? "animate-spin" : ""}`} />
            <span>{isSweeping ? "Sweeping GCP Services..." : "Run Live GCP Health Sweep"}</span>
          </button>
        </div>
      </div>

      {/* GCP Service Health Checks & Handylinks Directory */}
      <div className="apple-card rounded-3xl border border-border bg-white shadow-xs overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-ink">GCP Infrastructure Health & Handylinks Directory</h2>
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
