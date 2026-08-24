import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAccountContext, hasPermission } from "@/lib/auth";

export const revalidate = 0;

export default async function BillingClientsPage() {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/sign-in");
  if (!(await hasPermission("billing.read"))) redirect("/app/billing");

  const clients = await db.client.findMany({
    where: { accountId: ctx.accountId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      contactName: true,
      contactEmail: true,
      billingContactName: true,
      billingContactEmail: true,
      paymentTermsDays: true,
      _count: { select: { shipments: true, rateCards: true, invoices: true } },
      invoices: { select: { totalAmount: true, balanceDue: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">Client Billing Profiles</h2>
        <p className="text-sm text-ink-muted">Billing contacts, payment terms, rate-card coverage, invoice totals, and outstanding AR.</p>
      </div>
      <div className="rounded-2xl bg-white border border-[#E5E5EA] overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm text-ink">
          <thead className="bg-[#F5F5F7] text-ink-muted uppercase text-xs tracking-wider border-b border-[#E5E5EA]">
            <tr><th className="px-5 py-3">Client</th><th className="px-5 py-3">Billing contact</th><th className="px-5 py-3">Terms</th><th className="px-5 py-3">Coverage</th><th className="px-5 py-3">Invoiced</th><th className="px-5 py-3">Outstanding</th></tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5EA]">
            {clients.length === 0 ? <tr><td colSpan={6} className="px-5 py-8 text-center text-ink-muted">No clients found.</td></tr> : clients.map((client) => {
              const invoiced = client.invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
              const outstanding = client.invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue), 0);
              return <tr key={client.id} className="hover:bg-[#F9F9FB]">
                <td className="px-5 py-4"><Link href={`/app/billing/clients/${client.id}`} className="font-bold text-brand hover:underline">{client.name}</Link><div className="text-xs text-ink-muted">{client.status}</div></td>
                <td className="px-5 py-4 text-xs"><div>{client.billingContactName ?? client.contactName ?? "—"}</div><div className="text-ink-muted">{client.billingContactEmail ?? client.contactEmail ?? "No email"}</div></td>
                <td className="px-5 py-4 text-xs">Net {client.paymentTermsDays}</td>
                <td className="px-5 py-4 text-xs text-ink-muted">{client._count.rateCards} rate cards · {client._count.shipments} shipments</td>
                <td className="px-5 py-4 font-mono text-xs">${invoiced.toFixed(2)}</td>
                <td className="px-5 py-4 font-mono text-xs font-semibold text-amber-700">${outstanding.toFixed(2)}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
