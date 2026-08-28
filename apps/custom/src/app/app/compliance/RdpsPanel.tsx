"use client";

// Continuous Party Monitoring (RDPS) -- consumes the read-only reporting/query
// endpoints under /api/compliance/rdps* built in Sections 1-7. This panel
// never duplicates screening/matching logic; it only lists, triggers scans,
// and dispositions the worsening-outcome alerts that already exist server
// side, mirroring the CommunityScreeningPanel convention for this workspace.
import { useCallback, useEffect, useState } from "react";
import { Radar, RefreshCw, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { displayDate } from "@/lib/honest";
import {
  EXCEPTION_STATES,
  exceptionStatusLabel,
  isRiskAcceptance,
  isTerminalExceptionState,
  normalizeExceptionStatus,
  requiresResolutionReason,
} from "@/modules/exceptions/exceptionState";

const PAGE_SIZE = 25;

type SubTab = "overview" | "alerts" | "population" | "runs" | "reference-changes" | "reference-data-health" | "reports";

interface RdpsRunSummary {
  id: string;
  runType: string;
  status: string;
  triggeredBy: string;
  candidatePartyCount: number;
  screenedCount: number;
  worsenedCount: number;
  erroredCount: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface RdpsExceptionItem {
  id: string;
  status: string;
  severity: string;
  version: number;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

interface RdpsAlert {
  id: string;
  runId: string;
  partyId: string;
  partyDisplayName: string;
  previousStatus: string | null;
  newStatus: string;
  isWorsening: boolean;
  createdAt: string;
  run: { id: string; runType: string; startedAt: string } | null;
  exceptionItem: RdpsExceptionItem | null;
}

interface RdpsOutcome {
  id: string;
  partyId: string;
  partyDisplayName: string;
  previousStatus: string | null;
  newStatus: string;
  isWorsening: boolean;
  createdAt: string;
  errorMessage: string | null;
}

interface RdpsPopulationRow {
  id: string;
  displayName: string;
  updatedAt: string;
  rdpsOutcomes: { id: string; newStatus: string; isWorsening: boolean; createdAt: string; runId: string }[];
}

interface RdpsReferenceChange {
  id: string;
  changeType: string;
  occurredAt: string;
  datasetId: string;
  sourceList: string;
  screeningEntity: { id: string; name: string; sourceList: string } | null;
}

interface RdpsImpactedParty {
  id: string;
  partyId: string;
  partyDisplayName: string;
  previousStatus: string | null;
  newStatus: string;
  transitionType: string | null;
  createdAt: string;
  run: { id: string; runType: string; startedAt: string } | null;
}

interface RdpsPreviewImpactCandidate {
  partyId: string;
  accountId: string;
  partyDisplayName: string;
  reasons: string[];
  currentStatus: string | null;
  lastScreenedAt: string | null;
}

interface RdpsReferenceDataHealthRow {
  datasetId: string;
  label: string;
  provider: string | null;
  importStatus: string | null;
  lastImportStartedAt: string | null;
  lastImportCompletedAt: string | null;
  lastImportErrorMessage: string | null;
  lastSuccessfulImportAt: string | null;
  publishedVersion: string | null;
  recordCount: number | null;
  sourceReportedTotal: number | null;
  added: number;
  updated: number;
  removed: number;
}

interface RdpsReportsSummary {
  totalMonitoredParties: number;
  openAlerts: number;
  worseningLast30Days: number;
  screenedLast30Days: number;
  lastDeltaImpactRun: { id: string; status: string; completedAt: string | null } | null;
  lastFullPopulationRun: { id: string; status: string; completedAt: string | null } | null;
  lastRecallValidation: { id: string; status: string; completedAt: string | null } | null;
}

function runStatusBadgeVariant(status: string): BadgeProps["variant"] {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED") return "danger";
  if (status === "PARTIAL") return "warning";
  return "neutral";
}

function statusTone(status: string | null): "healthy" | "amber" | "red" | "neutral" {
  if (!status) return "neutral";
  if (status === "COMPLETED") return "healthy";
  if (status === "PARTIAL") return "amber";
  if (status === "FAILED") return "red";
  return "neutral";
}

interface RdpsPanelProps {
  mayManageRdps: boolean;
}

export function RdpsPanel({ mayManageRdps }: RdpsPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>("overview");

  const subTabs: { id: SubTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "alerts", label: "Alerts" },
    { id: "population", label: "Population" },
    { id: "runs", label: "Runs" },
    { id: "reference-changes", label: "Reference Changes" },
    { id: "reference-data-health", label: "Reference Data Health" },
    { id: "reports", label: "Reports" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {subTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              subTab === t.id ? "bg-ink text-white" : "bg-slate-50 text-ink-muted hover:text-ink border border-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "overview" && <OverviewSubTab />}
      {subTab === "alerts" && <AlertsSubTab mayManageRdps={mayManageRdps} />}
      {subTab === "population" && <PopulationSubTab />}
      {subTab === "runs" && <RunsSubTab mayManageRdps={mayManageRdps} />}
      {subTab === "reference-changes" && <ReferenceChangesSubTab />}
      {subTab === "reference-data-health" && <ReferenceDataHealthSubTab />}
      {subTab === "reports" && <ReportsSubTab />}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="text-2xl font-extrabold text-ink mt-1">{value}</p>
    </div>
  );
}

function RunStatusTile({ label, run }: { label: string; run: { id: string; status: string; completedAt: string | null } | null }) {
  const tone = statusTone(run?.status ?? null);
  const toneClass =
    tone === "healthy"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : tone === "red"
          ? "border-red-200 bg-red-50"
          : "border-border bg-white";
  const Icon = tone === "healthy" ? CheckCircle2 : tone === "red" || tone === "amber" ? AlertTriangle : Radar;
  const iconClass = tone === "healthy" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : tone === "red" ? "text-red-600" : "text-ink-muted";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconClass}`} />
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      </div>
      <p className="text-sm font-bold text-ink mt-1">{run ? run.status : "No runs yet"}</p>
      <p className="text-xs text-ink-muted mt-0.5">{run?.completedAt ? displayDate(run.completedAt) : "—"}</p>
    </div>
  );
}

function useReportsSummary() {
  const [summary, setSummary] = useState<RdpsReportsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compliance/rdps/reports/summary");
      if (!res.ok) throw new Error("failed");
      const body = await res.json();
      setSummary(body.summary ?? null);
    } catch {
      setError("The reports summary could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { summary, loading, error, reload: load };
}

function OverviewSubTab() {
  const { summary, loading, error } = useReportsSummary();

  if (loading && !summary) return <p className="text-xs text-ink-muted py-6 text-center">Loading…</p>;
  if (error) return <p role="alert" className="text-xs text-red-700 py-6 text-center">{error}</p>;
  if (!summary) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Monitored Parties" value={summary.totalMonitoredParties} />
        <StatTile label="Open Alerts" value={summary.openAlerts} />
        <StatTile label="Worsening (30d)" value={summary.worseningLast30Days} />
        <StatTile label="Screened (30d)" value={summary.screenedLast30Days} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <RunStatusTile label="Last Delta Impact Run" run={summary.lastDeltaImpactRun} />
        <RunStatusTile label="Last Full Population Run" run={summary.lastFullPopulationRun} />
        <RunStatusTile label="Last Recall Validation" run={summary.lastRecallValidation} />
      </div>
    </div>
  );
}

function ReportsSubTab() {
  const { summary, loading, error, reload } = useReportsSummary();

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider">RDPS Reporting Summary</h3>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={reload}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <a href="/api/compliance/rdps/reports/export" className="inline-flex">
            <Button type="button" variant="secondary" size="sm">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </a>
        </div>
      </div>

      {loading && !summary ? (
        <p className="text-xs text-ink-muted py-6 text-center">Loading…</p>
      ) : error ? (
        <p role="alert" className="text-xs text-red-700 py-6 text-center">{error}</p>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Monitored Parties" value={summary.totalMonitoredParties} />
          <StatTile label="Open Alerts" value={summary.openAlerts} />
          <StatTile label="Worsening (30d)" value={summary.worseningLast30Days} />
          <StatTile label="Screened (30d)" value={summary.screenedLast30Days} />
        </div>
      ) : null}
    </Card>
  );
}

function AlertsSubTab({ mayManageRdps }: { mayManageRdps: boolean }) {
  const [dispositioned, setDispositioned] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [alerts, setAlerts] = useState<RdpsAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<RdpsAlert | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (dispositioned) params.set("dispositioned", dispositioned);
      const res = await fetch(`/api/compliance/rdps/alerts?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const body = await res.json();
      setAlerts(body.alerts ?? []);
      setTotal(body.total ?? 0);
    } catch {
      setError("Alerts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [page, dispositioned]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function isUndispositioned(alert: RdpsAlert): boolean {
    if (!alert.exceptionItem) return false;
    const state = normalizeExceptionStatus(alert.exceptionItem.status);
    return !state || !isTerminalExceptionState(state);
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          aria-label="Filter by disposition"
          value={dispositioned}
          onChange={(e) => {
            setPage(1);
            setDispositioned(e.target.value as "" | "true" | "false");
          }}
          className="w-auto"
        >
          <option value="">All alerts</option>
          <option value="false">Not dispositioned</option>
          <option value="true">Dispositioned</option>
        </Select>
      </div>

      {loading ? (
        <p className="text-xs text-ink-muted py-6 text-center">Loading…</p>
      ) : error ? (
        <p role="alert" className="text-xs text-red-700 py-6 text-center">{error}</p>
      ) : alerts.length === 0 ? (
        <p className="text-xs text-ink-muted py-6 text-center">No RDPS alerts found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-ink-muted border-b border-border">
                <th className="py-2 pr-3">Party</th>
                <th className="py-2 pr-3">Status Change</th>
                <th className="py-2 pr-3">Run Type</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">Disposition</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => {
                const undispositioned = isUndispositioned(alert);
                return (
                  <tr key={alert.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3 font-semibold text-ink">{alert.partyDisplayName || "Unnamed party"}</td>
                    <td className="py-2 pr-3 text-ink-muted">
                      {alert.previousStatus ?? "—"} <span className="text-ink">→</span> {alert.newStatus}
                    </td>
                    <td className="py-2 pr-3 text-ink-muted">{alert.run?.runType ?? "—"}</td>
                    <td className="py-2 pr-3 text-ink-muted">{displayDate(alert.createdAt)}</td>
                    <td className="py-2 pr-3">
                      {alert.exceptionItem ? (
                        <Badge variant={undispositioned ? "warning" : "success"}>
                          {exceptionStatusLabel(alert.exceptionItem.status)}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">No exception</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {mayManageRdps && undispositioned && (
                        <Button type="button" size="sm" variant="secondary" onClick={() => setSelectedAlert(alert)}>
                          Disposition
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-ink-muted">
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      {selectedAlert && (
        <AlertDispositionModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onDone={() => {
            setSelectedAlert(null);
            load();
          }}
        />
      )}
    </Card>
  );
}

function AlertDispositionModal({
  alert,
  onClose,
  onDone,
}: {
  alert: RdpsAlert;
  onClose: () => void;
  onDone: () => void;
}) {
  const [status, setStatus] = useState(() => normalizeExceptionStatus(alert.exceptionItem?.status) ?? "RESOLVED");
  const [resolutionReason, setResolutionReason] = useState("");
  const [resolutionReasonCode, setResolutionReasonCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsReason = requiresResolutionReason(status);
  const waiveRisk = isRiskAcceptance(status);

  async function submit() {
    if (needsReason && resolutionReason.trim() === "") {
      setError(`A stated reason is required to move this alert to ${exceptionStatusLabel(status)}.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const expectedVersion = alert.exceptionItem?.version ?? 0;
      const res = await fetch(`/api/compliance/rdps/alerts/${alert.id}/disposition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          resolutionReason: resolutionReason.trim() || undefined,
          resolutionReasonCode: resolutionReasonCode.trim() || undefined,
          expectedVersion,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          res.status === 409
            ? "Someone else changed this alert while you were working. Reload to see the current state."
            : body?.error?.message || body?.error || "The update failed."
        );
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} closeDisabled={submitting}>
      <ModalHeader
        title="Disposition RDPS Alert"
        subtitle={alert.partyDisplayName || "Unnamed party"}
        onClose={onClose}
        closeDisabled={submitting}
      />
      <ModalBody className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink" htmlFor="rdps-disposition-status">
            Status
          </label>
          <Select
            id="rdps-disposition-status"
            value={status}
            onChange={(e) => setStatus(normalizeExceptionStatus(e.target.value) ?? status)}
          >
            {EXCEPTION_STATES.map((s) => (
              <option key={s} value={s}>
                {exceptionStatusLabel(s)}
              </option>
            ))}
          </Select>
        </div>

        {waiveRisk && (
          <p role="status" className="text-xs text-amber-800">
            Waiving accepts the risk this alert describes.
          </p>
        )}

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink" htmlFor="rdps-disposition-reason-code">
            Resolution reason code
          </label>
          <Input
            id="rdps-disposition-reason-code"
            value={resolutionReasonCode}
            onChange={(e) => setResolutionReasonCode(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink" htmlFor="rdps-disposition-reason">
            Resolution reason {needsReason && <span className="text-red-600">*</span>}
          </label>
          <textarea
            id="rdps-disposition-reason"
            value={resolutionReason}
            onChange={(e) => setResolutionReason(e.target.value)}
            rows={3}
            className="w-full px-3.5 py-2.5 bg-surface-muted border border-border rounded-xl text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        {error && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-900">
            {error}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} loading={submitting}>
          Save disposition
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function PopulationSubTab() {
  const [page, setPage] = useState(1);
  const [parties, setParties] = useState<RdpsPopulationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const res = await fetch(`/api/compliance/rdps/population?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const body = await res.json();
      setParties(body.parties ?? []);
      setTotal(body.total ?? 0);
    } catch {
      setError("Population could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card className="space-y-3">
      {loading ? (
        <p className="text-xs text-ink-muted py-6 text-center">Loading…</p>
      ) : error ? (
        <p role="alert" className="text-xs text-red-700 py-6 text-center">{error}</p>
      ) : parties.length === 0 ? (
        <p className="text-xs text-ink-muted py-6 text-center">No parties in the monitoring population.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-ink-muted border-b border-border">
                <th className="py-2 pr-3">Party</th>
                <th className="py-2 pr-3">Current Status</th>
                <th className="py-2 pr-3">Last Outcome Date</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => {
                const latest = p.rdpsOutcomes[0] ?? null;
                return (
                  <tr key={p.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3 font-semibold text-ink">{p.displayName || "Unnamed party"}</td>
                    <td className="py-2 pr-3">
                      {latest ? (
                        <Badge variant={latest.isWorsening ? "warning" : "success"}>{latest.newStatus}</Badge>
                      ) : (
                        <Badge variant="neutral">Not yet screened</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-ink-muted">{latest ? displayDate(latest.createdAt) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-ink-muted">
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}

function RunsSubTab({ mayManageRdps }: { mayManageRdps: boolean }) {
  const [runType, setRunType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [runs, setRuns] = useState<RdpsRunSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (runType) params.set("runType", runType);
      if (status) params.set("status", status);
      const res = await fetch(`/api/compliance/rdps/runs?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const body = await res.json();
      setRuns(body.runs ?? []);
      setTotal(body.total ?? 0);
    } catch {
      setError("Runs could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [page, runType, status]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {mayManageRdps && <TriggerScanCard onTriggered={load} />}

      <Card className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            aria-label="Filter by run type"
            value={runType}
            onChange={(e) => {
              setPage(1);
              setRunType(e.target.value);
            }}
            className="w-auto"
          >
            <option value="">All run types</option>
            {["DELTA_IMPACT", "FULL_POPULATION", "TARGETED", "SCHEDULED"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="w-auto"
          >
            <option value="">All statuses</option>
            {["QUEUED", "RUNNING", "COMPLETED", "PARTIAL", "FAILED"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <p className="text-xs text-ink-muted py-6 text-center">Loading…</p>
        ) : error ? (
          <p role="alert" className="text-xs text-red-700 py-6 text-center">{error}</p>
        ) : runs.length === 0 ? (
          <p className="text-xs text-ink-muted py-6 text-center">No RDPS runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-ink-muted border-b border-border">
                  <th className="py-2 pr-3">Started</th>
                  <th className="py-2 pr-3">Run Type</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Screened</th>
                  <th className="py-2 pr-3">Worsened</th>
                  <th className="py-2 pr-3">Errored</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <>
                    <tr key={run.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-3 text-ink-muted">{displayDate(run.startedAt)}</td>
                      <td className="py-2 pr-3 text-ink">{run.runType}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={runStatusBadgeVariant(run.status)}>{run.status}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-ink-muted">{run.screenedCount}</td>
                      <td className="py-2 pr-3 text-amber-700">{run.worsenedCount}</td>
                      <td className="py-2 pr-3 text-red-700">{run.erroredCount}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                          >
                            {expandedRunId === run.id ? "Hide outcomes" : "View outcomes"}
                          </Button>
                          <a href={`/api/compliance/rdps/runs/${run.id}/export`} className="inline-flex">
                            <Button type="button" size="sm" variant="secondary">
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                        </div>
                      </td>
                    </tr>
                    {expandedRunId === run.id && (
                      <tr key={`${run.id}-outcomes`}>
                        <td colSpan={7} className="py-3 bg-surface-muted/50">
                          <RunOutcomes runId={run.id} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-ink-muted">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function RunOutcomes({ runId }: { runId: string }) {
  const [outcomes, setOutcomes] = useState<RdpsOutcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/compliance/rdps/runs/${runId}/outcomes?pageSize=50`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((body) => {
        if (!cancelled) setOutcomes(body.outcomes ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Outcomes could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (loading) return <p className="text-xs text-ink-muted px-3">Loading outcomes…</p>;
  if (error) return <p role="alert" className="text-xs text-red-700 px-3">{error}</p>;
  if (outcomes.length === 0) return <p className="text-xs text-ink-muted px-3">No outcomes recorded for this run.</p>;

  return (
    <div className="overflow-x-auto px-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase text-ink-muted border-b border-border">
            <th className="py-1.5 pr-3">Party</th>
            <th className="py-1.5 pr-3">Status Change</th>
            <th className="py-1.5 pr-3">Worsening</th>
            <th className="py-1.5 pr-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {outcomes.map((o) => (
            <tr key={o.id} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 pr-3 font-semibold text-ink">{o.partyDisplayName || "Unnamed party"}</td>
              <td className="py-1.5 pr-3 text-ink-muted">
                {o.previousStatus ?? "—"} <span className="text-ink">→</span> {o.newStatus}
              </td>
              <td className="py-1.5 pr-3">
                {o.isWorsening ? <Badge variant="warning">Worsening</Badge> : <Badge variant="neutral">No change</Badge>}
              </td>
              <td className="py-1.5 pr-3 text-ink-muted">{displayDate(o.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TriggerScanCard({ onTriggered }: { onTriggered: () => void }) {
  const [jobType, setJobType] = useState<"DELTA_IMPACT" | "FULL_POPULATION" | "TARGETED">("DELTA_IMPACT");
  const [partyIdsText, setPartyIdsText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const partyIds =
        jobType === "TARGETED"
          ? partyIdsText
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean)
          : undefined;

      if (jobType === "TARGETED" && (!partyIds || partyIds.length === 0)) {
        setError("Enter at least one party ID for a targeted scan.");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/compliance/rdps/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType, partyIds }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message || body?.error || "The scan could not be triggered.");
      }
      setMessage(body.run ? `Run ${body.run.id} — ${body.run.status}.` : "The scan was triggered.");
      setPartyIdsText("");
      onTriggered();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-3">
      <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider">Trigger Scan</h3>
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          aria-label="Scan type"
          value={jobType}
          onChange={(e) => setJobType(e.target.value as "DELTA_IMPACT" | "FULL_POPULATION" | "TARGETED")}
          className="w-auto"
        >
          <option value="DELTA_IMPACT">Delta Impact</option>
          <option value="FULL_POPULATION">Full Population</option>
          <option value="TARGETED">Targeted</option>
        </Select>
        {jobType === "TARGETED" && (
          <Input
            aria-label="Party IDs (comma separated)"
            placeholder="Party IDs, comma separated"
            value={partyIdsText}
            onChange={(e) => setPartyIdsText(e.target.value)}
            className="w-64"
          />
        )}
        <Button type="button" onClick={submit} loading={submitting}>
          {submitting ? "Triggering…" : "Trigger Scan"}
        </Button>
      </div>
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-900">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
          {message}
        </div>
      )}
    </Card>
  );
}

function ReferenceChangesSubTab() {
  const [page, setPage] = useState(1);
  const [changes, setChanges] = useState<RdpsReferenceChange[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedChangeId, setExpandedChangeId] = useState<string | null>(null);
  const [previewChange, setPreviewChange] = useState<RdpsReferenceChange | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const res = await fetch(`/api/compliance/rdps/reference-changes?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const body = await res.json();
      setChanges(body.changes ?? []);
      setTotal(body.total ?? 0);
    } catch {
      setError("Reference changes could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card className="space-y-3">
      {loading ? (
        <p className="text-xs text-ink-muted py-6 text-center">Loading…</p>
      ) : error ? (
        <p role="alert" className="text-xs text-red-700 py-6 text-center">{error}</p>
      ) : changes.length === 0 ? (
        <p className="text-xs text-ink-muted py-6 text-center">No reference data changes recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-ink-muted border-b border-border">
                <th className="py-2 pr-3">Dataset / Entity</th>
                <th className="py-2 pr-3">Change Type</th>
                <th className="py-2 pr-3">Occurred</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <>
                  <tr key={c.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3 font-semibold text-ink">
                      {c.screeningEntity?.name ?? c.datasetId}
                      <span className="block text-[10px] text-ink-muted font-mono">{c.screeningEntity?.sourceList ?? c.sourceList}</span>
                    </td>
                    <td className="py-2 pr-3 text-ink-muted">{c.changeType}</td>
                    <td className="py-2 pr-3 text-ink-muted">{displayDate(c.occurredAt)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={() => setPreviewChange(c)}>
                          Preview Impact
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setExpandedChangeId(expandedChangeId === c.id ? null : c.id)}
                        >
                          {expandedChangeId === c.id ? "Hide impacted parties" : "Impacted parties"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expandedChangeId === c.id && (
                    <tr key={`${c.id}-impacts`}>
                      <td colSpan={4} className="py-3 bg-surface-muted/50">
                        <ImpactedParties changeSetId={c.id} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-ink-muted">
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      {previewChange && <PreviewImpactModal change={previewChange} onClose={() => setPreviewChange(null)} />}
    </Card>
  );
}

function ImpactedParties({ changeSetId }: { changeSetId: string }) {
  const [impacts, setImpacts] = useState<RdpsImpactedParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/compliance/rdps/reference-changes/${changeSetId}/impacts?pageSize=50`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((body) => {
        if (!cancelled) setImpacts(body.impacts ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Impacted parties could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [changeSetId]);

  if (loading) return <p className="text-xs text-ink-muted px-3">Loading impacted parties…</p>;
  if (error) return <p role="alert" className="text-xs text-red-700 px-3">{error}</p>;
  if (impacts.length === 0)
    return <p className="text-xs text-ink-muted px-3">No parties were re-screened as a result of this change.</p>;

  return (
    <div className="overflow-x-auto px-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase text-ink-muted border-b border-border">
            <th className="py-1.5 pr-3">Party</th>
            <th className="py-1.5 pr-3">Status Change</th>
            <th className="py-1.5 pr-3">Transition</th>
            <th className="py-1.5 pr-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {impacts.map((i) => (
            <tr key={i.id} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 pr-3 font-semibold text-ink">{i.partyDisplayName || "Unnamed party"}</td>
              <td className="py-1.5 pr-3 text-ink-muted">
                {i.previousStatus ?? "—"} <span className="text-ink">→</span> {i.newStatus}
              </td>
              <td className="py-1.5 pr-3">
                {i.transitionType ? <Badge variant={transitionBadgeVariant(i.transitionType)}>{i.transitionType}</Badge> : "—"}
              </td>
              <td className="py-1.5 pr-3 text-ink-muted">{displayDate(i.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function transitionBadgeVariant(transitionType: string): BadgeProps["variant"] {
  if (transitionType === "NEW_HIT" || transitionType === "ESCALATED") return "danger";
  if (transitionType === "NEW_REVIEW" || transitionType === "PARTIAL") return "warning";
  if (transitionType === "RISK_REDUCED" || transitionType === "CLEARED") return "success";
  if (transitionType === "ERROR") return "danger";
  return "neutral";
}

function PreviewImpactModal({ change, onClose }: { change: RdpsReferenceChange; onClose: () => void }) {
  const [candidates, setCandidates] = useState<RdpsPreviewImpactCandidate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/compliance/rdps/reference-changes/${change.id}/preview-impact`, { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((body) => {
        if (!cancelled) setCandidates(body.candidates ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("The impact preview could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [change.id]);

  return (
    <Modal isOpen onClose={onClose}>
      <ModalHeader
        title="Preview Impact"
        subtitle={change.screeningEntity?.name ?? change.datasetId}
        onClose={onClose}
      />
      <ModalBody className="space-y-3">
        <p className="text-xs text-ink-muted">
          Read-only preview of parties this change would match today. No rescreen is performed and nothing is recorded.
        </p>
        {loading ? (
          <p className="text-xs text-ink-muted py-6 text-center">Loading…</p>
        ) : error ? (
          <p role="alert" className="text-xs text-red-700 py-6 text-center">{error}</p>
        ) : !candidates || candidates.length === 0 ? (
          <p className="text-xs text-ink-muted py-6 text-center">No parties would be impacted by this change.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-ink-muted border-b border-border">
                  <th className="py-1.5 pr-3">Party</th>
                  <th className="py-1.5 pr-3">Current Status</th>
                  <th className="py-1.5 pr-3">Match Reasons</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.partyId} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 pr-3 font-semibold text-ink">{c.partyDisplayName || "Unnamed party"}</td>
                    <td className="py-1.5 pr-3 text-ink-muted">
                      {c.currentStatus ? <Badge variant="neutral">{c.currentStatus}</Badge> : "Not yet screened"}
                    </td>
                    <td className="py-1.5 pr-3 text-ink-muted">{c.reasons.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function importStatusBadgeVariant(status: string | null): BadgeProps["variant"] {
  if (status === "SUCCESS") return "success";
  if (status === "FAILED") return "danger";
  if (status === "RUNNING") return "warning";
  return "neutral";
}

function ReferenceDataHealthSubTab() {
  const [rows, setRows] = useState<RdpsReferenceDataHealthRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compliance/rdps/reference-data-health");
      if (!res.ok) throw new Error("failed");
      const body = await res.json();
      setRows(body.datasets ?? []);
    } catch {
      setError("Reference data health could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider">Reference Data Health</h3>
        <Button type="button" variant="secondary" size="sm" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-xs text-ink-muted py-6 text-center">Loading…</p>
      ) : error ? (
        <p role="alert" className="text-xs text-red-700 py-6 text-center">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-ink-muted py-6 text-center">No reference-data datasets found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-ink-muted border-b border-border">
                <th className="py-2 pr-3">List</th>
                <th className="py-2 pr-3">Last Successful Import</th>
                <th className="py-2 pr-3">Published Version</th>
                <th className="py-2 pr-3">Record Count</th>
                <th className="py-2 pr-3">Added</th>
                <th className="py-2 pr-3">Updated</th>
                <th className="py-2 pr-3">Removed</th>
                <th className="py-2 pr-3">Import Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.datasetId} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-3 font-semibold text-ink">
                    {row.label}
                    <span className="block text-[10px] text-ink-muted font-mono">
                      {row.provider ?? row.datasetId}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-ink-muted">
                    {row.lastSuccessfulImportAt ? displayDate(row.lastSuccessfulImportAt) : "Never"}
                  </td>
                  <td className="py-2 pr-3 text-ink-muted">
                    {row.publishedVersion ? displayDate(row.publishedVersion) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-ink-muted">
                    {row.recordCount ?? "—"}
                    {row.sourceReportedTotal != null && row.sourceReportedTotal !== row.recordCount && (
                      <span className="text-[10px] text-ink-muted"> / {row.sourceReportedTotal} reported</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-emerald-700">{row.added}</td>
                  <td className="py-2 pr-3 text-amber-700">{row.updated}</td>
                  <td className="py-2 pr-3 text-red-700">{row.removed}</td>
                  <td className="py-2 pr-3">
                    {row.importStatus ? (
                      <Badge variant={importStatusBadgeVariant(row.importStatus)}>{row.importStatus}</Badge>
                    ) : (
                      <Badge variant="neutral">No runs yet</Badge>
                    )}
                    {row.importStatus === "FAILED" && row.lastImportErrorMessage && (
                      <span className="block text-[10px] text-red-700 mt-0.5 max-w-[220px] truncate" title={row.lastImportErrorMessage}>
                        {row.lastImportErrorMessage}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
