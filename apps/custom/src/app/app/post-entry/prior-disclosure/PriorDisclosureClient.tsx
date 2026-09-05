"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldAlert, ChevronRight, TrendingDown } from "lucide-react";
import { displayCurrency } from "@/lib/honest";

interface Disclosure {
  id: string;
  entryNumber: string | null;
  description: string;
  culpability: string;
  status: string;
  actualDutyLoss: string;
  statutoryMaxPenalty: string;
  estimatedPenaltyWithDisclosure: string;
  savingsFromDisclosure: string;
  tenderAmount: string;
  disclosedAt: string | null;
  createdAt: string;
}

interface Exposure {
  interestAmount: number;
  statutoryMaxPenaltyWithoutDisclosure: number;
  disclosedTenderAmount: number;
  estimatedPenaltyWithDisclosure: number;
  savingsFromDisclosure: number;
}

const CULPABILITY = ["NEGLIGENCE", "GROSS_NEGLIGENCE", "FRAUD"] as const;
const NEXT_STATUS: Record<string, Array<"TENDERED" | "ACKNOWLEDGED" | "CLOSED">> = {
  DRAFT: ["TENDERED", "CLOSED"],
  TENDERED: ["ACKNOWLEDGED", "CLOSED"],
  ACKNOWLEDGED: ["CLOSED"],
  CLOSED: [],
};

export function PriorDisclosureClient({ initialDisclosures }: { initialDisclosures: Disclosure[] }) {
  const [rows, setRows] = useState<Disclosure[]>(initialDisclosures);
  const [form, setForm] = useState({
    description: "",
    entryNumber: "",
    culpability: "NEGLIGENCE" as (typeof CULPABILITY)[number],
    actualDutyLoss: "",
    enteredValue: "",
    interestRatePct: "5",
    yearsElapsed: "1",
  });
  const [preview, setPreview] = useState<Exposure | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload = () => ({
    description: form.description.trim(),
    entryNumber: form.entryNumber.trim() || null,
    culpability: form.culpability,
    actualDutyLoss: Number(form.actualDutyLoss) || 0,
    enteredValue: Number(form.enteredValue) || 0,
    interestRatePct: Number(form.interestRatePct) || 5,
    yearsElapsed: Number(form.yearsElapsed) || 1,
  });

  const runPreview = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/prior-disclosures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload(), previewOnly: true }),
    });
    setBusy(false);
    if (res.ok) setPreview((await res.json()).exposure);
    else setError("Enter a duty loss and entered value to compute exposure.");
  };

  const save = async () => {
    if (!form.description.trim()) {
      setError("A description of the error is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/prior-disclosures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not record the disclosure.");
      return;
    }
    const res2 = await fetch("/api/prior-disclosures");
    if (res2.ok) setRows((await res2.json()).disclosures ?? []);
    setPreview(null);
    setForm({ ...form, description: "", entryNumber: "", actualDutyLoss: "", enteredValue: "" });
  };

  const changeStatus = async (id: string, status: string) => {
    setBusy(true);
    const res = await fetch(`/api/prior-disclosures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (res.ok) {
      const r = await fetch("/api/prior-disclosures");
      if (r.ok) setRows((await r.json()).disclosures ?? []);
    }
  };

  return (
    <div className="min-h-screen bg-surface-muted">
      <div className="border-b border-border bg-white/70 px-6 py-5">
        <div className="flex items-center gap-2 text-ink-muted text-sm mb-1">
          <Link href="/app/post-entry" className="hover:text-ink">
            Post-Entry
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-ink font-medium">Prior Disclosure</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center">
            <ShieldAlert className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink tracking-tight">Prior Disclosure (19 U.S.C. § 1592)</h1>
            <p className="text-sm text-ink-muted">
              A valid prior disclosure caps the penalty at interest on the loss of duties (negligence /
              gross negligence) or the actual loss of duties (fraud).
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 px-6 py-6 max-w-6xl">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-border bg-white p-5 h-fit">
          <h2 className="text-sm font-bold text-ink">Model & record a disclosure</h2>
          <label className="block text-xs font-medium text-ink-muted">
            Description of the error
            <textarea
              className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-ink-muted">
              Entry # (optional)
              <input
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                value={form.entryNumber}
                onChange={(e) => setForm({ ...form, entryNumber: e.target.value })}
              />
            </label>
            <label className="block text-xs font-medium text-ink-muted">
              Culpability
              <select
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                value={form.culpability}
                onChange={(e) => setForm({ ...form, culpability: e.target.value as (typeof CULPABILITY)[number] })}
              >
                {CULPABILITY.map((c) => (
                  <option key={c} value={c}>
                    {c.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-ink-muted">
              Actual loss of duties ($)
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                value={form.actualDutyLoss}
                onChange={(e) => setForm({ ...form, actualDutyLoss: e.target.value })}
              />
            </label>
            <label className="block text-xs font-medium text-ink-muted">
              Entered / dutiable value ($)
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                value={form.enteredValue}
                onChange={(e) => setForm({ ...form, enteredValue: e.target.value })}
              />
            </label>
            <label className="block text-xs font-medium text-ink-muted">
              Interest rate (%)
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                value={form.interestRatePct}
                onChange={(e) => setForm({ ...form, interestRatePct: e.target.value })}
              />
            </label>
            <label className="block text-xs font-medium text-ink-muted">
              Years elapsed
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                value={form.yearsElapsed}
                onChange={(e) => setForm({ ...form, yearsElapsed: e.target.value })}
              />
            </label>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={runPreview}
              disabled={busy}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Compute exposure
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Record disclosure
            </button>
          </div>
          {preview && (
            <div className="mt-2 rounded-xl bg-surface-muted p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-ink-muted">Statutory max (no disclosure)</span>
                <span className="font-semibold text-red-700">
                  {displayCurrency(preview.statutoryMaxPenaltyWithoutDisclosure)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Penalty with disclosure</span>
                <span className="font-semibold text-ink">
                  {displayCurrency(preview.estimatedPenaltyWithDisclosure)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Tender (loss + penalty)</span>
                <span className="font-semibold text-ink">{displayCurrency(preview.disclosedTenderAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1">
                <span className="flex items-center gap-1 text-emerald-700">
                  <TrendingDown className="w-3 h-3" /> Savings
                </span>
                <span className="font-bold text-emerald-700">{displayCurrency(preview.savingsFromDisclosure)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3 space-y-3">
          {rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-ink-muted">
              No prior disclosures recorded yet.
            </p>
          ) : (
            rows.map((d) => (
              <div key={d.id} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {d.status}
                      </span>
                      <span className="text-xs font-medium text-ink-muted">{d.culpability.replace("_", " ")}</span>
                      {d.entryNumber && <span className="font-mono text-xs text-ink">{d.entryNumber}</span>}
                    </div>
                    <p className="mt-1 text-sm text-ink">{d.description}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-muted">
                      <span>Loss {displayCurrency(d.actualDutyLoss)}</span>
                      <span>Tender {displayCurrency(d.tenderAmount)}</span>
                      <span className="text-emerald-700">Saves {displayCurrency(d.savingsFromDisclosure)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {(NEXT_STATUS[d.status] ?? []).map((s) => (
                      <button
                        key={s}
                        onClick={() => changeStatus(d.id, s)}
                        disabled={busy}
                        className="rounded-lg border border-border px-2 py-1 text-[11px] font-medium hover:bg-surface-muted disabled:opacity-50"
                      >
                        Mark {s.toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
