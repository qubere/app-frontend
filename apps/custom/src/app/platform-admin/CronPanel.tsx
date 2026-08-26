"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Activity,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

export interface CronJob {
  id: string;
  name: string;
  endpoint: string;
  method: "GET" | "POST";
  schedule: string;
  description: string;
  lastRun: string | null;
  status: "idle" | "running" | "success" | "error";
  details?: string | null;
}

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "Never";
  try {
    return new Date(isoString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export interface CronPanelProps {
  initialJobs?: CronJob[];
}

export function CronPanel({ initialJobs }: CronPanelProps = {}) {
  const hasInitial = Boolean(initialJobs && initialJobs.length > 0);
  const [jobs, setJobs] = useState<CronJob[]>(() => initialJobs || []);
  const [loading, setLoading] = useState(!hasInitial);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<"ALL" | "GET" | "POST">("ALL");
  const [runningIds, setRunningIds] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const fetchCronJobs = async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/platform-admin/cron");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error?.message || data?.error || `HTTP ${res.status}`;
        setLoadError(`Failed to load cron status: ${msg}`);
      }
    } catch (err: any) {
      setLoadError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasInitial) {
      fetchCronJobs();
    }
  }, [hasInitial]);

  const runJobManually = async (jobId: string, jobName: string) => {
    setRunningIds((prev) => ({ ...prev, [jobId]: true }));
    setStatusMessage(null);

    // Set temporary running status in local UI state
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: "running" } : j))
    );

    try {
      const res = await fetch(`/api/platform-admin/cron/${jobId}/run`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: `"${jobName}" executed successfully. Result: ${JSON.stringify(data).slice(0, 300)}`,
        });
        // Re-fetch real state from backend
        await fetchCronJobs();
      } else {
        const errText = data.error?.message || data.error || data.message || "Execution failed";
        throw new Error(errText);
      }
    } catch (err: any) {
      const errMsg = err.message || "Failed to trigger execution";
      setStatusMessage({
        type: "error",
        text: `Error executing "${jobName}": ${errMsg}`,
      });
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: "error",
                details: errMsg,
              }
            : j
        )
      );
    } finally {
      setRunningIds((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const successCount = jobs.filter((j) => j.status === "success").length;
  const errorCount = jobs.filter((j) => j.status === "error").length;
  const runningCount = jobs.filter((j) => j.status === "running").length;

  const filteredJobs = jobs.filter((j) => {
    const matchesMethod = methodFilter === "ALL" || j.method === methodFilter;
    const matchesSearch =
      j.name.toLowerCase().includes(search.toLowerCase()) ||
      j.description.toLowerCase().includes(search.toLowerCase()) ||
      j.endpoint.toLowerCase().includes(search.toLowerCase());
    return matchesMethod && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="apple-card p-5 rounded-3xl border border-border bg-white shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-ink-muted font-medium">System Cron Jobs</p>
            <p className="text-2xl font-black text-ink tracking-tight">{jobs.length}</p>
            <p className="text-[11px] text-ink-muted mt-0.5">Background workers</p>
          </div>
        </div>

        <div className="apple-card p-5 rounded-3xl border border-border bg-white shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-ink-muted font-medium">Successful Runs</p>
            <p className="text-2xl font-black text-emerald-700 tracking-tight">{successCount}</p>
            <p className="text-[11px] text-emerald-600 font-bold mt-0.5">Verified clean</p>
          </div>
        </div>

        <div className="apple-card p-5 rounded-3xl border border-border bg-white shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-red-50 text-red-600 border border-red-100">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-ink-muted font-medium">Recent Errors</p>
            <p className="text-2xl font-black text-red-700 tracking-tight">{errorCount}</p>
            <p className="text-[11px] text-red-600 font-bold mt-0.5">
              {errorCount === 0 ? "No failing jobs" : "Requires attention"}
            </p>
          </div>
        </div>

        <div className="apple-card p-5 rounded-3xl border border-border bg-white shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-ink-muted font-medium">Active Workers</p>
            <p className="text-2xl font-black text-ink tracking-tight">{runningCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {runningCount > 0 ? "Executing now" : "All workers idle"}
            </p>
          </div>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold border flex items-start space-x-3 transition-all ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : statusMessage.type === "info"
              ? "bg-blue-50 border-blue-200 text-blue-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : statusMessage.type === "info" ? (
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Notice box */}
      <div className="flex items-start space-x-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <span>
          <strong>Cron Scope Note:</strong> System cron jobs handle background workers, deadline sweeps, outbox events, and metric snapshots. Government dataset ingestion pipelines (HTS, OFAC, BIS, UFLPA) are managed separately under the <strong>Data</strong> tab.
        </span>
      </div>

      {/* Main Table Card */}
      <div className="apple-card rounded-3xl border border-border bg-white shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-ink flex items-center space-x-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <span>Cron Jobs & Background Worker Pipeline</span>
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              Trigger, monitor, and audit system automation tasks, compliance deadline sweeps, and document parsers.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={fetchCronJobs}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh job status from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-600" : ""}`} />
              <span>Refresh</span>
            </button>

            <div className="flex items-center bg-slate-100 p-1 rounded-full text-xs font-bold">
              <button
                onClick={() => setMethodFilter("ALL")}
                className={`px-3 py-1.5 rounded-full transition-all ${
                  methodFilter === "ALL" ? "bg-white text-ink shadow-xs" : "text-ink-muted hover:text-ink"
                }`}
              >
                All ({jobs.length})
              </button>
              <button
                onClick={() => setMethodFilter("GET")}
                className={`px-3 py-1.5 rounded-full transition-all ${
                  methodFilter === "GET"
                    ? "bg-white text-purple-700 shadow-xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                GET ({jobs.filter((j) => j.method === "GET").length})
              </button>
              <button
                onClick={() => setMethodFilter("POST")}
                className={`px-3 py-1.5 rounded-full transition-all ${
                  methodFilter === "POST"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                POST ({jobs.filter((j) => j.method === "POST").length})
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cron jobs..."
                className="pl-9 pr-4 py-1.5 text-xs rounded-full w-full sm:w-60 focus:ring-0"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-ink-muted flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
            <span>Loading system cron pipeline status...</span>
          </div>
        ) : loadError ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm font-semibold text-red-700">{loadError}</p>
            <button
              onClick={fetchCronJobs}
              className="text-xs text-brand underline hover:no-underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Clock className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm text-ink-muted">No cron jobs match your search or filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-muted border-b border-border text-[11px] uppercase font-bold text-ink-muted">
                <tr>
                  <th className="py-3.5 px-4 min-w-[220px]">Job Name & Details</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Method</th>
                  <th className="py-3.5 px-4 min-w-[180px]">Schedule</th>
                  <th className="py-3.5 px-4 min-w-[200px]">Last Run Status / Timestamp</th>
                  <th className="py-3.5 px-4 text-right min-w-[140px] sticky right-0 bg-surface-muted shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.15)]">
                    Run Manually
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map((job) => {
                  const isRunning = runningIds[job.id] || job.status === "running";

                  return (
                    <tr key={job.id} className="hover:bg-slate-50/60 transition-colors align-top">
                      {/* Name & Endpoint */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-ink text-sm">{job.name}</div>
                        <p className="text-[11px] text-ink-muted mt-0.5 leading-snug">{job.description}</p>
                        <div className="font-mono text-[10px] text-amber-700 bg-amber-50/60 border border-amber-200/60 px-2 py-0.5 rounded-md inline-block mt-2">
                          {job.endpoint}
                        </div>
                      </td>

                      {/* Method */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <Badge
                          className={`text-[10px] font-mono normal-case py-0.5 px-2 ${
                            job.method === "POST"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-purple-50 text-purple-700 border-purple-200"
                          }`}
                        >
                          {job.method}
                        </Badge>
                      </td>

                      {/* Schedule */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{job.schedule}</span>
                        </div>
                      </td>

                      {/* Last Run & Status */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="font-mono text-slate-700 font-semibold text-[11px]">
                            {formatDate(job.lastRun)}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {job.status === "running" && (
                              <span className="inline-flex items-center text-[10px] font-bold text-blue-600 gap-1 animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Running...
                              </span>
                            )}
                            {job.status === "success" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Success
                              </span>
                            )}
                            {job.status === "error" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                <AlertCircle className="w-3 h-3 text-red-600" /> Failed
                              </span>
                            )}
                            {job.status === "idle" && (
                              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                Not executed yet
                              </span>
                            )}
                          </div>
                          {job.details && (
                            <p
                              className="text-[10px] text-slate-400 max-w-xs truncate font-mono mt-1"
                              title={job.details}
                            >
                              {job.details}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-right sticky right-0 bg-white shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.15)]">
                        <button
                          onClick={() => runJobManually(job.id, job.name)}
                          disabled={isRunning}
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 ml-auto disabled:opacity-50 transition-all shadow-xs cursor-pointer"
                          title={`Trigger manual run for ${job.name}`}
                        >
                          {isRunning ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Running...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-2.5 h-2.5 fill-white" />
                              <span>Run Manually</span>
                            </>
                          )}
                        </button>
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
