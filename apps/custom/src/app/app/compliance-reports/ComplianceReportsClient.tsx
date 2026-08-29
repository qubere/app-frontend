"use client";

import { useEffect, useMemo, useState } from "react";
import { FileBarChart2, Download, RefreshCw, Loader2, Play, Pause } from "lucide-react";
import { Card, CardHeader, CardHeaderIcon, Button, Badge, Input } from "@/components/ui";

interface ReportFilterDef {
  key: string;
  label: string;
  type: "dateRange" | "text" | "select" | "multiSelect" | "boolean";
  options?: string[];
}
interface ReportColumnDef {
  key: string;
  label: string;
}
interface ReportCatalogEntry {
  id: string;
  name: string;
  description: string;
  domain: string;
  formats: ("CSV" | "XLSX" | "PDF")[];
  filters: ReportFilterDef[];
  columns: ReportColumnDef[];
}
interface ReportRunArtifact {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: string | null;
}
interface ReportRun {
  id: string;
  reportType: string;
  format: string;
  generationStatus: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  deliveryStatus: string;
  requestedAt: string;
  rowCount: number | null;
  errorMessage: string | null;
  artifacts: ReportRunArtifact[];
}
interface ReportSchedule {
  id: string;
  frequency: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  format: string;
  reportDefinition: { id: string; name: string; reportType: string };
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  COMPLETED: "success",
  RUNNING: "warning",
  QUEUED: "neutral",
  FAILED: "danger",
  CANCELLED: "neutral",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

export function ComplianceReportsClient({ canGenerate, canManage }: { canGenerate: boolean; canManage: boolean }) {
  const [tab, setTab] = useState<"library" | "generated" | "schedules">("library");
  const [catalog, setCatalog] = useState<ReportCatalogEntry[]>([]);
  const [selected, setSelected] = useState<ReportCatalogEntry | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [format, setFormat] = useState<string>("CSV");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);

  useEffect(() => {
    fetchJson<{ reports: ReportCatalogEntry[] }>("/api/compliance/reports/catalog")
      .then((data) => setCatalog(data.reports))
      .catch((err) => setError(err.message));
  }, []);

  const loadRuns = () => {
    fetchJson<{ runs: ReportRun[] }>("/api/compliance/reports/runs")
      .then((data) => setRuns(data.runs))
      .catch((err) => setError(err.message));
  };
  const loadSchedules = () => {
    fetchJson<{ schedules: ReportSchedule[] }>("/api/compliance/reports/schedules")
      .then((data) => setSchedules(data.schedules))
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    if (tab === "generated") loadRuns();
    if (tab === "schedules") loadSchedules();
  }, [tab]);

  useEffect(() => {
    if (tab !== "generated") return;
    const hasInFlight = runs.some((r) => r.generationStatus === "QUEUED" || r.generationStatus === "RUNNING");
    if (!hasInFlight) return;
    const interval = setInterval(loadRuns, 4000);
    return () => clearInterval(interval);
  }, [tab, runs]);

  const grouped = useMemo(() => {
    const byDomain = new Map<string, ReportCatalogEntry[]>();
    for (const entry of catalog) {
      const list = byDomain.get(entry.domain) ?? [];
      list.push(entry);
      byDomain.set(entry.domain, list);
    }
    return Array.from(byDomain.entries());
  }, [catalog]);

  const openReport = (entry: ReportCatalogEntry) => {
    setSelected(entry);
    setFilters({});
    setFormat(entry.formats[0] ?? "CSV");
    setError(null);
  };

  const runReport = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ""));
      await fetchJson<{ run: ReportRun }>("/api/compliance/reports/run", {
        method: "POST",
        body: JSON.stringify({ reportType: selected.id, format, filters: cleanFilters }),
      });
      setTab("generated");
      loadRuns();
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run report.");
    } finally {
      setBusy(false);
    }
  };

  const downloadArtifact = async (runId: string, artifactId: string) => {
    try {
      const { downloadUrl } = await fetchJson<{ downloadUrl: string }>(
        `/api/compliance/reports/runs/${runId}/artifacts/${artifactId}/download`
      );
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download report.");
    }
  };

  const toggleSchedule = async (schedule: ReportSchedule) => {
    try {
      await fetchJson(`/api/compliance/reports/schedules/${schedule.id}/${schedule.isActive ? "pause" : "resume"}`, {
        method: "POST",
      });
      loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update schedule.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardHeaderIcon>
            <FileBarChart2 className="w-5 h-5" />
          </CardHeaderIcon>
          <div>
            <h1 className="text-lg font-bold text-ink">Compliance Reports</h1>
            <p className="text-sm text-ink-muted">
              Generate, download and schedule audit-ready compliance and screening reports.
            </p>
          </div>
        </CardHeader>

        <div className="flex gap-2 mb-6">
          {(["library", "generated", "schedules"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                tab === t ? "bg-brand text-white" : "bg-surface-muted text-ink-muted hover:bg-border"
              }`}
            >
              {t === "library" ? "Report Library" : t === "generated" ? "Generated Reports" : "Schedules"}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {tab === "library" && (
          <div className="space-y-6">
            {grouped.map(([domain, entries]) => (
              <div key={domain}>
                <h2 className="text-xs font-bold uppercase tracking-wide text-ink-muted mb-3">
                  {domain.replaceAll("_", " ")}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {entries.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => openReport(entry)}
                      className="text-left rounded-xl border border-border p-4 hover:border-brand hover:shadow-xs transition-all"
                    >
                      <div className="font-semibold text-sm text-ink">{entry.name}</div>
                      <div className="text-xs text-ink-muted mt-1 line-clamp-2">{entry.description}</div>
                      <div className="flex gap-1 mt-3">
                        {entry.formats.map((f) => (
                          <Badge key={f} variant="neutral">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "generated" && (
          <div>
            <div className="flex justify-end mb-3">
              <Button variant="secondary" size="sm" onClick={loadRuns}>
                <RefreshCw className="w-4 h-4" /> Refresh
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-ink-muted border-b border-border">
                    <th className="py-2 pr-4">Report</th>
                    <th className="py-2 pr-4">Requested</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Rows</th>
                    <th className="py-2 pr-4">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-border/60">
                      <td className="py-2 pr-4">
                        {run.reportType} <span className="text-ink-muted">({run.format})</span>
                      </td>
                      <td className="py-2 pr-4">{new Date(run.requestedAt).toLocaleString()}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={STATUS_TONE[run.generationStatus] ?? "neutral"}>{run.generationStatus}</Badge>
                        {run.deliveryStatus && run.deliveryStatus !== "NOT_REQUESTED" && (
                          <Badge variant={run.deliveryStatus === "DELIVERED" ? "success" : run.deliveryStatus === "FAILED" ? "danger" : "warning"} className="ml-1">
                            Email: {run.deliveryStatus}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4">{run.rowCount ?? "-"}</td>
                      <td className="py-2 pr-4">
                        {run.artifacts.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => downloadArtifact(run.id, a.id)}
                            className="inline-flex items-center gap-1 text-brand hover:underline"
                          >
                            <Download className="w-3.5 h-3.5" /> {a.fileName}
                          </button>
                        ))}
                      </td>
                    </tr>
                  ))}
                  {runs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-ink-muted">
                        No reports generated yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "schedules" && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-ink-muted border-b border-border">
                    <th className="py-2 pr-4">Saved Report</th>
                    <th className="py-2 pr-4">Frequency</th>
                    <th className="py-2 pr-4">Next Run</th>
                    <th className="py-2 pr-4">Status</th>
                    {canManage && <th className="py-2 pr-4">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s) => (
                    <tr key={s.id} className="border-b border-border/60">
                      <td className="py-2 pr-4">{s.reportDefinition?.name}</td>
                      <td className="py-2 pr-4">{s.frequency}</td>
                      <td className="py-2 pr-4">{s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : "-"}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={s.isActive ? "success" : "neutral"}>{s.isActive ? "Active" : "Paused"}</Badge>
                      </td>
                      {canManage && (
                        <td className="py-2 pr-4">
                          <Button variant="secondary" size="sm" onClick={() => toggleSchedule(s)}>
                            {s.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {schedules.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-ink-muted">
                        No scheduled reports. Save a report from the library and configure a schedule.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div>
                <h2 className="text-base font-bold text-ink">{selected.name}</h2>
                <p className="text-xs text-ink-muted">{selected.description}</p>
              </div>
            </CardHeader>

            <div className="space-y-3">
              {selected.filters.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">{f.label}</label>
                  {f.type === "select" && f.options ? (
                    <select
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                      value={filters[f.key] ?? ""}
                      onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    >
                      <option value="">Any</option>
                      {f.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={f.type === "dateRange" ? "date" : "text"}
                      value={filters[f.key] ?? ""}
                      onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">Format</label>
                <select
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  {selected.formats.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              {canGenerate && (
                <Button onClick={runReport} disabled={busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Generate
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
