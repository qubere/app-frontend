import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAccountContext, hasPermission } from "@/lib/auth";

export const revalidate = 0;

export default async function BillingClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/sign-in");
  if (!(await hasPermission("billing.read"))) redirect("/app/billing");
  const { id } = await params;
  const client = await db.client.findFirst({
    where: { id, accountId: ctx.accountId },
    include: {
      rateCards: { orderBy: { updatedAt: "desc" } },
      invoices: { orderBy: { issueDate: "desc" }, take: 25 },
      shipments: { where: { accountId: ctx.accountId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, shipmentNumber: true, status: true } },
    },
  });
  if (!client) notFound();

  const total = client.invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
  const outstanding = client.invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue), 0);
  return <div className="space-y-6">
    <div><Link href="/app/billing/clients" className="text-xs font-semibold text-brand hover:underline">← Clients</Link><h2 className="text-xl font-bold text-ink mt-2">{client.name}</h2><p className="text-sm text-ink-muted">{client.billingContactName ?? client.contactName ?? "No billing contact"} · {client.billingContactEmail ?? client.contactEmail ?? "No billing email"} · Net {client.paymentTermsDays}</p></div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[["Rate cards", client.rateCards.length], ["Total invoiced", `$${total.toFixed(2)}`], ["Outstanding AR", `$${outstanding.toFixed(2)}`]].map(([label, value]) => <div key={label} className="p-5 rounded-2xl bg-white border border-[#E5E5EA]"><div className="text-xs uppercase tracking-wider text-ink-muted">{label}</div><div className="text-xl font-bold text-ink mt-1">{value}</div></div>)}</div>
    <section className="space-y-3"><h3 className="font-bold text-ink">Rate cards</h3><div className="rounded-2xl bg-white border border-[#E5E5EA] divide-y divide-[#E5E5EA]">{client.rateCards.length ? client.rateCards.map((card) => <Link key={card.id} href={`/app/billing/rate-cards/${card.id}`} className="flex justify-between px-5 py-4 hover:bg-[#F9F9FB]"><span className="font-semibold">{card.name}</span><span className="text-xs text-ink-muted">{card.productLine} · v{card.currentVersion} · {card.status}</span></Link>) : <p className="px-5 py-6 text-sm text-ink-muted">No client-specific rate card.</p>}</div></section>
    <section className="space-y-3"><h3 className="font-bold text-ink">Recent invoices</h3><div className="rounded-2xl bg-white border border-[#E5E5EA] divide-y divide-[#E5E5EA]">{client.invoices.length ? client.invoices.map((invoice) => <Link key={invoice.id} href={`/app/billing/invoices/${invoice.id}`} className="flex justify-between px-5 py-4 hover:bg-[#F9F9FB]"><span className="font-mono text-xs font-semibold">{invoice.invoiceNumber}</span><span className="text-xs text-ink-muted">{invoice.productLine} · {invoice.status} · ${Number(invoice.balanceDue).toFixed(2)} due</span></Link>) : <p className="px-5 py-6 text-sm text-ink-muted">No invoices.</p>}</div></section>
    <section className="space-y-3"><h3 className="font-bold text-ink">Recent shipments</h3><div className="flex flex-wrap gap-2">{client.shipments.map((shipment) => <Link key={shipment.id} href={`/app/billing/shipments/${shipment.id}`} className="px-3 py-2 rounded-lg border border-[#E5E5EA] bg-white text-xs font-semibold hover:border-brand">{shipment.shipmentNumber} · {shipment.status}</Link>)}</div></section>
  </div>;
}
