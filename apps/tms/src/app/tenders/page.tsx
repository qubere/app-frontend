import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@qubere/auth";
import { db, runWithAccountId } from "@qubere/db";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { AccessDenied } from "@/components/AccessDenied";
import { FileCheck2, Search } from "lucide-react";

export default async function TendersPage() {
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

  const tenders = await runWithAccountId(context.accountId, async () => {
    return await db.tender
      .findMany({
        where: { accountId: context.accountId },
        orderBy: { createdAt: "desc" },
        include: {
          freightQuote: true,
          shipment: true,
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
                <h1 className="text-2xl font-extrabold text-ink tracking-tight">Carrier Tenders & Booking Dispatch</h1>
              </div>
              <p className="text-xs text-ink-muted mt-1 font-medium">
                Review tender drafts and verified carrier-response lifecycle events.
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-border shadow-2xs flex items-center justify-between flex-wrap gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search tenders by carrier ID, shipment #..."
                className="pl-8 pr-4 py-1.5 text-xs bg-surface-muted border border-border rounded-xl focus:outline-none focus:border-brand focus:bg-white text-ink w-72 transition-all font-medium"
              />
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-ink-muted">Tender Status:</span>
                <select className="px-3 py-1.5 bg-surface-muted border border-border rounded-xl text-xs font-semibold text-ink focus:outline-none">
                  <option value="all">All Statuses</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="SENT">SENT</option>
                  <option value="ACCEPTED">ACCEPTED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="EXPIRED">EXPIRED</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tenders Table */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-2xs">
            {tenders.length === 0 ? (
              <div className="p-12 text-center text-xs text-ink-muted font-medium bg-surface-muted rounded-xl border border-dashed border-border space-y-2">
                <p className="font-bold text-ink">No carrier tenders yet.</p>
                <p>Drafts remain unsent until a configured carrier provider acknowledges delivery.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Tender ID</th>
                      <th className="py-3 px-4">Carrier</th>
                      <th className="py-3 px-4">Shipment / Quote</th>
                      <th className="py-3 px-4">Sent At</th>
                      <th className="py-3 px-4">Expires At</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-medium text-ink">
                    {tenders.map((t) => {
                      const isSent = t.status === "SENT";
                      const isAccepted = t.status === "ACCEPTED";
                      const isRejected = t.status === "REJECTED";
                      const isExpired = t.status === "EXPIRED";

                      return (
                        <tr key={t.id} className="hover:bg-surface-muted/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-brand">{t.id.slice(0, 10)}</td>
                          <td className="py-3.5 px-4 font-semibold">{t.carrierId}</td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-ink-muted">
                            {t.shipment?.shipmentNumber ?? t.freightQuoteId?.slice(0, 10) ?? "—"}
                          </td>
                          <td className="py-3.5 px-4 text-ink-muted">
                            {t.sentAt ? new Date(t.sentAt).toLocaleTimeString() : "Pending"}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-ink">
                            {t.expiresAt ? new Date(t.expiresAt).toLocaleTimeString() : "—"}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              isAccepted
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : isSent
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : isRejected
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : isExpired
                                      ? "bg-red-50 text-red-700 border-red-200"
                                      : "bg-slate-50 text-slate-700 border-slate-200"
                            }`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {t.cascadeAttempt > 0 && (
                              <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                Fallback Draft #{t.cascadeAttempt}
                              </span>
                            )}
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
