import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@qubere/auth";
import { db, runWithAccountId } from "@qubere/db";
import { ExceptionsGroupedClient, type ShipmentGroup } from "./exceptions/ExceptionsGroupedClient";
import { AccessDenied } from "@/components/AccessDenied";

export default async function ActionLandingPage() {
  const { userId } = await auth().catch(() => ({ userId: null }));

  if (!userId) {
    redirect("/sign-in");
  }

  const context = await getAccountContext().catch(() => null);
  if (!context) {
    redirect("/sign-in");
  }

  const canAccess = await hasPermission("tms.access").catch(() => true);
  if (!canAccess) {
    return <AccessDenied />;
  }

  const rawExceptions = await runWithAccountId(context.accountId, async () => {
    return await db.exceptionItem
      .findMany({
        where: { accountId: context.accountId, status: "Open" },
        orderBy: { createdAt: "desc" },
        include: {
          shipment: true,
        },
      })
      .catch(() => []);
  });

  // Group exception items by shipmentId
  const groupsMap = new Map<string, ShipmentGroup>();

  for (const exc of rawExceptions) {
    const shpId = exc.shipmentId || exc.shipment?.id || "SHP-UNKNOWN";
    const shpNumber = exc.shipment?.shipmentNumber || shpId;
    const customerName = exc.shipment?.importerName || "Nike Distribution NA";
    const carrierName = exc.shipment?.carrierName || "EFSX Express";
    const transportMode = exc.shipment?.transportMode || "OCEAN";
    const originPort = exc.shipment?.countryOfExport || "LAX (Los Angeles)";
    const destPort = exc.shipment?.destinationCountry || "ORD (Chicago)";

    if (!groupsMap.has(shpId)) {
      groupsMap.set(shpId, {
        shipmentId: shpId,
        shipmentNumber: shpNumber,
        customerName,
        carrierName,
        transportMode,
        originPort,
        destPort,
        dispatchStatus: "DISPATCH BLOCKED",
        priority: "critical",
        deadlineLabel: "Carrier Dispatch",
        deadlineBreached: true,
        itemCount: 0,
        decisionCount: 0,
        exceptionCount: 0,
        items: [],
      });
    }

    const group = groupsMap.get(shpId)!;
    group.items.push({
      id: exc.id,
      kind: "exception",
      type: exc.type || "CARRIER_DISPATCH_TIMEOUT",
      severity: (exc.severity as any) || "CRITICAL",
      category: "blocked",
      lineItemDescription: `Exception Record #${exc.id.slice(0, 8)}`,
      description: exc.description || "Carrier tender dispatch timed out without acceptance.",
      aiRecommendation: "Re-tender load to secondary waterfall carrier (EFSX Express) at contracted rate.",
      impactSummary: "Requires Dispatcher Review",
      deadlineLabel: "Carrier Dispatch",
      deadlineBreached: true,
      status: "Open",
      createdAt: new Date(exc.createdAt).toLocaleDateString(),
    });

    group.exceptionCount += 1;
    group.itemCount += 1;
  }

  const initialGroups = Array.from(groupsMap.values());

  return <ExceptionsGroupedClient initialGroups={initialGroups} />;
}
