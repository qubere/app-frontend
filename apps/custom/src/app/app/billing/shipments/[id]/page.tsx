import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { getShipmentFinancialSummary } from "@/lib/billing/ledger";

export const revalidate = 0;

export default async function BillingShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/sign-in");
  if (!(await hasPermission("billing.charge.view"))) redirect("/app/billing");
  const { id } = await params;
  const canViewCost = await hasPermission("billing.cost.view");

  // Shipment/ShipmentCharge/ShipmentCost all carry an Account relation, and
  // getShipmentFinancialSummary (in @qubere/billing/ledger) queries Shipment/
  // UsageEvent internally -- all dataMode-scoped, so without this wrapper they'd
  // silently default to PRODUCTION isolation.
  const { shipment, summary } = await withDataModeContext(isDataMode(ctx.dataMode) ? ctx.dataMode : null, async () => {
    const shipment = await db.shipment.findFirst({
      where: { id, accountId: ctx.accountId, deletedAt: null },
      select: {
        id: true, shipmentNumber: true, importerName: true, status: true,
        client: { select: { id: true, name: true } },
        shipmentCharges: { where: { accountId: ctx.accountId }, orderBy: { createdAt: "desc" }, include: { usageEvent: { select: { eventCode: true, productLine: true } }, adjustments: true } },
        ...(canViewCost ? { shipmentCosts: { where: { accountId: ctx.accountId }, orderBy: { createdAt: "desc" } } } : {}),
      },
    });
    const summary = shipment ? await getShipmentFinancialSummary(id, ctx.accountId) : null;
    return { shipment, summary };
  });
  if (!shipment) notFound();
  const costs = "shipmentCosts" in shipment && Array.isArray(shipment.shipmentCosts) ? shipment.shipmentCosts : [];
  return <div className="space-y-6">
    <div><Link href="/app/billing/shipments" className="text-xs font-semibold text-brand hover:underline">← Shipment economics</Link><h2 className="text-xl font-bold text-ink mt-2">{shipment.shipmentNumber}</h2><p className="text-sm text-ink-muted">{shipment.client?.name ?? shipment.importerName} · {shipment.status}</p></div>
    {summary && <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[["Net revenue", summary.netRevenue], ["Unbilled", summary.arStatus.unbilled], ["Invoiced", summary.arStatus.invoiced], ["Pass-through", summary.customsEconomics.totalPassThrough]].map(([label, amount]) => <div key={String(label)} className="p-4 rounded-xl bg-white border border-[#E5E5EA]"><div className="text-xs text-ink-muted">{label}</div><div className="font-mono font-bold mt-1">${Number(amount).toFixed(2)}</div></div>)}</div>}
    <section className="space-y-3"><h3 className="font-bold text-ink">Charge ledger</h3><div className="rounded-2xl bg-white border border-[#E5E5EA] overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#F5F5F7] text-ink-muted uppercase"><tr><th className="px-5 py-3">Charge</th><th className="px-5 py-3">Event</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody className="divide-y divide-[#E5E5EA]">{shipment.shipmentCharges.map((charge) => <tr key={charge.id}><td className="px-5 py-4 font-semibold">{charge.description}</td><td className="px-5 py-4 font-mono text-ink-muted">{charge.usageEvent?.productLine ?? "CUSTOMS"} / {charge.usageEvent?.eventCode ?? "MANUAL"}</td><td className="px-5 py-4 font-mono">${Number(charge.netAmount).toFixed(2)}</td><td className="px-5 py-4">{charge.status}</td><td className="px-5 py-4 text-right"><Link href={`/app/billing/charges/${charge.id}`} className="font-semibold text-brand hover:underline">Review →</Link></td></tr>)}</tbody></table></div></section>
    {canViewCost && <section className="space-y-3"><h3 className="font-bold text-ink">Cost ledger</h3><div className="rounded-2xl bg-white border border-[#E5E5EA] divide-y divide-[#E5E5EA]">{costs.map((cost) => <div key={cost.id} className="flex justify-between px-5 py-4 text-xs"><span>{cost.description}</span><span className="font-mono">{cost.costType} · ${Number(cost.amount).toFixed(2)}</span></div>)}</div></section>}
  </div>;
}
