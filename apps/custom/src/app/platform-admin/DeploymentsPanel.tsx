"use client";

import { useEffect, useState } from "react";
import { Rocket, Activity, CheckCircle2, AlertCircle } from "lucide-react";

interface DeploymentEntry {
  hash: string;
  date: string;
  summary: string;
  author: string;
}

interface HealthResponse {
  status: string;
  service?: string;
  gitCommit?: string;
  environment?: string;
  timestamp?: string;
  activeCustomsProvider?: string;
  checks?: Record<string, { ok: boolean; detail?: string }>;
}

function parseLog(): DeploymentEntry[] {
  try {
    const raw = process.env.NEXT_PUBLIC_DEPLOYMENT_LOG;
    if (!raw) return [];
    return JSON.parse(raw) as DeploymentEntry[];
  } catch {
    return [];
  }
}

function fmt(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DeploymentsPanel() {
  const entries = parseLog();
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME;
  const envSha = process.env.NEXT_PUBLIC_GIT_COMMIT_SHA?.slice(0, 7);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const currentSha = health?.gitCommit?.slice(0, 7) || envSha || "—";
  const serviceName = health?.service || "qubere-customs-app";
  const environment = health?.environment || process.env.NEXT_PUBLIC_APP_ENV || "demo";
  const isHealthy = health?.status === "ok";

  return (
    <div className="space-y-6">
      {/* Current build banner */}
      <div className="apple-card p-5 rounded-3xl border border-border bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
            <Rocket className="w-6 h-6 shrink-0" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <p className="text-xs text-ink-muted uppercase tracking-wider font-semibold">
                Currently Deployed Build
              </p>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-ink">
                {environment}
              </span>
            </div>
            <div className="flex items-center space-x-2 mt-0.5">
              <p className="font-mono text-base font-bold text-emerald-800">{currentSha}</p>
              <span className="text-xs text-ink-muted">({serviceName})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-xs text-ink-muted">Health Status</p>
            <div className="flex items-center space-x-1.5 justify-end mt-0.5">
              {loading ? (
                <Activity className="w-4 h-4 text-amber-500 animate-spin" />
              ) : isHealthy ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-700">Healthy (200 OK)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-bold text-rose-600">Degraded</span>
                </>
              )}
            </div>
          </div>

          {(health?.timestamp || buildTime) && (
            <div className="text-right border-l border-border pl-4">
              <p className="text-xs text-ink-muted">Last Deployed</p>
              <p className="text-xs font-medium text-ink mt-0.5">
                {fmt(health?.timestamp || buildTime)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Deployment history table */}
      <div className="apple-card rounded-3xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Deployment History</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Git commit history and build provenance for this service.
            </p>
          </div>
          <span className="text-xs font-medium text-ink-muted bg-surface-muted px-3 py-1 rounded-full">
            Active Revision: {currentSha}
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-ink">Active GCP Cloud Run Revision</p>
            <p className="text-xs text-ink-muted mt-1 font-mono">Commit SHA: {currentSha}</p>
            {health?.activeCustomsProvider && (
              <p className="text-xs text-emerald-700 mt-2 bg-emerald-50 py-1.5 px-3 rounded-xl inline-block font-medium">
                Active Customs Engine: {health.activeCustomsProvider}
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-ink">
              <thead className="bg-surface-muted border-b border-border text-xs uppercase font-bold text-ink-muted">
                <tr>
                  <th className="px-5 py-3 whitespace-nowrap">Commit</th>
                  <th className="px-5 py-3 whitespace-nowrap">When</th>
                  <th className="px-5 py-3">Summary</th>
                  <th className="px-5 py-3 whitespace-nowrap">Author</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((e, i) => (
                  <tr
                    key={e.hash}
                    className={`align-top hover:bg-slate-50 transition-colors ${
                      i === 0 || e.hash.startsWith(currentSha) ? "bg-emerald-50/40" : ""
                    }`}
                  >
                    <td className="px-5 py-3 font-mono text-xs whitespace-nowrap text-ink-muted">
                      {i === 0 || e.hash.startsWith(currentSha) ? (
                        <span className="text-emerald-700 font-bold">{e.hash} ← current</span>
                      ) : (
                        e.hash
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-muted whitespace-nowrap">
                      {fmt(e.date)}
                    </td>
                    <td className="px-5 py-3 text-xs leading-snug">{e.summary}</td>
                    <td className="px-5 py-3 text-xs text-ink-muted whitespace-nowrap">
                      {e.author}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
