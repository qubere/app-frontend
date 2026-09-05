"use client";

import React, { useState } from "react";
import {
  Download, Plus, RefreshCw, CheckCircle2, AlertTriangle, XCircle, ArrowUpRight, ArrowDownLeft
} from "lucide-react";
import {
  recordDepositAction, recordRefundAction, recordAdjustmentAction, markDisbursementPaidAction, resolveReconciliationLineAction
} from "../actions";

interface AccountDetailProps {
  account: {
    id: string;
    currentBalance: number;
    minimumBalance: number;
    targetBalance: number;
    currency: string;
  };
  ledgerEntries: Array<{
    id: string;
    type: string;
    description: string;
    amount: number;
    runningBalance: number;
    effectiveAt: string;
    currency: string;
  }>;
  disbursements: Array<{
    id: string;
    entryNumber: string | null;
    status: string;
    estimatedAmount: number;
    actualAmount: number | null;
    paidAt: string | null;
    varianceAmount: number | null;
  }>;
  replenishments: Array<{
    id: string;
    amount: number;
    state: string;
    dueDate: string | null;
    requestedAt: string;
  }>;
  reconciliations: Array<{
    id: string;
    statementNumber: string;
    status: string;
    matchedCount: number;
    varianceCount: number;
    totalVarianceAmount: number;
    lines: Array<{
      id: string;
      accountingClassCode: string | null;
      statementAmount: number;
      qubereAmount: number;
      varianceAmount: number;
      matchStatus: string;
      resolution: string | null;
    }>;
  }>;
  permissions: {
    canDeposit: boolean;
    canRefund: boolean;
    canAdjust: boolean;
    canDisburse: boolean;
    canReconcile: boolean;
    canManage: boolean;
  };
}

export function AccountDetailTabs({
  account,
  ledgerEntries,
  disbursements,
  replenishments,
  reconciliations,
  permissions,
}: AccountDetailProps) {
  const [activeTab, setActiveTab] = useState<"ledger" | "disbursements" | "replenishments" | "reconciliation">("ledger");

  // Action Modals State
  const [modalType, setModalType] = useState<"deposit" | "refund" | "adjust" | "markPaid" | null>(null);
  const [selectedDisbursementId, setSelectedDisbursementId] = useState<string | null>(null);
  const [inputAmount, setInputAmount] = useState("");
  const [inputReason, setInputReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputAmount || Number(inputAmount) === 0) return;
    setIsSubmitting(true);

    try {
      if (modalType === "deposit") {
        await recordDepositAction(account.id, { amount: Number(inputAmount), notes: inputReason });
      } else if (modalType === "refund") {
        await recordRefundAction(account.id, { amount: Number(inputAmount), reason: inputReason });
      } else if (modalType === "adjust") {
        await recordAdjustmentAction(account.id, { amount: Number(inputAmount), reason: inputReason });
      } else if (modalType === "markPaid" && selectedDisbursementId) {
        await markDisbursementPaidAction(selectedDisbursementId, { actualAmount: Number(inputAmount) });
      }
      setModalType(null);
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveLine = async (reconId: string, lineId: string, action: "ACCEPT" | "ADJUST") => {
    try {
      await resolveReconciliationLineAction(reconId, lineId, action);
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-border">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "ledger", label: `Ledger (${ledgerEntries.length})` },
            { id: "disbursements", label: `Disbursements (${disbursements.length})` },
            { id: "replenishments", label: `Replenishments (${replenishments.length})` },
            { id: "reconciliation", label: `Reconciliation (${reconciliations.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? "bg-brand text-white"
                  : "bg-surface-muted text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {permissions.canDeposit && (
            <button
              type="button"
              onClick={() => {
                setModalType("deposit");
                setInputAmount("");
                setInputReason("");
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
            >
              + Deposit
            </button>
          )}

          {permissions.canRefund && (
            <button
              type="button"
              onClick={() => {
                setModalType("refund");
                setInputAmount("");
                setInputReason("");
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-white text-ink hover:bg-slate-50"
            >
              Refund Client
            </button>
          )}

          {permissions.canAdjust && (
            <button
              type="button"
              onClick={() => {
                setModalType("adjust");
                setInputAmount("");
                setInputReason("");
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-white text-ink hover:bg-slate-50"
            >
              Adjustment
            </button>
          )}

          <a
            href={`/api/billing/funds/accounts/${account.id}/ledger?format=csv`}
            download
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-white text-ink hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
        </div>
      </div>

      {/* TAB 1: LEDGER */}
      {activeTab === "ledger" && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted border-b border-border font-semibold text-ink-muted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                    No ledger entries recorded yet.
                  </td>
                </tr>
              ) : (
                ledgerEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-ink-muted">
                      {new Date(e.effectiveAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink">{e.type}</td>
                    <td className="px-4 py-3 text-ink">{e.description}</td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${e.amount < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {e.amount > 0 ? `+$${e.amount.toFixed(2)}` : `-$${Math.abs(e.amount).toFixed(2)}`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-ink">
                      ${e.runningBalance.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: DISBURSEMENTS */}
      {activeTab === "disbursements" && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted border-b border-border font-semibold text-ink-muted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Entry #</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Estimated</th>
                <th className="px-4 py-3 text-right">Actual Paid</th>
                <th className="px-4 py-3 text-right">Variance</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {disbursements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                    No disbursements found.
                  </td>
                </tr>
              ) : (
                disbursements.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono font-semibold text-ink">
                      {d.entryNumber || d.id.slice(-8)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-slate-100 border-slate-300 text-ink">
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">${d.estimatedAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-ink">
                      {d.actualAmount !== null ? `$${d.actualAmount.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-700">
                      {d.varianceAmount ? `$${d.varianceAmount.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(d.status === "AUTHORIZED" || d.status === "SCHEDULED") && permissions.canDisburse && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDisbursementId(d.id);
                            setModalType("markPaid");
                            setInputAmount(d.estimatedAmount.toString());
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-brand text-white rounded hover:bg-brand-dark"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: REPLENISHMENTS */}
      {activeTab === "replenishments" && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted border-b border-border font-semibold text-ink-muted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Requested Date</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3 text-right">Requested Amount</th>
                <th className="px-4 py-3 text-center">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {replenishments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-muted">
                    No replenishment requests found.
                  </td>
                </tr>
              ) : (
                replenishments.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono">{new Date(r.requestedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-mono">{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-ink">${r.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-blue-50 border-blue-200 text-blue-800">
                        {r.state}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: RECONCILIATION */}
      {activeTab === "reconciliation" && (
        <div className="space-y-4">
          {reconciliations.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-border text-center text-ink-muted text-xs">
              No statement reconciliations recorded yet.
            </div>
          ) : (
            reconciliations.map((rec) => (
              <div key={rec.id} className="bg-white rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div>
                    <h4 className="font-bold text-ink text-sm">Statement #{rec.statementNumber}</h4>
                    <p className="text-xs text-ink-muted">
                      Matched: {rec.matchedCount} | Variances: {rec.varianceCount} | Status: {rec.status}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                    rec.status === "CLOSED" ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-amber-50 text-amber-800 border-amber-300"
                  }`}>
                    {rec.status}
                  </span>
                </div>

                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted text-ink-muted text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="px-3 py-2">Class Code</th>
                      <th className="px-3 py-2 text-right">Statement Amt</th>
                      <th className="px-3 py-2 text-right">Qubere Amt</th>
                      <th className="px-3 py-2 text-right">Variance</th>
                      <th className="px-3 py-2 text-center">Match Status</th>
                      <th className="px-3 py-2 text-right">Resolution Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rec.lines.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-semibold">{l.accountingClassCode || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">${l.statementAmount.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono">${l.qubereAmount.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-amber-700">
                          ${l.varianceAmount.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-[10px]">
                          {l.matchStatus}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {l.matchStatus !== "MATCHED" && !l.resolution && permissions.canReconcile && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleResolveLine(rec.id, l.id, "ACCEPT")}
                                className="px-2 py-0.5 text-[10px] bg-slate-200 text-ink rounded font-semibold hover:bg-slate-300"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResolveLine(rec.id, l.id, "ADJUST")}
                                className="px-2 py-0.5 text-[10px] bg-brand text-white rounded font-semibold hover:bg-brand-dark"
                              >
                                Post Adj
                              </button>
                            </div>
                          )}
                          {l.resolution && (
                            <span className="text-[10px] font-semibold text-emerald-700">
                              Resolved: {l.resolution}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}

      {/* Action Modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleAction} className="bg-white rounded-xl border border-border p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-ink capitalize">
              {modalType === "markPaid" ? "Mark Disbursement Paid" : `Record ${modalType}`}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-border"
              />
            </div>
            {modalType !== "markPaid" && (
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">Reason / Notes</label>
                <input
                  type="text"
                  required
                  value={inputReason}
                  onChange={(e) => setInputReason(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-border"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-dark"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
