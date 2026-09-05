"use client";

import React, { useEffect, useState } from "react";
import { Wallet, Download, CheckCircle2, AlertTriangle, Send, ShieldCheck } from "lucide-react";

interface SummaryData {
  account: {
    id: string;
    currentBalance: number;
    minimumBalance: number;
    targetBalance: number;
    currency: string;
    daysOfCover: number;
  } | null;
  isDutyDirectPay: boolean;
  mode: string;
  message?: string;
}

interface LedgerEntry {
  id: string;
  type: string;
  description: string;
  amount: number;
  runningBalance: number;
  effectiveAt: string;
}

interface Replenishment {
  id: string;
  amount: number;
  state: string;
  dueDate: string | null;
}

interface WireInstructions {
  bankName: string;
  accountName: string;
  routingNumber: string;
  accountNumberEnding: string;
  swiftCode: string;
  referencePattern: string;
}

export default function PortalDutyFundsPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [replenishments, setReplenishments] = useState<Replenishment[]>([]);
  const [wireInstructions, setWireInstructions] = useState<WireInstructions | null>(null);
  const [loading, setLoading] = useState(true);

  const [markingId, setMarkingId] = useState<string | null>(null);
  const [refNo, setRefNo] = useState("");
  const [sentSuccess, setSentSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [sumRes, ledRes, repRes] = await Promise.all([
          fetch("/api/portal/funds/summary"),
          fetch("/api/portal/funds/ledger"),
          fetch("/api/portal/funds/replenishments"),
        ]);
        if (sumRes.ok) setSummary(await sumRes.json());
        if (ledRes.ok) {
          const d = await ledRes.json();
          setEntries(d.entries || []);
        }
        if (repRes.ok) {
          const d = await repRes.json();
          setReplenishments(d.replenishments || []);
          setWireInstructions(d.wireInstructions || null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleMarkSent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!markingId) return;
    try {
      const res = await fetch(`/api/portal/funds/replenishments/${markingId}/mark-sent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceNo: refNo }),
      });
      if (res.ok) {
        setSentSuccess(true);
        setMarkingId(null);
        setRefNo("");
        // Reload replenishments
        const repRes = await fetch("/api/portal/funds/replenishments");
        if (repRes.ok) {
          const d = await repRes.json();
          setReplenishments(d.replenishments || []);
        }
      }
    } catch (err) {
      alert("Failed to submit payment notice");
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-ink-muted">
        Loading duty advance funds account...
      </div>
    );
  }

  if (summary?.isDutyDirectPay) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-ink">Duty Funds & Trust Balance</h1>
          <p className="text-xs text-ink-muted">Manage duty advance balance and top-up instructions.</p>
        </div>
        <div className="p-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 space-y-2 text-center">
          <ShieldCheck className="h-10 w-10 text-blue-600 mx-auto" />
          <h3 className="text-base font-bold">Duty Direct Pay Account</h3>
          <p className="text-xs text-blue-800 max-w-md mx-auto">
            {summary.message || "This importer pays CBP directly via daily or monthly ACH debit. No broker duty advance account is required."}
          </p>
        </div>
      </div>
    );
  }

  const acc = summary?.account;
  const curBal = acc?.currentBalance || 0;
  const minBal = acc?.minimumBalance || 0;
  const targetBal = acc?.targetBalance || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Duty Funds & Trust Balance</h1>
          <p className="text-xs text-ink-muted">View live trust advance balance, duty disbursements fronted to CBP, and top-up requests.</p>
        </div>
        <a
          href="/api/portal/funds/statement"
          download
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-border text-ink hover:bg-slate-50 shadow-sm"
        >
          <Download className="h-4 w-4" />
          <span>Statement of Disbursements (CSV)</span>
        </a>
      </div>

      {sentSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Payment notice sent! Our billing staff will confirm receipt once funds clear.</span>
        </div>
      )}

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-white border border-border shadow-sm space-y-1">
          <span className="text-xs font-semibold text-ink-muted">Advance Balance</span>
          <p className={`text-2xl font-mono font-bold ${curBal < 0 ? "text-rose-600" : "text-emerald-700"}`}>
            ${curBal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-ink-muted">Available trust funds held on account</p>
        </div>

        <div className="p-5 rounded-xl bg-white border border-border shadow-sm space-y-1">
          <span className="text-xs font-semibold text-ink-muted">Min / Target Requirement</span>
          <p className="text-2xl font-mono font-bold text-ink">
            ${minBal.toLocaleString("en-US")} / ${targetBal.toLocaleString("en-US")}
          </p>
          <p className="text-[11px] text-ink-muted">Minimum threshold for duty payment authorization</p>
        </div>

        <div className="p-5 rounded-xl bg-white border border-border shadow-sm space-y-1">
          <span className="text-xs font-semibold text-ink-muted">Days of Cover</span>
          <p className="text-2xl font-mono font-bold text-ink">
            {acc?.daysOfCover && acc.daysOfCover >= 999 ? "∞" : `${acc?.daysOfCover || 0} days`}
          </p>
          <p className="text-[11px] text-ink-muted">Estimated coverage based on 30-day burn rate</p>
        </div>
      </div>

      {/* Outstanding Replenishment Requests */}
      {replenishments.length > 0 && (
        <div className="p-5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-4">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Outstanding Replenishment Requests</span>
          </div>

          <div className="space-y-3">
            {replenishments.map((rep) => (
              <div key={rep.id} className="bg-white p-4 rounded-lg border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-ink text-sm font-mono">${rep.amount.toFixed(2)} USD</p>
                  <p className="text-xs text-ink-muted">Due date: {rep.dueDate ? new Date(rep.dueDate).toLocaleDateString() : "Immediate"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMarkingId(rep.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-dark"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Mark Payment Sent</span>
                </button>
              </div>
            ))}
          </div>

          {/* Wire Instructions */}
          {wireInstructions && (
            <div className="p-4 bg-white rounded-lg border border-amber-200 text-xs space-y-2">
              <h4 className="font-bold text-ink">Wire & ACH Payment Instructions</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                <div><span className="text-ink-muted block font-sans text-[10px]">Bank Name</span>{wireInstructions.bankName}</div>
                <div><span className="text-ink-muted block font-sans text-[10px]">Account Name</span>{wireInstructions.accountName}</div>
                <div><span className="text-ink-muted block font-sans text-[10px]">Routing Number</span>{wireInstructions.routingNumber}</div>
                <div><span className="text-ink-muted block font-sans text-[10px]">Account Ending</span>****{wireInstructions.accountNumberEnding}</div>
                <div><span className="text-ink-muted block font-sans text-[10px]">SWIFT</span>{wireInstructions.swiftCode}</div>
                <div><span className="text-ink-muted block font-sans text-[10px]">Reference Pattern</span>{wireInstructions.referencePattern}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Movements Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden space-y-3 p-4">
        <h3 className="font-bold text-ink text-sm">Recent Trust Fund Movements</h3>
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-muted border-b border-border font-semibold text-ink-muted uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Movement Type</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Running Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                  No movements recorded yet.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-ink-muted">{new Date(e.effectiveAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{e.type}</td>
                  <td className="px-4 py-3 text-ink">{e.description}</td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${e.amount < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {e.amount > 0 ? `+$${e.amount.toFixed(2)}` : `-$${Math.abs(e.amount).toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-ink">${e.runningBalance.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mark Sent Modal */}
      {markingId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleMarkSent} className="bg-white rounded-xl border border-border p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-ink">Mark Replenishment Payment Sent</h3>
            <p className="text-xs text-ink-muted">
              Enter your bank payment reference/wire confirmation number so our finance staff can verify receipt.
            </p>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Reference / Wire Confirmation #</label>
              <input
                type="text"
                required
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="e.g. WIRE-88776655"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-border"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMarkingId(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-dark"
              >
                Confirm Payment Sent
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
