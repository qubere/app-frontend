import React from "react";
import { redirect } from "next/navigation";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { detectRevenueLeakage } from "@/lib/billing/ledger";
import { ExceptionsTable } from "./ExceptionsTable";

export const revalidate = 0;

export default async function BillingExceptionsPage() {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/sign-in");
  if (!(await hasPermission("billing.exception.view"))) redirect("/app/billing");
  const [canResolve, canWaive] = await Promise.all([
    hasPermission("billing.exception.resolve"),
    hasPermission("billing.exception.waive"),
  ]);

  // BillingException carries an Account relation, and detectRevenueLeakage
  // (in @qubere/billing/ledger) queries UsageEvent internally -- both are
  // dataMode-scoped, so without this wrapper they'd silently default to
  // PRODUCTION isolation.
  const { exceptions, leakageAlerts } = await withDataModeContext(isDataMode(ctx.dataMode) ? ctx.dataMode : null, async () => {
    const exceptions = await db.billingException.findMany({
      where: { accountId: ctx.accountId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true } },
        shipment: { select: { shipmentNumber: true } },
      },
    });

    const leakageAlerts = await detectRevenueLeakage(ctx.accountId);
    return { exceptions, leakageAlerts };
  });

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

      <ExceptionsTable
        exceptions={exceptions.map((ex) => ({
          id: ex.id,
          type: ex.type,
          severity: ex.severity,
          description: ex.description,
          status: ex.status,
          createdAt: ex.createdAt,
          shipmentNumber: ex.shipment?.shipmentNumber ?? null,
          clientName: ex.client?.name ?? null,
        }))}
        canResolve={canResolve}
        canWaive={canWaive}
      />
    </div>
  );
}
