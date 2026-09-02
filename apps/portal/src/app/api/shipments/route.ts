import { withPortalAccount } from "@/lib/portal-scope";
import { NextResponse } from "next/server";
import { getEffectiveUserScope, resolvePortalClientScope } from "@qubere/auth";
import { db, mapPortalShipmentStatus } from "@qubere/db";

export const GET = withPortalAccount(async (ctx, req: Request) => {

  const scope = await getEffectiveUserScope(ctx.userId, ctx.accountId, ctx.roleNames || []);
  const url = new URL(req.url);
  const query = url.searchParams.get("query") || "";
  const cursor = url.searchParams.get("cursor") || undefined;
  const limit = Math.min(Number(url.searchParams.get("limit")) || 25, 50);
  const clientId = url.searchParams.get("clientId");

  const clientScope = resolvePortalClientScope(scope, clientId);
  if (clientScope.forbidden) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const whereClause: any = {
    deletedAt: null,
    accountId: ctx.accountId,
  };

  if (clientScope.clientIds !== null) {
    whereClause.clientId = { in: clientScope.clientIds };
  }

  if (query) {
    whereClause.AND = [
      {
        OR: [
          { shipmentNumber: { contains: query, mode: "insensitive" as const } },
          { poReference: { contains: query, mode: "insensitive" as const } },
          { importerName: { contains: query, mode: "insensitive" as const } },
        ],
      },
    ];
  }

  const shipments = await db.shipment.findMany({
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: "desc" },
    where: whereClause,
    include: {
      customsFilings: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { filingStatus: true },
      },
      customerRequests: {
        where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
        select: { id: true },
      },
    },
  });

  let nextCursor: string | undefined = undefined;
  if (shipments.length > limit) {
    const nextItem = shipments.pop();
    nextCursor = nextItem?.id;
  }

  const items = shipments.map((shp) => {
    const filingStatus = shp.customsFilings[0]?.filingStatus || null;
    const mapped = mapPortalShipmentStatus({
      internalStatus: shp.status,
      filingStatus,
      openCustomerRequestCount: shp.customerRequests.length,
    });

    return {
      id: shp.id,
      shipmentNumber: shp.shipmentNumber,
      poReference: shp.poReference,
      origin: shp.countryOfExport || shp.portOfEntry || "Origin",
      destination: shp.destinationCountry || "USA",
      mode: shp.transportMode || "Ocean",
      carrierName: shp.carrierName,
      estimatedArrival: shp.estimatedArrival,
      transportationStatus: mapped.transportationStatus,
      customsStatus: mapped.customsStatus,
      hasCustomerActionRequired: mapped.hasCustomerActionRequired,
      actionRequiredCount: mapped.actionRequiredCount,
      updatedAt: shp.updatedAt,
    };
  });

  return NextResponse.json({
    items,
    nextCursor,
  });
});
