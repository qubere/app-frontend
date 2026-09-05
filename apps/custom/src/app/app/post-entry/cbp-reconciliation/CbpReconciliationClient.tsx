"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, ChevronRight, Clock, Plus, Send } from "lucide-react";
import { displayCurrency } from "@/lib/honest";

interface Flag {
  id: string;
  entryNumber: string;
  entryDate: string;
  issues: string[];
  estimatedDutyDifference: string;
  deadlineDate: string;
  status: string;
  reconciliationEntry?: { id: string; reconciliationEntryNumber: string; status: string } | null;
}
interface Entry {
  id: string;
  reconciliationEntryNumber: string;
  issuesCovered: string[];
  deadlineDate: string;
  status: string;
  dutyDeltaTotal: string;
  transmittedAt: string | null;
  flags: Array<{ id: string; entryNumber: string }>;
}

const ISSUES = ["VALUE", "CLASSIFICATION", "FTA_ELIGIBILITY", "SECTION_9802"] as const;

function daysLeft(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function CbpReconciliationClient({
  initialFlags,
  initialEntries,
}: {
  initialFlags: Flag[];
  initialEntries: Entry[];
}) {
  const [flags, setFlags] = useState<Flag[]>(initialFlags);
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [form, setForm] = useState({ entryNumber: "", entryDate: "", estimatedDutyDifference: "" });
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [reconNumber, setReconNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const [f, e] = await Promise.all([
      fetch("/api/reconciliation/cbp").then((r) => (r.ok ? r.json() : { flags: [] })),
      fetch("/api/reconciliation/cbp/entries").then((r) => (r.ok ? r.json() : { entries: [] })),
    ]);
    setFlags(f.flags ?? []);
    setEntries(e.entries ?? []);
  };

  const addFlag = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (selectedIssues.length === 0) {
      setError("Select at least one reconcilable issue.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/reconciliation/cbp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryNumber: form.entryNumber.trim(),
        entryDate: form.entryDate ? new Date(form.entryDate).toISOString() : new Date().toISOString(),
        reconcilableIssues: selectedIssues,
        estimatedDutyDifference: Number(form.estimatedDutyDifference) || 0,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not flag the entry.");
      return;
    }
    setForm({ entryNumber: "", entryDate: "", estimatedDutyDifference: "" });
    setSelectedIssues([]);
    await reload();
  };

  const withdraw = async (id: string) => {
    setBusy(true);
    await fetch(`/api/reconciliation/cbp/${id}`, { method: "DELETE" });
    setBusy(false);
    await reload();
  };

  const bundle = async () => {
    if (!reconNumber.trim()) {
      setError("Enter a reconciliation entry number.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/reconciliation/cbp/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reconciliationEntryNumber: reconNumber.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("No FLAGGED entries to bundle.");
      return;
    }
    setReconNumber("");
    await reload();
  };

  const transmit = async (id: string) => {
    setBusy(true);
    await fetch(`/api/reconciliation/cbp/entries/${id}`, { method: "POST" });
    setBusy(false);
    await reload();
  };

  const flaggedCount = flags.filter((f) => f.status === "FLAGGED").length;

  return (
    <div className="min-h-screen bg-surface-muted">
      <div className="border-b border-border bg-white/70 px-6 py-5">
        <div className="flex items-center gap-2 text-ink-muted text-sm mb-1">
          <Link href="/app/post-entry" className="hover:text-ink">
            Post-Entry
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-ink font-medium">CBP Reconciliation</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
            <ArrowRightLeft className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink tracking-tight">CBP Reconciliation Program</h1>
            <p className="text-sm text-ink-muted">
              Flag entries to true up value, classification, FTA eligibility, or 9802 within 21 months of entry.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 px-6 py-6 max-w-6xl">
        <form onSubmit={addFlag} className="lg:col-span-2 h-fit space-y-3 rounded-2xl border border-border bg-white p-5">
          <h2 className="text-sm font-bold text-ink">Flag an entry</h2>
          <label className="block text-xs font-medium text-ink-muted">
            Entry number
            <input
              className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
              value={form.entryNumber}
              onChange={(e) => setForm({ ...form, entryNumber: e.target.value })}
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-ink-muted">
              Entry date
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                value={form.entryDate}
                onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
              />
            </label>
            <label className="block text-xs font-medium text-ink-muted">
              Est. duty Δ ($)
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                value={form.estimatedDutyDifference}
                onChange={(e) => setForm({ ...form, estimatedDutyDifference: e.target.value })}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ISSUES.map((i) => {
              const on = selectedIssues.includes(i);
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() =>
                    setSelectedIssues((prev) => (on ? prev.filter((x) => x !== i) : [...prev, i]))
                  }
                  className={`rounded-full px-2 py-1 text-[11px] font-medium border ${
                    on ? "bg-brand text-white border-brand" : "border-border text-ink-muted"
                  }`}
                >
                  {i.replace("_", " ")}
                </button>
              );
            })}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Flag entry
          </button>

          <div className="border-t border-border pt-3">
            <h2 className="text-sm font-bold text-ink">Bundle into reconciliation entry</h2>
            <p className="text-[11px] text-ink-muted">
              {flaggedCount} FLAGGED entr{flaggedCount === 1 ? "y" : "ies"} — the bundle inherits the earliest deadline.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-border px-2 py-1.5 text-sm"
                placeholder="Recon entry #"
                value={reconNumber}
                onChange={(e) => setReconNumber(e.target.value)}
              />
              <button
                type="button"
                onClick={bundle}
                disabled={busy || flaggedCount === 0}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                Prepare
              </button>
            </div>
          </div>
        </form>

        <div className="lg:col-span-3 space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Flagged entries</h3>
            <div className="space-y-2">
              {flags.length === 0 && (
                <p className="rounded-xl border border-dashed border-border bg-white p-6 text-center text-sm text-ink-muted">
                  No entries flagged.
                </p>
              )}
              {flags.map((f) => {
                const d = daysLeft(f.deadlineDate);
                return (
                  <div key={f.id} className="rounded-xl border border-border bg-white p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-ink">{f.entryNumber}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {f.status}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-ink-muted">
                      <span>{f.issues.map((i) => i.replace("_", " ")).join(", ")}</span>
                      <span>Δ {displayCurrency(f.estimatedDutyDifference)}</span>
                      <span className={`inline-flex items-center gap-1 ${d < 60 ? "text-amber-700" : ""}`}>
                        <Clock className="w-3 h-3" /> {d}d to file
                      </span>
                      {f.reconciliationEntry && <span>in {f.reconciliationEntry.reconciliationEntryNumber}</span>}
                    </div>
                    {f.status === "FLAGGED" && (
                      <button
                        onClick={() => withdraw(f.id)}
                        disabled={busy}
                        className="mt-1.5 text-[11px] font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Reconciliation entries</h3>
            <div className="space-y-2">
              {entries.length === 0 && (
                <p className="rounded-xl border border-dashed border-border bg-white p-6 text-center text-sm text-ink-muted">
                  None prepared.
                </p>
              )}
              {entries.map((e) => (
                <div key={e.id} className="rounded-xl border border-border bg-white p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-ink">{e.reconciliationEntryNumber}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      {e.status}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-ink-muted">
                    <span>{e.flags.length} underlying</span>
                    <span>{e.issuesCovered.map((i) => i.replace("_", " ")).join(", ")}</span>
                    <span>Total Δ {displayCurrency(e.dutyDeltaTotal)}</span>
                    <span>Deadline {new Date(e.deadlineDate).toLocaleDateString()}</span>
                  </div>
                  {e.status === "PREPARED" && (
                    <button
                      onClick={() => transmit(e.id)}
                      disabled={busy}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline disabled:opacity-50"
                    >
                      <Send className="w-3 h-3" /> Mark transmitted
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
