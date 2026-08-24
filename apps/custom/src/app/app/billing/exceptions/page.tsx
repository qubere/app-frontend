import React from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { detectRevenueLeakage } from "@/lib/billing/ledger";
import { BillingActionForm } from "../BillingActionForm";
import { resolveExceptionAction, waiveExceptionAction } from "./actions";

export const revalidate = 0;

export default async function BillingExceptionsPage() {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/sign-in");
  if (!(await hasPermission("billing.exception.view"))) redirect("/app/billing");
  const [canResolve, canWaive] = await Promise.all([
    hasPermission("billing.exception.resolve"),
    hasPermission("billing.exception.waive"),
  ]);

  const exceptions = await db.billingException.findMany({
    where: { accountId: ctx.accountId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true } },
      shipment: { select: { shipmentNumber: true } },
    },
  });

  const leakageAlerts = await detectRevenueLeakage(ctx.accountId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">Exceptions & Revenue Leakage Center</h2>
        <p className="text-sm text-ink-muted">Automated detection of missing rates, unbilled manual work, zero-rated events, and other billing anomalies.</p>
      </div>

      {leakageAlerts.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
          <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />Revenue Leakage Alert: {leakageAlerts.length} Unbilled Manual Work Events Detected</h3>
          <p className="text-xs text-amber-800/90">Manual broker interventions were recorded without corresponding rated customer charges.</p>
          <div className="divide-y divide-amber-200 text-xs font-mono text-amber-900">
            {leakageAlerts.slice(0, 5).map((l) => (
              <div key={l.eventId} className="py-2 flex items-center justify-between"><span>[{l.eventCode}] {l.reason} (Shipment: {l.shipmentId ?? "N/A"})</span><span className="text-[10px] text-amber-700">{new Date(l.occurredAt).toLocaleDateString()}</span></div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-[#E5E5EA] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-ink">
            <thead className="bg-[#F5F5F7] text-ink-muted uppercase text-xs tracking-wider border-b border-[#E5E5EA]"><tr><th className="px-5 py-3">Exception Type</th><th className="px-5 py-3">Severity</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">Shipment / Client</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Logged Date</th>{(canResolve || canWaive) && <th className="px-5 py-3">Action</th>}</tr></thead>
            <tbody className="divide-y divide-[#E5E5EA] text-xs">
              {exceptions.length === 0 ? (
                <tr><td colSpan={6 + (canResolve || canWaive ? 1 : 0)} className="px-5 py-8 text-center text-ink-muted text-sm font-sans">No open billing exceptions are currently recorded for this account.</td></tr>
              ) : exceptions.map((ex) => (
                <tr key={ex.id} className="hover:bg-[#F9F9FB] transition-colors">
                  <td className="px-5 py-4 font-bold text-ink font-mono">{ex.type}</td>
                  <td className="px-5 py-4 font-sans"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ex.severity === "HIGH" || ex.severity === "CRITICAL" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>{ex.severity}</span></td>
                  <td className="px-5 py-4 text-ink max-w-xs truncate">{ex.description}</td>
                  <td className="px-5 py-4 text-ink-muted">{ex.shipment?.shipmentNumber ?? ex.client?.name ?? "Workspace"}</td>
                  <td className="px-5 py-4 font-sans"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">{ex.status}</span></td>
                  <td className="px-5 py-4 font-mono text-ink-muted">{new Date(ex.createdAt).toLocaleDateString()}</td>
                  {(canResolve || canWaive) && (
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
    </div>
  );
}
