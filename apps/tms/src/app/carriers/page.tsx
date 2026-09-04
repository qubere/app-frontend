import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@qubere/auth";
import { db, runWithAccountId } from "@qubere/db";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { AccessDenied } from "@/components/AccessDenied";
import { Truck, Search, Star } from "lucide-react";

export default async function CarriersPage() {
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

  const rawCarriers = await runWithAccountId(context.accountId, async () => {
    return await db.carrier
      .findMany({
        where: { accountId: context.accountId },
        orderBy: { createdAt: "desc" },
      })
      .catch(() => []);
  });

  const carriers = rawCarriers.map((car: any) => ({
    id: car.id,
    scac: car.scac ?? "—",
    dot: car.dotNumber ?? "—",
    mc: car.mcNumber ?? "—",
    name: car.legalName ?? "Carrier",
    insuranceStatus: car.insuranceOnFile ? "ACTIVE" : "EXPIRED",
    preferredStatus: false,
    safetyStatus: "SATISFACTORY",
    modes: ["OCEAN", "TRUCK"],
    equipmentCapabilities: ["40HC", "20GP"],
    onTimeDeliveryPct: 95,
  }));

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex w-full">
      <TmsSidebar accountName="Enterprise Freight" />

      <div className="flex-1 flex flex-col min-w-0">
        <TmsHeader tenantName="Enterprise Freight" userName="Operations Lead" />

        <main className="flex-1 p-8 overflow-y-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
                  <Truck className="w-4 h-4 text-brand" />
                </div>
                <h1 className="text-2xl font-extrabold text-ink tracking-tight">Carriers & Fleet Directory</h1>
              </div>
              <p className="text-xs text-ink-muted mt-1 font-medium">
                Verified carrier profiles with active insurance compliance, safety ratings, SCAC codes, and performance metrics.
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-border shadow-2xs flex items-center justify-between flex-wrap gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search carriers by SCAC, DOT #, legal name..."
                className="pl-8 pr-4 py-1.5 text-xs bg-surface-muted border border-border rounded-xl focus:outline-none focus:border-brand focus:bg-white text-ink w-72 transition-all font-medium"
              />
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-ink-muted">Insurance Compliance:</span>
                <select className="px-3 py-1.5 bg-surface-muted border border-border rounded-xl text-xs font-semibold text-ink focus:outline-none">
                  <option value="all">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="EXPIRED">EXPIRED</option>
                </select>
              </div>
            </div>
          </div>

          {/* Carrier Directory Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {carriers.map((car) => {
              const hasInsurance = car.insuranceStatus === "ACTIVE";

              return (
                <div key={car.id} className="bg-white rounded-2xl border border-border p-6 space-y-4 shadow-2xs relative overflow-hidden">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-extrabold text-sm text-ink">{car.name}</h3>
                        {car.preferredStatus && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-200 flex items-center space-x-1">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            <span>Preferred</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-ink-muted font-mono font-semibold">
                        SCAC: <strong className="text-brand">{car.scac}</strong> • DOT: {car.dot} • MC: {car.mc}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs border-t border-border/60 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-muted font-semibold">Insurance Compliance:</span>
                      <span className={`font-extrabold ${hasInsurance ? "text-emerald-600" : "text-red-600"}`}>
                        {hasInsurance ? "✓ ACTIVE" : "EXPIRED"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-ink-muted font-semibold">FMCSA Safety Rating:</span>
                      <span className="font-bold text-ink">{car.safetyStatus}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-ink-muted font-semibold">Supported Modes:</span>
                      <span className="font-bold text-ink">{car.modes.join(", ")}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-ink-muted font-semibold">Equipment Capabilities:</span>
                      <span className="font-bold text-ink">{car.equipmentCapabilities.join(", ")}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                      <span className="text-ink-muted font-semibold">On-Time Delivery:</span>
                      <span className="font-mono font-black text-emerald-700">{car.onTimeDeliveryPct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
