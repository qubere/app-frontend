"use client";

import { useState } from "react";
import Link from "next/link";
import { Banknote, ChevronRight, Clock, Plus } from "lucide-react";
import { displayCurrency } from "@/lib/honest";

interface Payment {
  id: string;
  statementNumber: string;
  statementType: string;
  statementDate: string;
  filerCode: string | null;
  totalDutyAmount: string;
  totalFeeAmount: string;
  totalAmountDue: string;
  paymentMethod: string;
  payerAccountLast4: string | null;
  paymentDeadline: string;
  status: string;
  achTrackingId: string;
}

const NEXT: Record<string, string[]> = {
  PENDING: ["SCHEDULED", "SUBMITTED", "CANCELLED"],
  SCHEDULED: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["SETTLED", "FAILED"],
  SETTLED: [],
  FAILED: [],
  CANCELLED: [],
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  SUBMITTED: "bg-violet-100 text-violet-700",
  SETTLED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-zinc-100 text-zinc-500",
};

function daysToDeadline(iso: string, now: number): number {
  return Math.floor((new Date(iso).getTime() - now) / 86_400_000);
}

export function DutyPaymentsClient({ initialPayments }: { initialPayments: Payment[] }) {
  const [rows, setRows] = useState<Payment[]>(initialPayments);
  const [renderedAt] = useState(() => Date.now());
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    statementNumber: "",
    statementType: "PERIODIC_MONTHLY",
    statementDate: "",
    filerCode: "",
    totalDutyAmount: "",
    totalFeeAmount: "",
    payerAccountNumber: "",
  });

  const reload = async () => {
    const r = await fetch("/api/duty-payments");
    if (r.ok) setRows((await r.json()).payments ?? []);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const duty = Number(form.totalDutyAmount) || 0;
    const fee = Number(form.totalFeeAmount) || 0;
    const res = await fetch("/api/duty-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        statementNumber: form.statementNumber.trim(),
        statementType: form.statementType,
        statementDate: form.statementDate
          ? new Date(form.statementDate).toISOString()
          : new Date().toISOString(),
        filerCode: form.filerCode.trim() || null,
        totalDutyAmount: duty,
        totalFeeAmount: fee,
        totalAmountDue: duty + fee,
        payerAccountNumber: form.payerAccountNumber.trim() || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not create the payment instruction.");
      return;
    }
    setShowForm(false);
    setForm({ ...form, statementNumber: "", totalDutyAmount: "", totalFeeAmount: "", payerAccountNumber: "" });
    await reload();
  };

  const advance = async (id: string, status: string) => {
    setBusy(true);
    const body: Record<string, unknown> = { status };
    if (status === "FAILED") body.failureReason = "Marked failed from the console";
    const res = await fetch(`/api/duty-payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) await reload();
  };

  return (
    <div className="min-h-screen bg-surface-muted">
      <div className="border-b border-border bg-white/70 px-6 py-5">
        <div className="flex items-center gap-2 text-ink-muted text-sm mb-1">
          <Link href="/app/post-entry" className="hover:text-ink">
            Post-Entry
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-ink font-medium">Duty Payments</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-lime-500 to-green-500 flex items-center justify-center">
              <Banknote className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink tracking-tight">Duty Statement Payments</h1>
              <p className="text-sm text-ink-muted">
                ACH payment instructions for CBP statements. Deadline math + lifecycle only — this does not move funds.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand/90"
          >
            <Plus className="w-4 h-4" /> New instruction
          </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-4 max-w-5xl">
        {showForm && (
          <form onSubmit={create} className="rounded-2xl border border-border bg-white p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-medium text-ink-muted">
              Statement number
              <input
                required
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                value={form.statementNumber}
                onChange={(e) => setForm({ ...form, statementNumber: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-ink-muted">
              Type
              <select
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                value={form.statementType}
                onChange={(e) => setForm({ ...form, statementType: e.target.value })}
              >
                <option value="PERIODIC_MONTHLY">Periodic Monthly</option>
                <option value="DAILY">Daily</option>
              </select>
            </label>
            <label className="text-xs font-medium text-ink-muted">
              Statement date
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                value={form.statementDate}
                onChange={(e) => setForm({ ...form, statementDate: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-ink-muted">
              Filer code
              <input
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                value={form.filerCode}
                onChange={(e) => setForm({ ...form, filerCode: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-ink-muted">
              Total duty ($)
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                value={form.totalDutyAmount}
                onChange={(e) => setForm({ ...form, totalDutyAmount: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-ink-muted">
              Total fees ($)
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                value={form.totalFeeAmount}
                onChange={(e) => setForm({ ...form, totalFeeAmount: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-ink-muted sm:col-span-2">
              Payer bank account (only last 4 are stored)
              <input
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                value={form.payerAccountNumber}
                onChange={(e) => setForm({ ...form, payerAccountNumber: e.target.value })}
              />
            </label>
            <div className="sm:col-span-3 flex items-center gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Create"}
              </button>
              {error && <span className="text-xs text-red-600">{error}</span>}
            </div>
          </form>
        )}

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-ink-muted">
            No payment instructions yet.
          </p>
        ) : (
          rows.map((p) => {
            const days = daysToDeadline(p.paymentDeadline, renderedAt);
            return (
              <div key={p.id} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[p.status]}`}>
                        {p.status}
                      </span>
                      <span className="font-mono text-sm font-semibold text-ink">{p.statementNumber}</span>
                      <span className="text-xs text-ink-muted">
                        {p.statementType === "PERIODIC_MONTHLY" ? "PMS" : "Daily"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                      <span>Due {displayCurrency(p.totalAmountDue)}</span>
                      <span className={`inline-flex items-center gap-1 ${days <= 2 ? "text-amber-700" : ""}`}>
                        <Clock className="w-3 h-3" />
                        {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d to deadline`}
                      </span>
                      <span>{p.paymentMethod.replace("_", " ")}</span>
                      {p.payerAccountLast4 && <span>••{p.payerAccountLast4}</span>}
                      <span className="font-mono text-[10px]">{p.achTrackingId}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {(NEXT[p.status] ?? []).map((s) => (
                      <button
                        key={s}
                        onClick={() => advance(p.id, s)}
                        disabled={busy}
                        className="rounded-lg border border-border px-2 py-1 text-[11px] font-medium hover:bg-surface-muted disabled:opacity-50"
                      >
                        {s.toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
