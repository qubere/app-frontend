"use client";

// Community Screening -- batch Restricted Party / Embargo screening of a set
// of parties entered directly, picked from Party Master, or uploaded as a
// file. This panel only orchestrates the existing engines via
// /api/compliance/community-screening*; it never duplicates matching logic.
// License Determination is explicitly out of scope for V1 -- the notice below
// must stay visible near the options/submit area and wherever results show.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Search, Upload, Users, FileText, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { displayDate } from "@/lib/honest";
import { LICENSE_DETERMINATION_NOTICE } from "@/modules/compliance/communityScreening/types";

type InputMode = "DIRECT_ENTRY" | "PARTY_MASTER" | "FILE_UPLOAD";
type SubView = "new" | "history";

interface DirectEntryRow {
  key: string;
  name: string;
  address: string;
  city: string;
  country: string;
  contactName: string;
  externalReference: string;
}

interface PartyPickerResult {
  id: string;
  internalPartyCode: string | null;
  displayName: string | null;
}

interface RunSummary {
  id: string;
  status: string;
  source: string;
  inputMode: string;
  totalParties: number;
  passedCount: number;
  failedCount: number;
  incompleteCount: number;
  errorCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface InvalidRow {
  rowNumber: number;
  errors: string[];
}

function newRow(): DirectEntryRow {
  return {
    key: Math.random().toString(36).slice(2),
    name: "",
    address: "",
    city: "",
    country: "",
    contactName: "",
    externalReference: "",
  };
}

function statusBadgeVariant(status: string): BadgeProps["variant"] {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED") return "danger";
  if (status === "PARTIAL") return "warning";
  return "neutral";
}

/** Encodes an ArrayBuffer as base64 without pulling in a new dependency. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function inferFileType(fileName: string): "CSV" | "XLSX" | "JSON" | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "CSV";
  if (ext === "xlsx") return "XLSX";
  if (ext === "json") return "JSON";
  return null;
}

const HISTORY_PAGE_SIZE = 20;

interface CommunityScreeningPanelProps {
  mayOverrideThresholds: boolean;
}

export function CommunityScreeningPanel({ mayOverrideThresholds }: CommunityScreeningPanelProps) {
  const [subView, setSubView] = useState<SubView>("new");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        {(
          [
            { id: "new" as const, label: "New Screening" },
            { id: "history" as const, label: "History" },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubView(t.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              subView === t.id ? "bg-ink text-white" : "bg-slate-50 text-ink-muted hover:text-ink border border-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subView === "new" ? (
        <NewScreeningView mayOverrideThresholds={mayOverrideThresholds} onScreened={() => setSubView("history")} />
      ) : (
        <HistoryView />
      )}
    </div>
  );
}

function LicenseNotice() {
  return (
    <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
      {LICENSE_DETERMINATION_NOTICE}
    </div>
  );
}

function NewScreeningView({
  mayOverrideThresholds,
  onScreened,
}: {
  mayOverrideThresholds: boolean;
  onScreened: () => void;
}) {
  const [inputMode, setInputMode] = useState<InputMode>("DIRECT_ENTRY");

  // Direct entry state
  const [rows, setRows] = useState<DirectEntryRow[]>([newRow()]);

  // Party picker state
  const [partySearch, setPartySearch] = useState("");
  const [partyResults, setPartyResults] = useState<PartyPickerResult[]>([]);
  const [partySearchBusy, setPartySearchBusy] = useState(false);
  const [selectedPartyIds, setSelectedPartyIds] = useState<Set<string>>(new Set());
  const [selectedPartyNames, setSelectedPartyNames] = useState<Map<string, string>>(new Map());

  // File upload state
  const [file, setFile] = useState<File | null>(null);

  // Options
  const [restrictedPartyEnabled, setRestrictedPartyEnabled] = useState(true);
  const [embargoEnabled, setEmbargoEnabled] = useState(true);
  const [complianceCountry, setComplianceCountry] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [nameThreshold, setNameThreshold] = useState("");
  const [addressThreshold, setAddressThreshold] = useState("");
  const [countryMatchRequired, setCountryMatchRequired] = useState(false);
  const [redFlagCheckEnabled, setRedFlagCheckEnabled] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidRows, setInvalidRows] = useState<InvalidRow[]>([]);
  const [run, setRun] = useState<RunSummary | null>(null);

  const searchParties = useCallback(async (q: string) => {
    setPartySearchBusy(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("pageSize", "20");
      const res = await fetch(`/api/parties?${params.toString()}`);
      if (res.ok) {
        const body = await res.json();
        setPartyResults(
          (body.parties ?? []).map((p: { id: string; internalPartyCode: string | null; displayName: string | null }) => ({
            id: p.id,
            internalPartyCode: p.internalPartyCode,
            displayName: p.displayName,
          }))
        );
      }
    } finally {
      setPartySearchBusy(false);
    }
  }, []);

  useEffect(() => {
    if (inputMode !== "PARTY_MASTER") return;
    const handle = setTimeout(() => searchParties(partySearch), 300);
    return () => clearTimeout(handle);
  }, [inputMode, partySearch, searchParties]);

  function togglePartySelected(p: PartyPickerResult) {
    setSelectedPartyIds((current) => {
      const next = new Set(current);
      if (next.has(p.id)) next.delete(p.id);
      else next.add(p.id);
      return next;
    });
    setSelectedPartyNames((current) => {
      const next = new Map(current);
      if (next.has(p.id)) next.delete(p.id);
      else next.set(p.id, p.displayName ?? p.internalPartyCode ?? p.id);
      return next;
    });
  }

  function updateRow(key: string, field: keyof DirectEntryRow, value: string) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((current) => [...current, newRow()]);
  }

  function removeRow(key: string) {
    setRows((current) => (current.length > 1 ? current.filter((r) => r.key !== key) : current));
  }

  const checksValid = restrictedPartyEnabled || embargoEnabled;
  const directEntryValid = inputMode === "DIRECT_ENTRY" && rows.some((r) => r.name.trim().length > 0);
  const partyMasterValid = inputMode === "PARTY_MASTER" && selectedPartyIds.size > 0;
  const fileUploadValid = inputMode === "FILE_UPLOAD" && file !== null;
  const canSubmit = checksValid && (directEntryValid || partyMasterValid || fileUploadValid) && !submitting;

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    setInvalidRows([]);
    setRun(null);

    try {
      const overrides =
        mayOverrideThresholds &&
        (nameThreshold || addressThreshold || countryMatchRequired || redFlagCheckEnabled)
          ? {
              ...(nameThreshold ? { nameThreshold: Number(nameThreshold) } : {}),
              ...(addressThreshold ? { addressThreshold: Number(addressThreshold) } : {}),
              countryMatchRequired,
              redFlagCheckEnabled,
            }
          : undefined;

      const body: Record<string, unknown> = {
        source: "UI",
        inputMode,
        checksEnabled: { restrictedParty: restrictedPartyEnabled, embargo: embargoEnabled },
        complianceCountry: complianceCountry || undefined,
        transactionReference: transactionReference || undefined,
        overrides,
      };

      if (inputMode === "DIRECT_ENTRY") {
        body.parties = rows
          .filter((r) => r.name.trim().length > 0)
          .map((r) => ({
            name: r.name.trim(),
            address: r.address || undefined,
            city: r.city || undefined,
            country: r.country || undefined,
            contactName: r.contactName || undefined,
            externalReference: r.externalReference || undefined,
          }));
      } else if (inputMode === "PARTY_MASTER") {
        body.partyIds = Array.from(selectedPartyIds);
      } else if (file !== null) {
        const fileType = inferFileType(file.name);
        const buffer = await file.arrayBuffer();
        body.fileName = file.name;
        body.fileType = fileType;
        body.fileContentBase64 = arrayBufferToBase64(buffer);
      }

      const res = await fetch("/api/compliance/community-screening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json?.error ?? "The screening request failed.");
        setInvalidRows(json?.invalidRows ?? []);
        if (json?.run) setRun(json.run);
        return;
      }

      setInvalidRows(json.invalidRows ?? []);
      setRun(json.run);
    } catch {
      setError("The request did not reach the server. Nothing was screened.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputModes: { id: InputMode; label: string; icon: typeof Users }[] = [
    { id: "DIRECT_ENTRY", label: "Direct Entry", icon: Plus },
    { id: "PARTY_MASTER", label: "Select Existing Parties", icon: Users },
    { id: "FILE_UPLOAD", label: "Upload File", icon: Upload },
  ];

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {inputModes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setInputMode(m.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                inputMode === m.id ? "bg-brand text-white" : "bg-slate-50 text-ink-muted hover:text-ink border border-border"
              }`}
            >
              <m.icon className="w-3.5 h-3.5" />
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {inputMode === "DIRECT_ENTRY" && (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-ink-muted border-b border-border">
                    <th className="py-2 pr-2">Name *</th>
                    <th className="py-2 pr-2">Address</th>
                    <th className="py-2 pr-2">City</th>
                    <th className="py-2 pr-2">Country</th>
                    <th className="py-2 pr-2">Contact Name</th>
                    <th className="py-2 pr-2">External Ref</th>
                    <th className="py-2 pr-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-b border-border/50 last:border-0">
                      <td className="py-1.5 pr-2">
                        <Input
                          aria-label="Party name"
                          value={row.name}
                          onChange={(e) => updateRow(row.key, "name", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          aria-label="Address"
                          value={row.address}
                          onChange={(e) => updateRow(row.key, "address", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          aria-label="City"
                          value={row.city}
                          onChange={(e) => updateRow(row.key, "city", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          aria-label="Country"
                          value={row.country}
                          onChange={(e) => updateRow(row.key, "country", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          aria-label="Contact name"
                          value={row.contactName}
                          onChange={(e) => updateRow(row.key, "contactName", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          aria-label="External reference"
                          value={row.externalReference}
                          onChange={(e) => updateRow(row.key, "externalReference", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          disabled={rows.length === 1}
                          aria-label={`Remove row ${row.key}`}
                          className="text-ink-muted hover:text-red-600 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addRow}>
              <Plus className="w-3.5 h-3.5" /> Add row
            </Button>
          </div>
        )}

        {inputMode === "PARTY_MASTER" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                className="pl-8"
                placeholder="Search parties by name, code, or identifier…"
                value={partySearch}
                onChange={(e) => setPartySearch(e.target.value)}
              />
            </div>
            <p className="text-[11px] text-ink-muted">{selectedPartyIds.size} selected</p>
            <div className="max-h-64 overflow-y-auto border border-border rounded-xl divide-y divide-border">
              {partySearchBusy ? (
                <p className="text-xs text-ink-muted p-3 text-center">Searching…</p>
              ) : partyResults.length === 0 ? (
                <p className="text-xs text-ink-muted p-3 text-center">No parties found.</p>
              ) : (
                partyResults.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 p-2.5 text-xs cursor-pointer hover:bg-surface-muted">
                    <input
                      type="checkbox"
                      checked={selectedPartyIds.has(p.id)}
                      onChange={() => togglePartySelected(p)}
                    />
                    <span className="font-medium text-ink">{p.displayName ?? "Unnamed party"}</span>
                    {p.internalPartyCode && <span className="text-ink-muted font-mono">({p.internalPartyCode})</span>}
                  </label>
                ))
              )}
            </div>
            {selectedPartyIds.size > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selectedPartyNames.entries()).map(([id, name]) => (
                  <Badge key={id} variant="info">
                    {name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {inputMode === "FILE_UPLOAD" && (
          <div className="space-y-2">
            <label
              htmlFor="community-screening-file"
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:bg-surface-muted text-center"
            >
              <FileText className="w-6 h-6 text-ink-muted" />
              <span className="text-xs font-semibold text-ink">
                {file ? file.name : "Click to choose a .csv, .xlsx, or .json file"}
              </span>
              <input
                id="community-screening-file"
                type="file"
                accept=".csv,.xlsx,.json"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file !== null && inferFileType(file.name) === null && (
              <p className="text-xs text-red-700">Unrecognized file type. Use .csv, .xlsx, or .json.</p>
            )}
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider">Screening Options</h3>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={restrictedPartyEnabled}
              onChange={(e) => setRestrictedPartyEnabled(e.target.checked)}
            />
            Restricted Party Screening
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
            <input type="checkbox" checked={embargoEnabled} onChange={(e) => setEmbargoEnabled(e.target.checked)} />
            Embargo Screening
          </label>
        </div>
        {!checksValid && <p className="text-xs text-red-700">At least one screening check must be enabled.</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink" htmlFor="cs-country">
              Compliance Country
            </label>
            <Input
              id="cs-country"
              placeholder="e.g. US"
              value={complianceCountry}
              onChange={(e) => setComplianceCountry(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink" htmlFor="cs-txn-ref">
              Transaction Reference
            </label>
            <Input
              id="cs-txn-ref"
              placeholder="Optional"
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
            />
          </div>
        </div>

        {mayOverrideThresholds && (
          <div className="pt-3 border-t border-border space-y-3">
            <h4 className="text-[10px] font-extrabold uppercase text-ink-muted">Overrides</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink" htmlFor="cs-name-threshold">
                  Name Threshold
                </label>
                <Input
                  id="cs-name-threshold"
                  type="number"
                  placeholder="Default"
                  value={nameThreshold}
                  onChange={(e) => setNameThreshold(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink" htmlFor="cs-address-threshold">
                  Address Threshold
                </label>
                <Input
                  id="cs-address-threshold"
                  type="number"
                  placeholder="Default"
                  value={addressThreshold}
                  onChange={(e) => setAddressThreshold(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={countryMatchRequired}
                  onChange={(e) => setCountryMatchRequired(e.target.checked)}
                />
                Country match required
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={redFlagCheckEnabled}
                  onChange={(e) => setRedFlagCheckEnabled(e.target.checked)}
                />
                Red flag check enabled
              </label>
            </div>
          </div>
        )}

        <LicenseNotice />

        {error && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-900">
            {error}
          </div>
        )}

        {invalidRows.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-amber-900">These rows were skipped:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-ink-muted border-b border-border">
                    <th className="py-1.5 pr-2">Row</th>
                    <th className="py-1.5 pr-2">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {invalidRows.map((r) => (
                    <tr key={r.rowNumber} className="border-b border-border/50 last:border-0">
                      <td className="py-1.5 pr-2 text-ink-muted">{r.rowNumber}</td>
                      <td className="py-1.5 pr-2 text-red-700">{r.errors.join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {run && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
            {run.status === "QUEUED" ? (
              <p className="text-sm font-semibold text-emerald-900">
                Screening queued — {run.totalParties} {run.totalParties === 1 ? "party" : "parties"} will be processed in
                the background.
              </p>
            ) : (
              <>
                <p className="text-sm font-semibold text-emerald-900">Screening complete.</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="success">{run.passedCount} Passed</Badge>
                  <Badge variant="danger">{run.failedCount} Failed</Badge>
                  <Badge variant="warning">{run.incompleteCount} Incomplete</Badge>
                  <Badge variant="neutral">{run.errorCount} Error</Badge>
                </div>
              </>
            )}
            <Link
              href={`/app/compliance/community-screening/${run.id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              onClick={onScreened}
            >
              View full results <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        <Button type="button" onClick={onSubmit} disabled={!canSubmit} loading={submitting}>
          {submitting ? "Screening…" : "Run Screening"}
        </Button>
      </Card>
    </div>
  );
}

interface HistoryFilters {
  status: string;
  source: string;
}

function HistoryView() {
  const [filters, setFilters] = useState<HistoryFilters>({ status: "", source: "" });
  const [page, setPage] = useState(1);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(HISTORY_PAGE_SIZE));
      if (filters.status) params.set("status", filters.status);
      if (filters.source) params.set("source", filters.source);
      const res = await fetch(`/api/compliance/community-screening?${params.toString()}`);
      if (res.ok) {
        const body = await res.json();
        setRuns(body.runs ?? []);
        setTotal(body.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));

  function duration(run: RunSummary): string {
    if (!run.startedAt || !run.completedAt) return "—";
    const ms = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
    if (ms < 0) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          aria-label="Filter by status"
          value={filters.status}
          onChange={(e) => {
            setPage(1);
            setFilters((f) => ({ ...f, status: e.target.value }));
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
        <Select
          aria-label="Filter by source"
          value={filters.source}
          onChange={(e) => {
            setPage(1);
            setFilters((f) => ({ ...f, source: e.target.value }));
          }}
          className="w-auto"
        >
          <option value="">All sources</option>
          <option value="UI">UI</option>
          <option value="API">API</option>
        </Select>
      </div>

      {loading ? (
        <p className="text-xs text-ink-muted py-6 text-center">Loading…</p>
      ) : runs.length === 0 ? (
        <p className="text-xs text-ink-muted py-6 text-center">No community screening runs yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-ink-muted border-b border-border">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Screening ID</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Passed</th>
                <th className="py-2 pr-3">Failed</th>
                <th className="py-2 pr-3">Incomplete</th>
                <th className="py-2 pr-3">Error</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <RunRow key={run.id} run={run} duration={duration(run)} />
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
  );
}

function RunRow({ run, duration }: { run: RunSummary; duration: string }) {
  return (
    <tr
      className="border-b border-border/50 last:border-0 hover:bg-surface-muted/50 cursor-pointer focus-within:bg-surface-muted/50"
      tabIndex={0}
      role="link"
      onClick={() => {
        window.location.href = `/app/compliance/community-screening/${run.id}`;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") window.location.href = `/app/compliance/community-screening/${run.id}`;
      }}
    >
      <td className="py-2 pr-3 text-ink-muted">{displayDate(run.createdAt)}</td>
      <td className="py-2 pr-3 font-mono text-[10px] text-ink-muted" title={run.id}>
        {run.id.slice(0, 10)}…
      </td>
      <td className="py-2 pr-3 text-ink-muted">{run.source}</td>
      <td className="py-2 pr-3 text-ink">{run.totalParties}</td>
      <td className="py-2 pr-3 text-emerald-700">{run.passedCount}</td>
      <td className="py-2 pr-3 text-red-700">{run.failedCount}</td>
      <td className="py-2 pr-3 text-amber-700">{run.incompleteCount}</td>
      <td className="py-2 pr-3 text-ink-muted">{run.errorCount}</td>
      <td className="py-2 pr-3">
        <Badge variant={statusBadgeVariant(run.status)}>{run.status}</Badge>
      </td>
      <td className="py-2 pr-3 text-ink-muted">{duration}</td>
    </tr>
  );
}
