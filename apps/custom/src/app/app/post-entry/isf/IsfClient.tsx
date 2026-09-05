"use client";

import { useState } from "react";
import Link from "next/link";
import { Ship, Plus, Clock, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { displayCurrency } from "@/lib/honest";

interface IsfFiling {
  id: string;
  shipmentId: string | null;
  billOfLadingNumber: string | null;
  status: string;
  ladingDate: string | null;
  filingDeadline: string | null;
  submittedAt: string | null;
  missingElements: string[];
  bondOnFile: boolean;
  isLate: boolean;
  penaltyExposureUsd: string | null;
  createdAt: string;
}

const ISF_FIELDS: Array<{ key: string; label: string }> = [
  { key: "sellerNameAddress", label: "Seller (name & address)" },
  { key: "buyerNameAddress", label: "Buyer (name & address)" },
  { key: "importerOfRecordNumber", label: "Importer of record #" },
  { key: "consigneeNumber", label: "Consignee #" },
  { key: "manufacturerNameAddress", label: "Manufacturer / supplier" },
  { key: "shipToPartyNameAddress", label: "Ship-to party" },
  { key: "countryOfOrigin", label: "Country of origin" },
  { key: "commodityHtsNumber", label: "Commodity HTS #" },
];

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  REPLACED: "bg-zinc-100 text-zinc-500",
  LATE: "bg-red-100 text-red-700",
};

function deadlineBadge(deadline: string | null, submittedAt: string | null) {
  if (!deadline) return <span className="text-xs text-ink-muted">No lading date</span>;
  const ms = new Date(deadline).getTime() - Date.now();
  const hrs = Math.round(ms / 3_600_000);
  if (submittedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
        <CheckCircle2 className="w-3 h-3" /> Filed
      </span>
    );
  }
  if (ms < 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
        <AlertTriangle className="w-3 h-3" /> {Math.abs(hrs)}h past deadline
      </span>
    );
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${hrs <= 12 ? "text-amber-700" : "text-ink-muted"}`}
    >
      <Clock className="w-3 h-3" /> {hrs}h to deadline
    </span>
  );
}

export function IsfClient({ initialFilings }: { initialFilings: IsfFiling[] }) {
  const [filings, setFilings] = useState<IsfFiling[]>(initialFilings);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
    shipmentId: "",
    billOfLadingNumber: "",
    ladingDate: "",
  });

  const refresh = async () => {
    const res = await fetch("/api/isf");
    if (res.ok) setFilings((await res.json()).filings ?? []);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const elements: Record<string, string> = {};
    for (const f of ISF_FIELDS) if (form[f.key]?.trim()) elements[f.key] = form[f.key].trim();
    const body = {
      shipmentId: form.shipmentId.trim() || null,
      billOfLadingNumber: form.billOfLadingNumber.trim() || null,
      ladingDate: form.ladingDate ? new Date(form.ladingDate).toISOString() : null,
      elements,
    };
    const res = await fetch("/api/isf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not save the ISF draft.");
      return;
    }
    setShowForm(false);
    setForm({ shipmentId: "", billOfLadingNumber: "", ladingDate: "" });
    await refresh();
  };

  const submitFiling = async (id: string) => {
    setBusy(true);
    const res = await fetch(`/api/isf/${id}`, { method: "POST" });
    setBusy(false);
    if (res.ok) await refresh();
  };

  return (
    <div className="min-h-screen bg-surface-muted">
      <div className="border-b border-border bg-white/70 px-6 py-5">
        <div className="flex items-center gap-2 text-ink-muted text-sm mb-1">
          <Link href="/app/post-entry" className="hover:text-ink">
            Post-Entry
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-ink font-medium">ISF 10+2</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center">
              <Ship className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink tracking-tight">Importer Security Filings</h1>
              <p className="text-sm text-ink-muted">
                ISF 10+2 — must be filed no later than 24 hours before lading at the foreign port.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand/90"
          >
            <Plus className="w-4 h-4" /> New ISF draft
          </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-4 max-w-5xl">
        {showForm && (
          <form onSubmit={submitForm} className="rounded-2xl border border-border bg-white p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-xs font-medium text-ink-muted">
                Shipment ID (optional)
                <input
                  className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                  value={form.shipmentId}
                  onChange={(e) => setForm({ ...form, shipmentId: e.target.value })}
                />
              </label>
              <label className="text-xs font-medium text-ink-muted">
                Bill of lading #
                <input
                  className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                  value={form.billOfLadingNumber}
                  onChange={(e) => setForm({ ...form, billOfLadingNumber: e.target.value })}
                />
              </label>
              <label className="text-xs font-medium text-ink-muted">
                Lading date &amp; time
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                  value={form.ladingDate}
                  onChange={(e) => setForm({ ...form, ladingDate: e.target.value })}
                />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ISF_FIELDS.map((f) => (
                <label key={f.key} className="text-xs font-medium text-ink-muted">
                  {f.label}
                  <input
                    className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save draft"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {filings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-ink-muted">
            No ISF filings yet. Create a draft to compute the deadline and missing-element list.
          </p>
        ) : (
          filings.map((f) => (
            <div key={f.id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[f.status] ?? "bg-slate-100"}`}>
                      {f.status}
                    </span>
                    <span className="font-mono text-sm font-semibold text-ink">
                      {f.billOfLadingNumber || f.shipmentId || "—"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                    {deadlineBadge(f.filingDeadline, f.submittedAt)}
                    <span>{f.bondOnFile ? "Bond on file" : "No ISF bond"}</span>
                    {f.missingElements.length > 0 && (
                      <span className="text-amber-700">{f.missingElements.length} missing element(s)</span>
                    )}
                    <span>Exposure: {displayCurrency(f.penaltyExposureUsd, "USD", "$0.00")}</span>
                  </div>
                </div>
                {(f.status === "DRAFT" || f.status === "REPLACED") && (
                  <button
                    onClick={() => submitFiling(f.id)}
                    disabled={busy}
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Submit ISF
                  </button>
                )}
              </div>
              {f.missingElements.length > 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  Missing: {f.missingElements.join(", ")}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
