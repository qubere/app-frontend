"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";
import { Badge, Combobox, type ComboboxOption } from "@/components/ui";

export interface ImporterOption {
  id: string;
  name: string;
  irsEin: string | null;
  cbpImporterNumber: string | null;
  clientId: string | null;
  client: { id: string; name: string } | null;
  registrationStatus: string;
  bond: { status: string; lastVerifiedAt: string | null } | null;
  powersOfAttorney: Array<{ status: string; signedDate: string; expirationDate: string | null; revokedAt: string | null }>;
  readiness: { ready: boolean; label: string; blockers: Array<{ code: string; label: string; href: string }> };
}

export function ImporterPicker({ value, onChange, disabled, clientId }: {
  value: ImporterOption | null;
  onChange: (importer: ImporterOption | null) => void;
  disabled?: boolean;
  clientId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [importers, setImporters] = useState<ImporterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (query.trim()) params.set("q", query.trim());
        if (clientId) params.set("client", clientId);
        const response = await fetch(`/api/importers?${params}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message ?? "Could not load importers.");
        if (!controller.signal.aborted) {
          setImporters((data.importers ?? []).filter((importer: ImporterOption) => importer.clientId));
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load importers.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [clientId, query]);

  const available = value && !importers.some((importer) => importer.id === value.id) ? [value, ...importers] : importers;

  return <div className="space-y-3">
    <Combobox
      label="Importer of record"
      value={value ? toOption(value) : null}
      options={available.map(toOption)}
      onChange={(option) => onChange(option ? available.find((importer) => importer.id === option.id) ?? null : null)}
      onQueryChange={setQuery}
      placeholder="Search importer, client, CBP number, or EIN"
      emptyMessage="No assigned importers match this search"
      loading={loading}
      disabled={disabled}
      error={error}
      required
    />
    {importers.length === 50 && <p className="text-[11px] text-ink-muted">Showing the first 50 matches. Type more to narrow the list.</p>}
    {value && <ImporterEvidence importer={value} />}
  </div>;
}

function toOption(importer: ImporterOption): ComboboxOption {
  const identity = importer.cbpImporterNumber ? `CBP ${importer.cbpImporterNumber}` : "CBP registration pending";
  return { id: importer.id, label: importer.name, description: `${importer.client?.name ?? "Unassigned"} · ${identity}` };
}

function ImporterEvidence({ importer }: { importer: ImporterOption }) {
  const poa = importer.powersOfAttorney[0];
  const verifiedEvidence = [
    poa?.status === "executed" ? `POA executed ${shortDate(poa.signedDate)}` : null,
    importer.bond?.status === "verified" && importer.bond.lastVerifiedAt
      ? `Bond verified ${shortDate(importer.bond.lastVerifiedAt)}`
      : null,
  ].filter(Boolean).join(" · ");
  return <div className={`rounded-2xl border p-4 ${importer.readiness.ready ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/60"}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-2">{importer.readiness.ready ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}<div><p className="text-xs font-bold text-ink">{importer.readiness.label}</p><p className="text-[10px] text-ink-muted">Inherited from {importer.client?.name ?? "client"} importer record{verifiedEvidence ? ` · ${verifiedEvidence}` : ""}</p></div></div>
      <Badge variant={importer.readiness.ready ? "success" : "warning"}>{importer.readiness.ready ? "Filing context verified" : "Draft can save"}</Badge>
    </div>
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-4">
      <div><dt className="font-bold uppercase tracking-wide text-ink-muted">Client</dt><dd className="mt-0.5 font-semibold text-ink">{importer.client?.name ?? "—"}</dd></div>
      <div><dt className="font-bold uppercase tracking-wide text-ink-muted">CBP #</dt><dd className="mt-0.5 font-mono text-ink">{importer.cbpImporterNumber ?? "Pending"}</dd></div>
      <div><dt className="font-bold uppercase tracking-wide text-ink-muted">POA</dt><dd className="mt-0.5 capitalize text-ink">{poa?.status?.replaceAll("_", " ") ?? "Missing"}</dd></div>
      <div><dt className="font-bold uppercase tracking-wide text-ink-muted">Bond</dt><dd className="mt-0.5 capitalize text-ink">{importer.bond?.status?.replaceAll("_", " ") ?? "Missing"}</dd></div>
    </dl>
    {!importer.readiness.ready && importer.readiness.blockers[0] && <Link href={importer.readiness.blockers[0].href} className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-900 hover:underline"><ShieldCheck className="h-3.5 w-3.5" /> {importer.readiness.blockers[0].label} <ExternalLink className="h-3 w-3" /></Link>}
  </div>;
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
