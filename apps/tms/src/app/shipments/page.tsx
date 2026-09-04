import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@qubere/auth";
import { db, runWithAccountId } from "@qubere/db";
import { ShipmentsWorkbenchClient, type ShipmentListItem } from "./ShipmentsWorkbenchClient";
import { AccessDenied } from "@/components/AccessDenied";

export default async function ShipmentsListPage() {
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

  const rawShipments = await runWithAccountId(context.accountId, async () => {
    return await db.shipment
      .findMany({
        where: { accountId: context.accountId },
        orderBy: { createdAt: "desc" },
        include: {
          customsFilings: { orderBy: { createdAt: "desc" } },
          exceptionItems: { where: { status: "Open" } },
        },
      })
      .catch(() => []);
  });

  const initialShipments: ShipmentListItem[] = rawShipments.map((s) => ({
    id: s.id,
    shipmentNumber: s.shipmentNumber,
    importerName: s.importerName || "—",
    transportMode: s.transportMode || "OCEAN",
    countryOfExport: s.countryOfExport || "—",
    destinationCountry: s.destinationCountry || "—",
    estimatedArrival: s.estimatedArrival ? new Date(s.estimatedArrival).toISOString().split("T")[0] : "—",
    status: s.status || "PLANNED",
    readinessScore: s.status === "DELIVERED" ? 100 : s.exceptionItems?.length ? Math.max(30, 92 - s.exceptionItems.length * 15) : 92,
    customsStatus: s.customsFilings?.[0]?.filingStatus || "NOT_SUBMITTED",
    exceptionCount: s.exceptionItems?.length || 0,
  }));

  return <ShipmentsWorkbenchClient initialShipments={initialShipments} />;
}
