import { freightReadPermission } from "@/lib/shipment-access";
import { withPortalAccount } from "@/lib/portal-scope";
import { NextResponse } from "next/server";
import { getPortalWorkspaceScope, resolvePortalClientScope, hasRequiredPortalPermission } from "@qubere/auth";
import { db, mapPortalShipmentStatus } from "@qubere/db";
import { loadImporterOwners, shipmentClientWhere } from "@/lib/client-ownership";

export const GET = withPortalAccount(async (ctx, req: Request) => {

  const scope = await getPortalWorkspaceScope(ctx);
  const url = new URL(req.url);
  const workspace = url.searchParams.get("workspace");
  if (workspace && workspace !== "TMS") return NextResponse.json({ error: "INVALID_WORKSPACE" }, { status: 400 });
  const permission = workspace === "TMS" ? freightReadPermission(ctx) : "portal.shipments.read";
  if (!hasRequiredPortalPermission(ctx, permission)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const query = url.searchParams.get("query") || "";
  const cursor = url.searchParams.get("cursor") || undefined;
  const limit = Math.min(Number(url.searchParams.get("limit")) || 25, 50);
  if (!Number.isSafeInteger(limit) || limit < 1) return NextResponse.json({ error: 'INVALID_LIMIT' }, { status: 400 });
  const clientId = url.searchParams.get("clientId");

  const clientScope = resolvePortalClientScope(scope, clientId);
  if (clientScope.forbidden) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const whereClause: any = {
    deletedAt: null,
    accountId: ctx.accountId,
    ...(workspace === "TMS" ? { productWorkspaces: { some: { product: "TMS", status: "ACTIVE" } } } : {}),
  };

  const owners = await loadImporterOwners(ctx.accountId, clientScope.clientIds);
  Object.assign(whereClause, shipmentClientWhere(clientScope.clientIds, owners));

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
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: whereClause,
    select: {
      id: true, shipmentNumber: true, poReference: true, countryOfExport: true, portOfEntry: true,
      destinationCountry: true, transportMode: true, carrierName: true, estimatedArrival: true,
      status: true, updatedAt: true,
      trackingStops: { orderBy: { sequence: "asc" }, select: { name: true } },
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
      origin: shp.trackingStops[0]?.name || shp.countryOfExport || shp.portOfEntry || "Origin",
      destination: shp.trackingStops.at(-1)?.name || shp.destinationCountry || "USA",
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
