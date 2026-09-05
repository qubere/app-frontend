"use client";

import { useEffect, useState } from "react";
import { Download, Send, ShieldAlert } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { displayDate } from "@/lib/honest";

interface FilerProfileOption {
  id: string;
  name: string;
  filerCode: string;
  format: string;
  transport: string;
  active: boolean;
}

interface FilerExportListRow {
  id: string;
  draftId: string;
  filerProfileId: string;
  format: string;
  transport: string;
  status: string;
  payloadHash: string;
  payloadSize: number;
  lastError: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

const FORMATS: { value: string; label: string }[] = [
  { value: "CSV", label: "CSV" },
  { value: "CATAIR_AE", label: "CATAIR (AE)" },
  { value: "JSON_API", label: "JSON API" },
];

function statusBadgeVariant(status: string): BadgeProps["variant"] {
  if (status === "Delivered") return "success";
  if (status === "Failed") return "danger";
  if (status === "Superseded") return "neutral";
  return "warning"; // Pending
}

function errorFromResponse(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error?: { message?: string } | string }).error;
    if (typeof err === "string") return err;
    if (err && typeof err.message === "string") return err.message;
  }
  return fallback;
}

export function FilerExportPanel({
  shipmentId,
  isExportable,
  blockingCount,
  warningCount,
  approvedAt,
  canExport,
}: {
  shipmentId: string;
  isExportable: boolean;
  blockingCount: number;
  warningCount: number;
  approvedAt: string | null;
  canExport: boolean;
}) {
  const [profiles, setProfiles] = useState<FilerProfileOption[] | null>(null);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [format, setFormat] = useState<string>("CSV");
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);

  const [exports, setExports] = useState<FilerExportListRow[] | null>(null);
  const [exportsError, setExportsError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/filer-profiles")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.filerProfiles)) {
          const active = data.filerProfiles.filter((p: FilerProfileOption) => p.active);
          setProfiles(active);
          if (active.length > 0) setSelectedProfileId(active[0].id);
        } else {
          setProfilesError(errorFromResponse(data, "Failed to load filer profiles."));
        }
      })
      .catch((err) => {
        if (!cancelled) setProfilesError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function loadExports() {
    fetch(`/api/shipments/${shipmentId}/entry-summary/export`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.exports)) {
          setExports(data.exports);
        } else {
          setExportsError(errorFromResponse(data, "Failed to load export history."));
        }
      })
      .catch((err) => setExportsError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(() => {
    loadExports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  const needsWarningAck = isExportable && warningCount > 0 && !acknowledgeWarnings;
  const exportDisabled =
    busy ||
    !canExport ||
    !isExportable ||
    approvedAt == null ||
    !selectedProfileId ||
    (profiles != null && profiles.length === 0) ||
    needsWarningAck;

  const disabledReason = !canExport
    ? "You do not have permission to export this draft."
    : !isExportable
    ? `Cannot export: ${blockingCount} blocking finding${blockingCount === 1 ? "" : "s"} must be resolved first.`
    : approvedAt == null
    ? "The draft must be approved before it can be exported."
    : profiles != null && profiles.length === 0
    ? "No active filer profile is configured."
    : needsWarningAck
    ? "Acknowledge the warnings below to enable export."
    : "Send this draft to the filer.";

  async function handleExport() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/entry-summary/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filerProfileId: selectedProfileId, format }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorFromResponse(data, "Export failed."));
      setSuccess(`Export ${data?.export?.status === "Delivered" ? "delivered" : "requested"} (status: ${data?.export?.status ?? "unknown"}).`);
      loadExports();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-white shadow-2xs p-4 space-y-4">
      <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink">ABI Filer Export</h3>

      {profilesError && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {profilesError}
        </p>
      )}

      {profiles != null && profiles.length === 0 && !profilesError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>No active ABI filer profile is configured for this account yet. Configure one before exporting.</span>
        </div>
      )}

      {profiles != null && profiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-ink-muted">Filer Profile</label>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-xs"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.filerCode})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-ink-muted">Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-xs">
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {isExportable && warningCount > 0 && (
        <label className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={acknowledgeWarnings}
            onChange={(e) => setAcknowledgeWarnings(e.target.checked)}
          />
          <span>
            I acknowledge the {warningCount} warning{warningCount === 1 ? "" : "s"} on this draft and want to export anyway.
          </span>
        </label>
      )}

      <span title={disabledReason} className="inline-block">
        <Button onClick={handleExport} loading={busy} disabled={exportDisabled}>
          <Send className="w-3.5 h-3.5" />
          Export to Filer
        </Button>
      </span>

      {error && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
          {success}
        </p>
      )}

      <div className="pt-2 border-t border-border space-y-2">
        <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">Export History</h4>
        {exportsError && <p className="text-xs text-red-700">{exportsError}</p>}
        {exports != null && exports.length === 0 && !exportsError && (
          <p className="text-xs text-ink-muted">No exports have been requested for this shipment yet.</p>
        )}
        {exports != null && exports.length > 0 && (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[11px] border-collapse min-w-[520px]">
              <thead>
                <tr className="text-left text-[9px] font-bold uppercase text-ink-muted border-b border-border">
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5">Format</th>
                  <th className="px-2 py-1.5">Transport</th>
                  <th className="px-2 py-1.5">Requested</th>
                  <th className="px-2 py-1.5 text-right">Payload</th>
                </tr>
              </thead>
              <tbody>
                {exports.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="px-2 py-1.5">
                      <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                      {row.lastError && <p className="text-[9px] text-red-600 mt-0.5">{row.lastError}</p>}
                    </td>
                    <td className="px-2 py-1.5 font-mono">{row.format}</td>
                    <td className="px-2 py-1.5">{row.transport}</td>
                    <td className="px-2 py-1.5 text-ink-muted whitespace-nowrap">{displayDate(row.createdAt)}</td>
                    <td className="px-2 py-1.5 text-right">
                      {row.transport === "DOWNLOAD" && row.status === "Delivered" ? (
                        <a
                          href={`/api/filer-exports/${row.id}/payload`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand font-bold hover:underline"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </a>
                      ) : row.transport === "DOWNLOAD" && row.status === "Pending" ? (
                        <a
                          href={`/api/filer-exports/${row.id}/payload`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand font-bold hover:underline"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </a>
                      ) : (
                        <span className="text-ink-muted">{(row.payloadSize / 1024).toFixed(1)} KB</span>
                      )}
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
