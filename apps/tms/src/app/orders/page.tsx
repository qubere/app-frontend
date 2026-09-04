import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@qubere/auth";
import { db, runWithAccountId } from "@qubere/db";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { AccessDenied } from "@/components/AccessDenied";
import Link from "next/link";
import { Package, Search, ArrowUpRight } from "lucide-react";
import { IntakeParserClientForm } from "@/components/IntakeParserClientForm";

export default async function OrdersPage() {
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

  const orders = await runWithAccountId(context.accountId, async () => {
    return await db.transportationOrder
      .findMany({
        where: { accountId: context.accountId },
        orderBy: { createdAt: "desc" },
        include: {
          client: true,
          agentDecision: true,
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
                <Package className="w-5 h-5 text-brand" />
                <h1 className="text-2xl font-extrabold text-ink tracking-tight">Inbound Freight Orders & Intake</h1>
              </div>
              <p className="text-xs text-ink-muted mt-1 font-medium">
                Parsing of email body text, quotation requests, and trade documents into structured transportation orders.
              </p>
            </div>
          </div>

          {/* Interactive AI Intake Parser Simulator */}
          <IntakeParserClientForm />

          {/* Orders Table */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-sm tracking-tight text-ink">Parsed Transportation Orders Queue</h2>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  className="pl-8 pr-4 py-1.5 text-xs bg-surface-muted border border-border rounded-xl focus:outline-none focus:border-brand focus:bg-white text-ink w-64 transition-all font-medium"
                />
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="p-12 text-center text-xs text-ink-muted font-medium bg-surface-muted rounded-xl border border-dashed border-border space-y-2">
                <p className="font-bold text-ink">No transportation orders ingested yet.</p>
                <p>Submit an inbound email or quotation request using the form above to ingest an order.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-ink-muted font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Requested By</th>
                      <th className="py-3 px-4">Mode / Equipment</th>
                      <th className="py-3 px-4">Origin / Dest</th>
                      <th className="py-3 px-4">Confidence</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-medium text-ink">
                    {orders.map((ord) => {
                      const isUnderstood = ord.status === "UNDERSTOOD";

                      return (
                        <tr key={ord.id} className="hover:bg-surface-muted/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-brand">{ord.id.slice(0, 10)}</td>
                          <td className="py-3.5 px-4 font-semibold">{ord.requestedBy ?? ord.client?.name ?? "—"}</td>
                          <td className="py-3.5 px-4 font-semibold text-ink-muted">
                            {ord.mode ?? "OCEAN"} • {((ord.equipmentRequirements as string[]) ?? ["40HC"])[0]}
                          </td>
                          <td className="py-3.5 px-4">
                            {(ord.origin as any)?.unlocode ?? "—"} → {(ord.destination as any)?.unlocode ?? "—"}
                          </td>
                          <td className="py-3.5 px-4 font-extrabold text-brand">{ord.confidence != null ? `${ord.confidence}%` : "—"}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              isUnderstood
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : ord.status === "NEEDS_REVIEW"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}>
                              {ord.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Link
                              href="/quotes"
                              className="px-3 py-1 rounded-xl bg-surface-muted border border-border text-xs font-bold hover:bg-brand hover:text-white transition-all inline-flex items-center space-x-1"
                            >
                              <span>Quote Order</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
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
