import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAccountContext, hasPermission, hasProductEntitlement } from "@qubere/auth";
import { db, runWithAccountId } from "@qubere/db";
import { AccessDenied } from "@/components/AccessDenied";
import { TmsSidebar } from "@/components/TmsSidebar";

export const revalidate = 0;

export default async function TmsCustomerBillingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const context = await getAccountContext();
  if (!context) redirect("/sign-in");
  const [canView, entitled] = await Promise.all([
    hasPermission("billing.view"),
    hasProductEntitlement(context.accountId, "TMS"),
  ]);
  if (!canView || !entitled) return <AccessDenied />;

  const data = await runWithAccountId(context.accountId, async () => {
    const [rateCards, invoices, usageCount, carrierPayables] = await Promise.all([
      db.rateCard.findMany({ where: { accountId: context.accountId, productLine: "TMS" }, orderBy: { updatedAt: "desc" }, include: { client: { select: { name: true } } } }),
      db.invoice.findMany({ where: { accountId: context.accountId, productLine: "TMS" }, orderBy: { issueDate: "desc" }, include: { client: { select: { name: true } } } }),
      db.usageEvent.count({ where: { accountId: context.accountId, productLine: "TMS" } }),
      db.carrierInvoice.aggregate({ where: { accountId: context.accountId, settlementStatus: { not: "PAID" } }, _sum: { totalAmount: true }, _count: true }),
    ]);
    return { rateCards, invoices, usageCount, carrierPayables };
  });
  const customerAr = data.invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue), 0);

  return <div className="min-h-screen bg-surface-muted"><TmsSidebar accountName={context.accountName} roleNames={context.roleNames} permissions={context.permissions} isPlatformAdmin={context.isPlatformAdmin} />
    <main className="lg:ml-[240px] p-6 lg:p-10 space-y-8">
      <div><p className="text-xs font-bold uppercase tracking-widest text-brand">Transportation product line</p><h1 className="text-2xl font-extrabold text-ink">Customer Billing & AR</h1><p className="text-sm text-ink-muted mt-1">TMS usage, customer rate cards, and receivables share the platform billing ledger. Carrier invoices remain separate accounts payable.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">{[["TMS usage events", data.usageCount], ["Customer invoices", data.invoices.length], ["Customer AR", `$${customerAr.toFixed(2)}`], ["Carrier AP", `$${Number(data.carrierPayables._sum.totalAmount ?? 0).toFixed(2)}`]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-white border border-border p-5"><p className="text-xs text-ink-muted">{label}</p><p className="text-xl font-black text-ink mt-1">{value}</p></div>)}</div>
      <section className="space-y-3"><h2 className="font-extrabold text-ink">TMS rate cards</h2><div className="rounded-2xl bg-white border border-border divide-y divide-border">{data.rateCards.length ? data.rateCards.map((card) => <div key={card.id} className="flex justify-between px-5 py-4"><span className="font-bold">{card.name}</span><span className="text-xs text-ink-muted">{card.client?.name ?? "Account default"} · v{card.currentVersion} · {card.status}</span></div>) : <p className="px-5 py-6 text-sm text-ink-muted">No TMS customer rate card has been configured.</p>}</div></section>
      <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-extrabold text-ink">TMS customer invoices</h2><Link href="/invoices" className="text-xs font-bold text-brand hover:underline">Open carrier AP audit →</Link></div><div className="rounded-2xl bg-white border border-border divide-y divide-border">{data.invoices.length ? data.invoices.map((invoice) => <div key={invoice.id} className="flex justify-between px-5 py-4"><span><span className="font-mono text-xs font-bold">{invoice.invoiceNumber}</span><span className="ml-2 text-xs text-ink-muted">{invoice.client.name}</span></span><span className="font-mono text-xs">{invoice.status} · ${Number(invoice.balanceDue).toFixed(2)} due</span></div>) : <p className="px-5 py-6 text-sm text-ink-muted">No TMS customer invoices yet.</p>}</div></section>
    </main>
  </div>;
}
