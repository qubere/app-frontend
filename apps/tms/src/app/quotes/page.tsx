import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@qubere/auth";
import { db, runWithAccountId } from "@qubere/db";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { AccessDenied } from "@/components/AccessDenied";
import { FileCheck2, Search } from "lucide-react";

export default async function QuotesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const context = await getAccountContext();
  if (!context) {
    redirect("/sign-in");
  }

  const canAccess = await hasPermission("tms.access");
  if (!canAccess) {
    return <AccessDenied />;
  }

  const quotes = await runWithAccountId(context.accountId, async () => {
    return await db.freightQuote
      .findMany({
        where: { accountId: context.accountId },
        orderBy: { createdAt: "desc" },
        include: {
          transportationOrder: true,
          client: true,
        },
      })
      .catch(() => []);
  });

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex w-full">
      <TmsSidebar accountName="Enterprise Freight" />

      <div className="flex-1 flex flex-col min-w-0">
        <TmsHeader tenantName="Enterprise Freight" userName="Operations Lead" />

        <main className="flex-1 p-8 overflow-y-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <FileCheck2 className="w-5 h-5 text-brand" />
                <h1 className="text-2xl font-extrabold text-ink tracking-tight">Freight Quotes & Rate Management</h1>
              </div>
              <p className="text-xs text-ink-muted mt-1 font-medium">
                Automated rate engine matching, buy/sell margin calculations, customer pricing rules, and quote-to-shipment conversion.
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-border shadow-2xs flex items-center justify-between flex-wrap gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search quotes by carrier, lane, customer..."
                className="pl-8 pr-4 py-1.5 text-xs bg-surface-muted border border-border rounded-xl focus:outline-none focus:border-brand focus:bg-white text-ink w-72 transition-all font-medium"
              />
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-ink-muted">Approval State:</span>
                <select className="px-3 py-1.5 bg-surface-muted border border-border rounded-xl text-xs font-semibold text-ink focus:outline-none">
                  <option value="all">All States</option>
                  <option value="AUTO_APPROVED">AUTO_APPROVED</option>
                  <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quotes Table */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-2xs">
            {quotes.length === 0 ? (
              <div className="p-12 text-center text-xs text-ink-muted font-medium bg-surface-muted rounded-xl border border-dashed border-border space-y-2">
                <p className="font-bold text-ink">No quotes generated yet.</p>
                <p>Use the Rate Engine to evaluate an RFQ / TransportationOrder into a customer quote.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Quote #</th>
                      <th className="py-3 px-4">Carrier</th>
                      <th className="py-3 px-4">Mode / Equipment</th>
                      <th className="py-3 px-4">Buy Cost</th>
                      <th className="py-3 px-4">Markup %</th>
                      <th className="py-3 px-4">Customer Sell</th>
                      <th className="py-3 px-4">Net Margin</th>
                      <th className="py-3 px-4">Approval State</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-medium text-ink">
                    {quotes.map((q) => {
                      const isAutoApproved = q.approvalState === "AUTO_APPROVED";

                      return (
                        <tr key={q.id} className="hover:bg-surface-muted/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-brand">{q.id.slice(0, 10)}</td>
                          <td className="py-3.5 px-4 font-semibold">{q.carrierName ?? "MSC Lines"}</td>
                          <td className="py-3.5 px-4 font-semibold text-ink-muted">
                            {q.mode} • {q.equipment ?? "40HC"}
                          </td>
                          <td className="py-3.5 px-4 text-ink-muted">${Number(q.buyAmount).toLocaleString()}</td>
                          <td className="py-3.5 px-4 font-bold text-brand">{Number(q.markupPercentage)}%</td>
                          <td className="py-3.5 px-4 font-black text-ink">${Number(q.sellAmount).toLocaleString()}</td>
                          <td className="py-3.5 px-4 font-black text-emerald-600">${Number(q.margin).toLocaleString()}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              isAutoApproved
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {isAutoApproved ? "✓ Auto Approved" : "Needs Supervisor Review"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                              {q.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
