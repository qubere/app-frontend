"use client";

// Audit, Service Usage & Compliance History -- the ComplianceExecution-backed
// tab. Distinct from the legacy "Audit History" tab (AgentDecision-derived,
// per-filing audit runs): this one is the unified cross-domain execution
// envelope (RPS, embargo, classification, and the five thin-finding
// screening domains) plus formal overrides. Everything here is read from the
// /api/v1/compliance/executions* endpoints -- no client-side aggregation of
// unbounded data, and search/summary always share the same filter set so
// their numbers reconcile.
import { useCallback, useEffect, useState } from "react";
import { Clock, Search, Download, ShieldCheck, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { displayDate } from "@/lib/honest";

interface ExecutionRow {
  id: string;
  executionType: string;
  status: string;
  correlationId: string;
  shipmentId: string | null;
  partyId: string | null;
  productId: string | null;
  countryChecked: string | null;
  source: string;
  initiatedByUserId: string | null;
  finalStatus: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  overrideCount: number;
  findingCount: number;
}

interface SummaryData {
  total: number;
  byType: { executionType: string; count: number }[];
  byStatus: { status: string; count: number }[];
  bySource: { source: string; count: number }[];
  reviewRequiredCount: number;
  overriddenCount: number;
  avgDurationMs: number | null;
}

interface ExecutionDetail {
  execution: ExecutionRow & {
    requestSnapshot: unknown;
    responseSnapshot: unknown;
    finalSummary: string | null;
    agentName: string | null;
    modelProvider: string | null;
    modelVersion: string | null;
    promptVersion: string | null;
    rulesetVersion: string | null;
    resultRefType: string | null;
    resultRefId: string | null;
    errorCategory: string | null;
    errorCode: string | null;
    failedStage: string | null;
    overrides: Array<{
      id: string; originalDecision: string; overrideDecision: string; reason: string;
      overriddenByUserId: string; overriddenAt: string; revokedAt: string | null; revokedReason: string | null;
    }>;
    screeningFindings: Array<{ id: string; category: string; ruleName: string; severity: string; status: string; details: string; createdAt: string }>;
  };
  timeline: Array<{ at: string; kind: string; ref: string }>;
}

function statusBadgeVariant(status: string): BadgeProps["variant"] {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "PARTIAL") return "warning";
  return "neutral";
}

const PAGE_SIZE = 25;

export function ExecutionHistoryPanel({ mayCreateFormalOverride }: { mayCreateFormalOverride: boolean }) {
  const [filters, setFilters] = useState({
    shipmentId: "", partyId: "", executionType: "", status: "", source: "", correlationId: "",
  });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ExecutionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState({ originalDecision: "", overrideDecision: "", reason: "" });
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [revokeDraftById, setRevokeDraftById] = useState<Record<string, string>>({});
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const buildQuery = useCallback(
    (extra?: Record<string, string>) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) {
        if (v) params.set(k, v);
      }
      if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
      return params;
    },
    [filters]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const searchParams = buildQuery({ page: String(page), pageSize: String(PAGE_SIZE) });
      const summaryParams = buildQuery();
      const [searchRes, summaryRes] = await Promise.all([
        fetch(`/api/v1/compliance/executions?${searchParams.toString()}`),
        fetch(`/api/v1/compliance/executions/summary?${summaryParams.toString()}`),
      ]);
      if (searchRes.ok) {
        const json = await searchRes.json();
        setRows(json.data ?? []);
        setTotal(json.pagination?.total ?? 0);
      }
      if (summaryRes.ok) {
        const json = await summaryRes.json();
        setSummary(json.summary ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [buildQuery, page]);

  useEffect(() => {
    load();
  }, [load]);

  const loadDetail = async (id: string) => {
    const res = await fetch(`/api/v1/compliance/executions/${id}`);
    if (res.ok) setDetail(await res.json());
  };

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      await loadDetail(id);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setShowOverrideForm(false);
    setOverrideDraft({ originalDecision: "", overrideDecision: "", reason: "" });
    setOverrideError(null);
  };

  const submitOverride = async () => {
    if (!detail) return;
    setOverrideSubmitting(true);
    setOverrideError(null);
    try {
      const res = await fetch("/api/v1/compliance/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          executionId: detail.execution.id,
          resultRefType: detail.execution.resultRefType ?? detail.execution.executionType,
          resultRefId: detail.execution.resultRefId ?? detail.execution.id,
          originalDecision: overrideDraft.originalDecision,
          overrideDecision: overrideDraft.overrideDecision,
          reason: overrideDraft.reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOverrideError(json.error ?? "Failed to create override.");
        return;
      }
      setShowOverrideForm(false);
      setOverrideDraft({ originalDecision: "", overrideDecision: "", reason: "" });
      await loadDetail(detail.execution.id);
      await load();
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const submitRevoke = async (overrideId: string) => {
    if (!detail) return;
    const revokedReason = revokeDraftById[overrideId]?.trim();
    if (!revokedReason) return;
    setRevokingId(overrideId);
    try {
      const res = await fetch(`/api/v1/compliance/overrides/${overrideId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revokedReason }),
      });
      if (res.ok) {
        setRevokeDraftById((d) => { const next = { ...d }; delete next[overrideId]; return next; });
        await loadDetail(detail.execution.id);
        await load();
      }
    } finally {
      setRevokingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase text-ink-muted">Total Executions</p>
            <p className="text-2xl font-extrabold text-ink">{summary.total}</p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase text-ink-muted">Review Required</p>
            <p className="text-2xl font-extrabold text-ink">{summary.reviewRequiredCount}</p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase text-ink-muted">Overridden</p>
            <p className="text-2xl font-extrabold text-ink">{summary.overriddenCount}</p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase text-ink-muted">Avg Duration</p>
            <p className="text-2xl font-extrabold text-ink">
              {summary.avgDurationMs !== null ? `${Math.round(summary.avgDurationMs)}ms` : "—"}
            </p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase text-ink-muted">Types Represented</p>
            <p className="text-2xl font-extrabold text-ink">{summary.byType.length}</p>
          </Card>
        </div>
      )}

      <Card className="space-y-3">
        <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-brand" />
          <span>Filter Executions</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <Input placeholder="Shipment ID" value={filters.shipmentId} onChange={(e) => setFilters((f) => ({ ...f, shipmentId: e.target.value }))} />
          <Input placeholder="Party ID" value={filters.partyId} onChange={(e) => setFilters((f) => ({ ...f, partyId: e.target.value }))} />
          <Input placeholder="Correlation ID" value={filters.correlationId} onChange={(e) => setFilters((f) => ({ ...f, correlationId: e.target.value }))} />
          <select
            className="text-xs rounded-lg border border-border px-2 py-2"
            value={filters.executionType}
            onChange={(e) => setFilters((f) => ({ ...f, executionType: e.target.value }))}
          >
            <option value="">All types</option>
            {["RESTRICTED_PARTY_SCREENING", "EMBARGO_SCREENING", "CLASSIFICATION", "FORCED_LABOR_SCREENING", "END_USE_SCREENING", "END_USER_SCREENING", "MILITARY_END_USE_SCREENING", "ANTI_BOYCOTT_SCREENING", "LICENSE_DETERMINATION", "IMPORT_CONTROL_DETERMINATION"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            className="text-xs rounded-lg border border-border px-2 py-2"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            {["QUEUED", "RUNNING", "COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <Button size="sm" variant="secondary" onClick={() => { setPage(1); load(); }}>
            Apply
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-brand" />
            <span>Executions ({total})</span>
          </h3>
          <a
            href={`/api/v1/compliance/executions/export?${buildQuery().toString()}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </a>
        </div>

        {loading ? (
          <p className="text-xs text-ink-muted py-6 text-center">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-ink-muted py-6 text-center">No compliance executions match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-ink-muted border-b border-border">
                  <th className="py-2 pr-3">Started</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Shipment / Party</th>
                  <th className="py-2 pr-3">Overrides</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-surface-muted/50 cursor-pointer" onClick={() => openDetail(r.id)}>
                    <td className="py-2 pr-3 text-ink-muted">{displayDate(r.startedAt)}</td>
                    <td className="py-2 pr-3 font-medium text-ink">{r.executionType}</td>
                    <td className="py-2 pr-3"><Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge></td>
                    <td className="py-2 pr-3 text-ink-muted">{r.source}</td>
                    <td className="py-2 pr-3 text-ink-muted">{r.shipmentId ?? r.partyId ?? "—"}</td>
                    <td className="py-2 pr-3 text-ink-muted">{r.overrideCount > 0 ? <Badge variant="warning">{r.overrideCount}</Badge> : "—"}</td>
                    <td className="py-2 pr-3 text-brand font-semibold">View</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-ink-muted">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
            <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>

      <Modal isOpen={selectedId !== null} onClose={closeDetail} size="xl">
        <ModalHeader
          title="Compliance Execution Detail"
          subtitle={detail?.execution.id}
          icon={<ShieldCheck className="w-4.5 h-4.5" />}
          onClose={closeDetail}
        />
        <ModalBody className="space-y-4">
          {detailLoading || !detail ? (
            <p className="text-xs text-ink-muted py-6 text-center">Loading…</p>
          ) : (
            <>
              <section className="space-y-1">
                <h4 className="text-[10px] font-extrabold uppercase text-ink-muted">Overview</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-ink-muted">Type: </span>{detail.execution.executionType}</div>
                  <div><span className="text-ink-muted">Status: </span><Badge variant={statusBadgeVariant(detail.execution.status)}>{detail.execution.status}</Badge></div>
                  <div><span className="text-ink-muted">Source: </span>{detail.execution.source}</div>
                  <div><span className="text-ink-muted">Correlation ID: </span>{detail.execution.correlationId}</div>
                  <div><span className="text-ink-muted">Started: </span>{displayDate(detail.execution.startedAt)}</div>
                  <div><span className="text-ink-muted">Completed: </span>{detail.execution.completedAt ? displayDate(detail.execution.completedAt) : "—"}</div>
                  <div><span className="text-ink-muted">Duration: </span>{detail.execution.durationMs !== null ? `${detail.execution.durationMs}ms` : "—"}</div>
                  <div><span className="text-ink-muted">Result Ref: </span>{detail.execution.resultRefType ? `${detail.execution.resultRefType} (${detail.execution.resultRefId})` : "—"}</div>
                </div>
              </section>

              {detail.execution.finalSummary && (
                <section className="space-y-1">
                  <h4 className="text-[10px] font-extrabold uppercase text-ink-muted">Result</h4>
                  <p className="text-xs text-ink">{detail.execution.finalSummary}</p>
                </section>
              )}

              {(detail.execution.errorCategory || detail.execution.errorCode) && (
                <section className="space-y-1">
                  <h4 className="text-[10px] font-extrabold uppercase text-ink-muted">Error</h4>
                  <p className="text-xs text-ink">
                    {detail.execution.errorCategory ?? "—"} {detail.execution.errorCode ? `(${detail.execution.errorCode})` : ""} {detail.execution.failedStage ? `at ${detail.execution.failedStage}` : ""}
                  </p>
                </section>
              )}

              <section className="space-y-1">
                <h4 className="text-[10px] font-extrabold uppercase text-ink-muted">Screening Findings ({detail.execution.screeningFindings.length})</h4>
                {detail.execution.screeningFindings.length === 0 ? (
                  <p className="text-xs text-ink-muted">No linked findings.</p>
                ) : (
                  <div className="space-y-1">
                    {detail.execution.screeningFindings.map((f) => (
                      <div key={f.id} className="text-xs flex items-center gap-2 flex-wrap">
                        <Badge variant={f.severity === "CRITICAL" || f.severity === "HIGH" ? "danger" : "warning"}>{f.severity}</Badge>
                        <span className="font-medium">{f.ruleName}</span>
                        <span className="text-ink-muted">{f.details}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-extrabold uppercase text-ink-muted">Formal Overrides ({detail.execution.overrides.length})</h4>
                  {mayCreateFormalOverride && !showOverrideForm && (
                    <Button size="sm" variant="secondary" onClick={() => setShowOverrideForm(true)}>
                      Create Override
                    </Button>
                  )}
                </div>
                {detail.execution.overrides.length === 0 ? (
                  <p className="text-xs text-ink-muted">No formal overrides recorded against this execution.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.execution.overrides.map((o) => (
                      <div key={o.id} className="text-xs border border-border rounded-lg p-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={o.revokedAt ? "neutral" : "warning"}>{o.revokedAt ? "REVOKED" : "ACTIVE"}</Badge>
                          <span>{o.originalDecision} → {o.overrideDecision}</span>
                        </div>
                        <p className="text-ink-muted">{o.reason}</p>
                        <p className="text-ink-muted">by {o.overriddenByUserId} on {displayDate(o.overriddenAt)}</p>
                        {o.revokedAt ? (
                          <p className="text-ink-muted">revoked on {displayDate(o.revokedAt)}{o.revokedReason ? `: ${o.revokedReason}` : ""}</p>
                        ) : (
                          mayCreateFormalOverride && (
                            <div className="flex items-center gap-2 pt-1">
                              <Input
                                placeholder="Revocation reason"
                                value={revokeDraftById[o.id] ?? ""}
                                onChange={(e) => setRevokeDraftById((d) => ({ ...d, [o.id]: e.target.value }))}
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={revokingId === o.id || !(revokeDraftById[o.id]?.trim())}
                                onClick={() => submitRevoke(o.id)}
                              >
                                Revoke
                              </Button>
                            </div>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {showOverrideForm && (
                  <div className="border border-border rounded-lg p-3 space-y-2">
                    <Input
                      placeholder="Original decision (e.g. LICENSE_REQUIRED)"
                      value={overrideDraft.originalDecision}
                      onChange={(e) => setOverrideDraft((d) => ({ ...d, originalDecision: e.target.value }))}
                    />
                    <Input
                      placeholder="Override decision (e.g. NO_LICENSE_REQUIRED)"
                      value={overrideDraft.overrideDecision}
                      onChange={(e) => setOverrideDraft((d) => ({ ...d, overrideDecision: e.target.value }))}
                    />
                    <textarea
                      placeholder="Reason (required)"
                      value={overrideDraft.reason}
                      onChange={(e) => setOverrideDraft((d) => ({ ...d, reason: e.target.value }))}
                      rows={3}
                      className="w-full px-3.5 py-2.5 bg-surface-muted border border-border rounded-xl text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                    {overrideError && <p className="text-xs text-red-600">{overrideError}</p>}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={
                          overrideSubmitting ||
                          !overrideDraft.originalDecision.trim() ||
                          !overrideDraft.overrideDecision.trim() ||
                          !overrideDraft.reason.trim()
                        }
                        onClick={submitOverride}
                      >
                        Submit Override
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => { setShowOverrideForm(false); setOverrideError(null); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-1">
                <h4 className="text-[10px] font-extrabold uppercase text-ink-muted">Agent / Model</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-ink-muted">
                  <div>Agent: {detail.execution.agentName ?? "—"}</div>
                  <div>Model: {detail.execution.modelProvider ?? "—"} {detail.execution.modelVersion ?? ""}</div>
                  <div>Prompt Version: {detail.execution.promptVersion ?? "—"}</div>
                  <div>Ruleset Version: {detail.execution.rulesetVersion ?? "—"}</div>
                </div>
              </section>

              <section className="space-y-1">
                <h4 className="text-[10px] font-extrabold uppercase text-ink-muted">Timeline</h4>
                <div className="space-y-1">
                  {detail.timeline.map((t, i) => (
                    <div key={i} className="text-xs flex items-center gap-2">
                      <span className="text-ink-muted">{displayDate(t.at)}</span>
                      <span className="font-medium text-ink">{t.kind.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="secondary" onClick={closeDetail}>
            <X className="w-3.5 h-3.5" /> Close
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
