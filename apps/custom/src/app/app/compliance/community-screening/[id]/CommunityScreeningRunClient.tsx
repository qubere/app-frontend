"use client";

// Interactive shell for a single Community Screening run: summary banner,
// paginated/filterable results table, a per-row detail drawer, export links,
// and a "Rescreen Failed" action. Initial data is server-rendered by
// page.tsx; everything after that re-fetches from
// /api/compliance/community-screening/[id]* like every other client panel.
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { displayDate } from "@/lib/honest";

interface RunDetail {
  id: string;
  status: string;
  source: string;
  inputMode: string;
  totalParties: number;
  passedCount: number;
  failedCount: number;
  incompleteCount: number;
  errorCount: number;
  checksEnabled: { restrictedParty: boolean; embargo: boolean };
  complianceCountry: string | null;
  transactionReference: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface PartyResult {
  id: string;
  rowNumber: number;
  partyId: string | null;
  externalReference: string | null;
  snapshotName: string;
  snapshotCountry: string | null;
  snapshotAddress: string | null;
  snapshotCity: string | null;
  restrictedPartyEnabled: boolean;
  embargoEnabled: boolean;
  restrictedPartyStatus: string | null;
  restrictedPartyResultId: string | null;
  embargoStatus: string | null;
  embargoEvidence: Record<string, unknown> | null;
  aggregateStatus: string;
  failureReason: string | null;
  errorMessage: string | null;
  evaluatedAt: string | null;
}

interface CommunityScreeningRunClientProps {
  runId: string;
  initialRun: RunDetail;
  initialResults: PartyResult[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  mayScreen: boolean;
  licenseNotice: string;
}

function aggregateBadgeVariant(status: string): BadgeProps["variant"] {
  if (status === "PASSED") return "success";
  if (status === "FAILED" || status === "ERROR") return "danger";
  if (status === "INCOMPLETE") return "warning";
  return "neutral";
}

function screeningStatusBadgeVariant(status: string | null): BadgeProps["variant"] {
  if (status === null) return "neutral";
  if (status === "CLEAR" || status === "PASS") return "success";
  if (status === "HIT" || status === "FAIL") return "danger";
  if (status === "REVIEW_REQUIRED" || status === "PARTIAL") return "warning";
  return "neutral";
}

function runStatusBadgeVariant(status: string): BadgeProps["variant"] {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED") return "danger";
  if (status === "PARTIAL") return "warning";
  return "neutral";
}

const PAGE_SIZE = 50;

export function CommunityScreeningRunClient({
  runId,
  initialRun,
  initialResults,
  initialTotal,
  initialPage,
  mayScreen,
  licenseNotice,
}: CommunityScreeningRunClientProps) {
  const router = useRouter();
  const [run, setRun] = useState<RunDetail>(initialRun);
  const [results, setResults] = useState<PartyResult[]>(initialResults);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PartyResult | null>(null);
  const [rescreening, setRescreening] = useState(false);

  const load = useCallback(
    async (nextPage: number, status: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(nextPage));
        params.set("pageSize", String(PAGE_SIZE));
        if (status) params.set("status", status);
        const res = await fetch(`/api/compliance/community-screening/${runId}/results?${params.toString()}`);
        if (res.ok) {
          const body = await res.json();
          setRun((current) => ({ ...current, ...body.run, checksEnabled: body.run.checksEnabled ?? current.checksEnabled }));
          setResults(body.results ?? []);
          setTotal(body.total ?? 0);
          setPage(body.page ?? nextPage);
        }
      } finally {
        setLoading(false);
      }
    },
    [runId]
  );

  async function onRescreen() {
    setRescreening(true);
    try {
      const res = await fetch(`/api/compliance/community-screening/${runId}/rescreen`, { method: "POST" });
      if (res.ok) {
        router.refresh();
        await load(1, statusFilter);
      }
    } finally {
      setRescreening(false);
    }
  }

  const filteredResults = search
    ? results.filter((r) => r.snapshotName.toLowerCase().includes(search.toLowerCase()))
    : results;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasRescreenableRows =
    run.failedCount > 0 ||
    run.errorCount > 0 ||
    run.incompleteCount > 0 ||
    results.some((r) => ["FAILED", "ERROR", "INCOMPLETE"].includes(r.aggregateStatus));

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant={runStatusBadgeVariant(run.status)}>{run.status}</Badge>
              <span className="text-xs font-mono text-ink-muted">{run.id}</span>
            </div>
            <p className="text-xs text-ink-muted">
              {run.checksEnabled.restrictedParty && "Restricted Party"}
              {run.checksEnabled.restrictedParty && run.checksEnabled.embargo && " · "}
              {run.checksEnabled.embargo && "Embargo"}
              {" screening"}
              {run.complianceCountry && ` · Compliance country ${run.complianceCountry}`}
              {run.transactionReference && ` · Ref ${run.transactionReference}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`/api/compliance/community-screening/${runId}/export?format=csv`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </a>
            <a
              href={`/api/compliance/community-screening/${runId}/export?format=xlsx`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> XLSX
            </a>
            {mayScreen && hasRescreenableRows && (
              <Button size="sm" variant="secondary" onClick={onRescreen} loading={rescreening}>
                <RefreshCw className="w-3.5 h-3.5" /> Rescreen Failed
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <SummaryTile label="Total" value={run.totalParties} />
          <SummaryTile label="Passed" value={run.passedCount} tone="text-emerald-600" />
          <SummaryTile label="Failed" value={run.failedCount} tone="text-red-600" />
          <SummaryTile label="Incomplete" value={run.incompleteCount} tone="text-amber-600" />
          <SummaryTile label="Error" value={run.errorCount} tone="text-ink-muted" />
        </div>

        <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
          {licenseNotice}
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Search by party name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select
            aria-label="Filter by result status"
            value={statusFilter}
            onChange={(e) => {
              const value = e.target.value;
              setStatusFilter(value);
              load(1, value);
            }}
            className="w-auto"
          >
            <option value="">All statuses</option>
            {["PENDING", "PROCESSING", "PASSED", "FAILED", "INCOMPLETE", "ERROR"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <p className="text-xs text-ink-muted py-6 text-center">Loading…</p>
        ) : filteredResults.length === 0 ? (
          <p className="text-xs text-ink-muted py-6 text-center">No results match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-ink-muted border-b border-border">
                  <th className="py-2 pr-3">Party Name</th>
                  <th className="py-2 pr-3">Country</th>
                  <th className="py-2 pr-3">Restricted Party</th>
                  <th className="py-2 pr-3">Embargo</th>
                  <th className="py-2 pr-3">Overall</th>
                  <th className="py-2 pr-3">Failure Reason</th>
                  <th className="py-2 pr-3">Evaluated At</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-surface-muted/50">
                    <td className="py-2 pr-3 font-medium text-ink">{r.snapshotName}</td>
                    <td className="py-2 pr-3 text-ink-muted">{r.snapshotCountry ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {r.restrictedPartyEnabled ? (
                        <Badge variant={screeningStatusBadgeVariant(r.restrictedPartyStatus)}>
                          {r.restrictedPartyStatus ?? "PENDING"}
                        </Badge>
                      ) : (
                        <span className="text-ink-muted">Not screened</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {r.embargoEnabled ? (
                        <Badge variant={screeningStatusBadgeVariant(r.embargoStatus)}>{r.embargoStatus ?? "PENDING"}</Badge>
                      ) : (
                        <span className="text-ink-muted">Not screened</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant={aggregateBadgeVariant(r.aggregateStatus)}>{r.aggregateStatus}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-ink-muted max-w-xs truncate" title={r.failureReason ?? undefined}>
                      {r.failureReason ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-ink-muted">{r.evaluatedAt ? displayDate(r.evaluatedAt) : "—"}</td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        className="text-brand font-semibold hover:underline cursor-pointer"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-ink-muted">
            Page {page} of {totalPages} ({total} results)
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => load(page - 1, statusFilter)}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => load(page + 1, statusFilter)}>
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Modal isOpen={selected !== null} onClose={() => setSelected(null)} size="lg">
        <ModalHeader
          title={selected?.snapshotName ?? ""}
          subtitle={`Row ${selected?.rowNumber ?? ""}`}
          onClose={() => setSelected(null)}
        />
        <ModalBody className="space-y-4">
          {selected && (
            <>
              <section className="space-y-1">
                <h4 className="text-[10px] font-extrabold uppercase text-ink-muted">Party Snapshot</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-ink-muted">Address: </span>{selected.snapshotAddress ?? "—"}</div>
                  <div><span className="text-ink-muted">City: </span>{selected.snapshotCity ?? "—"}</div>
                  <div><span className="text-ink-muted">Country: </span>{selected.snapshotCountry ?? "—"}</div>
                  <div><span className="text-ink-muted">External Ref: </span>{selected.externalReference ?? "—"}</div>
                </div>
              </section>

              <section className="space-y-1">
                <h4 className="text-[10px] font-extrabold uppercase text-ink-muted">Restricted Party Outcome</h4>
                {selected.restrictedPartyEnabled ? (
                  <div className="text-xs space-y-1">
                    <div>
                      <Badge variant={screeningStatusBadgeVariant(selected.restrictedPartyStatus)}>
                        {selected.restrictedPartyStatus ?? "PENDING"}
                      </Badge>
                    </div>
                    {selected.restrictedPartyResultId && (
                      <p className="text-ink-muted font-mono">Result ID: {selected.restrictedPartyResultId}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted">Not screened for this run.</p>
                )}
              </section>

              <section className="space-y-1">
                <h4 className="text-[10px] font-extrabold uppercase text-ink-muted">Embargo Outcome</h4>
                {selected.embargoEnabled ? (
                  <div className="text-xs space-y-1">
                    <div>
                      <Badge variant={screeningStatusBadgeVariant(selected.embargoStatus)}>
                        {selected.embargoStatus ?? "PENDING"}
                      </Badge>
                    </div>
                    {selected.embargoEvidence && Object.keys(selected.embargoEvidence).length > 0 && (
                      <dl className="grid grid-cols-2 gap-1">
                        {Object.entries(selected.embargoEvidence).map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-ink-muted inline">{k}: </dt>
                            <dd className="inline text-ink">{String(v)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted">Not screened for this run.</p>
                )}
              </section>

              {selected.errorMessage && (
                <section className="space-y-1">
                  <h4 className="text-[10px] font-extrabold uppercase text-ink-muted">Error</h4>
                  <p className="text-xs text-red-700">{selected.errorMessage}</p>
                </section>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="secondary" onClick={() => setSelected(null)}>
            <X className="w-3.5 h-3.5" /> Close
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="p-3 rounded-xl bg-surface-muted border border-border">
      <p className="text-[10px] font-bold uppercase text-ink-muted">{label}</p>
      <p className={`text-xl font-extrabold ${tone ?? "text-ink"}`}>{value}</p>
    </div>
  );
}
