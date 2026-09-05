"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, RefreshCw, Plus, CheckCircle2 } from "lucide-react";
import { createDisbursementAccountAction } from "./actions";

interface AccountWithMetrics {
  id: string;
  clientId: string;
  client: { name: string };
  importer?: { name: string } | null;
  currency: string;
  status: string;
  metrics: {
    currentBalance: number;
    minimumBalance: number;
    targetBalance: number;
    daysOfCover: number;
    dailyBurnRate: number;
    openExposure: number;
  };
}

export function ClientFundsTable({
  accounts,
  canManage,
}: {
  accounts: AccountWithMetrics[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filterBelowMin, setFilterBelowMin] = useState(false);
  const [filterNegative, setFilterNegative] = useState(false);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClientId, setNewClientId] = useState("");
  const [newMinBal, setNewMinBal] = useState("1000");
  const [newTargetBal, setNewTargetBal] = useState("5000");

  const filtered = accounts.filter((acc) => {
    const matchesSearch = acc.client.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filterBelowMin && acc.metrics.currentBalance >= acc.metrics.minimumBalance) return false;
    if (filterNegative && acc.metrics.currentBalance >= 0) return false;
    return true;
  });

  const handleBulkReplenish = async () => {
    setIsBulkRunning(true);
    setBulkMessage(null);
    try {
      const res = await fetch("/api/billing/funds/replenishments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoTrigger: true }),
      });
      const json = await res.json();
      setBulkMessage(`Generated ${json.createdCount || 0} replenishment requests.`);
    } catch (err: any) {
      setBulkMessage(`Error: ${err.message}`);
    } finally {
      setIsBulkRunning(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientId) return;
    try {
      await createDisbursementAccountAction({
        clientId: newClientId,
        minimumBalance: Number(newMinBal),
        targetBalance: Number(newTargetBal),
        autoRequestReplenishment: true,
      });
      setShowCreateModal(false);
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-border">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-muted" />
            <input
              type="text"
              placeholder="Search by client name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <button
            type="button"
            onClick={() => setFilterBelowMin(!filterBelowMin)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filterBelowMin ? "bg-amber-50 text-amber-800 border-amber-300" : "bg-white text-ink border-border hover:bg-slate-50"
            }`}
          >
            Below Minimum
          </button>

          <button
            type="button"
            onClick={() => setFilterNegative(!filterNegative)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filterNegative ? "bg-rose-50 text-rose-800 border-rose-300" : "bg-white text-ink border-border hover:bg-slate-50"
            }`}
          >
            Negative Balance
          </button>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={handleBulkReplenish}
              disabled={isBulkRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-brand border border-border hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isBulkRunning ? "animate-spin" : ""}`} />
              <span>Bulk Replenish</span>
            </button>
          )}

          {canManage && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-dark transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>New Trust Account</span>
            </button>
          )}
        </div>
      </div>

      {bulkMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-blue-600" />
          <span>{bulkMessage}</span>
        </div>
      )}

      {/* Account Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-muted border-b border-border font-semibold text-ink-muted uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-4 py-3">Client & Importer</th>
              <th className="px-4 py-3 text-right">Current Balance</th>
              <th className="px-4 py-3 text-right">Min / Target</th>
              <th className="px-4 py-3 text-right">Days of Cover</th>
              <th className="px-4 py-3 text-right">Open Exposure</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">
                  No duty disbursement accounts found matching filters.
                </td>
              </tr>
            ) : (
              filtered.map((acc) => {
                const cur = acc.metrics.currentBalance;
                const min = acc.metrics.minimumBalance;
                const target = acc.metrics.targetBalance;

                let pillColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                let statusLabel = "Healthy";

                if (cur < 0) {
                  pillColor = "bg-rose-50 text-rose-700 border-rose-200";
                  statusLabel = "Negative";
                } else if (cur < min) {
                  pillColor = "bg-rose-50 text-rose-700 border-rose-200";
                  statusLabel = "Below Min";
                } else if (cur < target) {
                  pillColor = "bg-amber-50 text-amber-700 border-amber-200";
                  statusLabel = "Low Cover";
                }

                return (
                  <tr key={acc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-ink">
                      <Link href={`/app/billing/funds/${acc.id}`} className="hover:underline text-brand font-semibold">
                        {acc.client.name}
                      </Link>
                      {acc.importer && <p className="text-[11px] text-ink-muted font-normal">Importer: {acc.importer.name}</p>}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${cur < 0 ? "text-rose-600" : "text-ink"}`}>
                      ${cur.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-ink-muted">
                      ${min.toLocaleString("en-US")} / ${target.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-ink">
                      {acc.metrics.daysOfCover >= 999 ? "∞" : `${acc.metrics.daysOfCover} days`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-blue-700">
                      ${acc.metrics.openExposure.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${pillColor}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/app/billing/funds/${acc.id}`}
                        className="text-xs text-brand hover:underline font-semibold"
                      >
                        View Account →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleCreateAccount} className="bg-white rounded-xl border border-border p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-ink">New Duty Disbursement Account</h3>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Client ID</label>
              <input
                type="text"
                required
                value={newClientId}
                onChange={(e) => setNewClientId(e.target.value)}
                placeholder="Enter client ID"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-border"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">Minimum Balance ($)</label>
                <input
                  type="number"
                  required
                  value={newMinBal}
                  onChange={(e) => setNewMinBal(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-border"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">Target Balance ($)</label>
                <input
                  type="number"
                  required
                  value={newTargetBal}
                  onChange={(e) => setNewTargetBal(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-border"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-dark"
              >
                Create Account
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
