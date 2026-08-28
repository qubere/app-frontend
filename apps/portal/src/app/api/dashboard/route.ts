import { NextResponse } from "next/server";
import { getAccountContext, getEffectiveUserScope } from "@qubere/auth";
import { db, mapPortalShipmentStatus } from "@qubere/db";

export async function GET(req: Request) {
  const ctx = await getAccountContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const scope = await getEffectiveUserScope(ctx.userId, ctx.accountId, ctx.roleNames || []);
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId");

  const clientFilter = clientId
    ? { clientId }
    : scope.isAllClients || scope.authorizedClientIds.length === 0
      ? {}
      : { clientId: { in: scope.authorizedClientIds } };

  // Fetch open customer action requests for "Needs your attention"
  const rawActionRequests = await db.customerRequest.findMany({
    take: 10,
    orderBy: { dueAt: "asc" },
    where: {
      accountId: ctx.accountId,
      ...clientFilter,
      status: "OPEN",
    },
    include: {
      shipment: {
        select: {
          id: true,
          shipmentNumber: true,
          estimatedArrival: true,
        },
      },
    },
  });

  const actionItems = rawActionRequests.map((r) => {
    let actionTargetUrl = `/requests/${r.id}`;
    if (r.shipmentId) {
      actionTargetUrl = `/shipments/${r.shipmentId}`;
    }

    return {
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      status: r.status,
      dueAt: r.dueAt,
      shipmentId: r.shipmentId,
      shipmentNumber: r.shipment?.shipmentNumber,
      estimatedArrival: r.shipment?.estimatedArrival,
      domain: r.domain,
      targetUrl: actionTargetUrl,
    };
  });

  // Fetch active shipments
  const rawShipments = await db.shipment.findMany({
    take: 6,
    orderBy: { createdAt: "desc" },
    where: {
      accountId: ctx.accountId,
      ...clientFilter,
      status: { notIn: ["Completed", "Cancelled"] },
    },
    include: {
      customerRequests: {
        where: { status: "OPEN" },
        select: { id: true },
      },
      customsFilings: {
        select: { filingStatus: true },
      },
    },
  });

  const activeShipments = rawShipments.map((s) => {
    const { transportationStatus, customsStatus } = mapPortalShipmentStatus({
      internalStatus: s.status,
      filingStatus: s.customsFilings[0]?.filingStatus,
      openCustomerRequestCount: s.customerRequests.length,
    });

    return {
      id: s.id,
      shipmentNumber: s.shipmentNumber,
      poReference: s.poReference,
      origin: `${s.countryOfExport} - ${s.portOfEntry || "Origin"}`,
      destination: s.destinationCountry || "US",
      estimatedArrival: s.estimatedArrival,
      transportationStatus,
      customsStatus,
      actionRequiredCount: s.customerRequests.length,
    };
  });

  // Fetch recent published documents
  const rawFiles = await db.shipmentDocument.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    where: {
      accountId: ctx.accountId,
      ...clientFilter,
      portalVisibility: "CUSTOMER",
    },
  });

  const recentFiles = rawFiles.map((f) => ({
    id: f.id,
    fileName: f.fileName,
    docType: f.docType,
    createdAt: f.createdAt,
    shipmentId: f.shipmentId,
  }));

  return NextResponse.json({
    actionItems,
    activeShipments,
    recentFiles,
  });
}
