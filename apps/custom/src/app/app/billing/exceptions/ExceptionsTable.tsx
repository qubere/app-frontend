"use client";

import { useEffect, useState } from "react";
import { BillingActionForm } from "../BillingActionForm";
import {
  resolveExceptionAction,
  waiveExceptionAction,
  bulkResolveExceptionsAction,
  bulkWaiveExceptionsAction,
} from "./actions";

interface ExceptionRow {
  id: string;
  type: string;
  severity: string;
  description: string;
  status: string;
  createdAt: string | Date;
  shipmentNumber: string | null;
  clientName: string | null;
}

export function ExceptionsTable({
  exceptions,
  canResolve,
  canWaive,
}: {
  exceptions: ExceptionRow[];
  canResolve: boolean;
  canWaive: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const canBulk = canResolve || canWaive;

  // Resolved/waived rows drop out of `exceptions` on refresh -- drop their
  // stale selection too, so "N selected" doesn't outlive the row it counted.
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(exceptions.map((e) => e.id));
      const next = new Set(Array.from(prev).filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [exceptions]);

  const allSelected = exceptions.length > 0 && selected.size === exceptions.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(exceptions.map((e) => e.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedIds = Array.from(selected);

  return (
    <div className="rounded-2xl bg-white border border-[#E5E5EA] overflow-hidden shadow-sm">
      {canBulk && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E5EA] bg-indigo-50 px-5 py-3">
          <span className="text-xs font-semibold text-indigo-900">{selectedIds.length} selected</span>
          {canResolve && (
            <BillingActionForm
              action={bulkResolveExceptionsAction.bind(null, selectedIds)}
              confirmMessage={`Resolve ${selectedIds.length} billing exception(s)?`}
              className="flex gap-2"
            >
              <input name="reason" required aria-label="Resolution reason" placeholder="Resolution reason" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs" />
              <button type="submit" className="rounded bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-white whitespace-nowrap">Resolve Selected</button>
            </BillingActionForm>
          )}
          {canWaive && (
            <BillingActionForm
              action={bulkWaiveExceptionsAction.bind(null, selectedIds)}
              confirmMessage={`Waive ${selectedIds.length} billing exception(s) and accept the billing risk?`}
              className="flex gap-2"
            >
              <input name="reason" required aria-label="Waiver reason" placeholder="Waiver reason" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs" />
              <button type="submit" className="rounded bg-amber-600 px-3 py-1 text-[10px] font-semibold text-white whitespace-nowrap">Waive Selected</button>
            </BillingActionForm>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-ink">
          <thead className="bg-[#F5F5F7] text-ink-muted uppercase text-xs tracking-wider border-b border-[#E5E5EA]">
            <tr>
              {canBulk && (
                <th className="px-5 py-3 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all exceptions" />
                </th>
              )}
              <th className="px-5 py-3">Exception Type</th>
              <th className="px-5 py-3">Severity</th>
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3">Shipment / Client</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Logged Date</th>
              {canBulk && <th className="px-5 py-3">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5EA] text-xs">
            {exceptions.length === 0 ? (
              <tr><td colSpan={6 + (canBulk ? 2 : 0)} className="px-5 py-8 text-center text-ink-muted text-sm font-sans">No open billing exceptions are currently recorded for this account.</td></tr>
            ) : exceptions.map((ex) => (
              <tr key={ex.id} className="hover:bg-[#F9F9FB] transition-colors">
                {canBulk && (
                  <td className="px-5 py-4">
                    <input type="checkbox" checked={selected.has(ex.id)} onChange={() => toggleOne(ex.id)} aria-label={`Select ${ex.type}`} />
                  </td>
                )}
                <td className="px-5 py-4 font-bold text-ink font-mono">{ex.type}</td>
                <td className="px-5 py-4 font-sans"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ex.severity === "HIGH" || ex.severity === "CRITICAL" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>{ex.severity}</span></td>
                <td className="px-5 py-4 text-ink max-w-xs truncate">{ex.description}</td>
                <td className="px-5 py-4 text-ink-muted">{ex.shipmentNumber ?? ex.clientName ?? "Workspace"}</td>
                <td className="px-5 py-4 font-sans"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">{ex.status}</span></td>
                <td className="px-5 py-4 font-mono text-ink-muted">{new Date(ex.createdAt).toLocaleDateString()}</td>
                {canBulk && (
                  <td className="px-5 py-4 min-w-64">
                    <div className="space-y-2">
                      {canResolve && (
                        <BillingActionForm action={resolveExceptionAction.bind(null, ex.id)} className="flex gap-2">
                          <input name="reason" required aria-label={`Resolution reason for ${ex.type}`} placeholder="Resolution reason" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs" />
                          <button type="submit" className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white">Resolve</button>
                        </BillingActionForm>
                      )}
                      {canWaive && (
                        <BillingActionForm action={waiveExceptionAction.bind(null, ex.id)} confirmMessage="Waive this exception and accept the billing risk?" className="flex gap-2">
                          <input name="reason" required aria-label={`Waiver reason for ${ex.type}`} placeholder="Waiver reason" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs" />
                          <button type="submit" className="rounded bg-amber-600 px-2 py-1 text-[10px] font-semibold text-white">Waive</button>
                        </BillingActionForm>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
