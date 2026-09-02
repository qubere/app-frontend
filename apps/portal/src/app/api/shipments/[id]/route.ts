import { buildShipmentProgress, shipmentProgressInclude } from "@/lib/shipment-progress";
import { shipmentReadPermission } from "@/lib/shipment-access";
import { withPortalAccount } from "@/lib/portal-scope";
import { NextResponse } from "next/server";
import { authorizePortalResource, hasRequiredPortalPermission } from "@qubere/auth";
import { db, mapPortalShipmentStatus } from "@qubere/db";

export const GET = withPortalAccount(async (ctx, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const url = new URL(req.url);
  const section = url.searchParams.get("section") || "overview";
  const page = Number(url.searchParams.get("page") || "0");
  if (!["overview", "tracking", "documents", "invoices"].includes(section) || !Number.isSafeInteger(page) || page < 0 || page > 10000) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  // Fetch target shipment metadata for authorization check
  const rawShipment = await db.shipment.findUnique({
    where: { id, accountId: ctx.accountId, deletedAt: null },
    select: { id: true, accountId: true, clientId: true, importerName: true, productWorkspaces: { select: { product: true, status: true } } },
  });

  if (!rawShipment) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const auth = await authorizePortalResource({
    permission: shipmentReadPermission(ctx, rawShipment.productWorkspaces),
    resourceAccountId: rawShipment.accountId,
    resourceClientId: rawShipment.clientId,
    importerName: rawShipment.importerName,
  });

  if (!auth.authorized || auth.errorResponse) {
    return auth.errorResponse || NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const canReadEntries = hasRequiredPortalPermission(ctx, "portal.entries.read");
  const pageSize = 50;
  if (section === "documents") {
    const documents = await db.shipmentDocument.findMany({
      where: { shipmentId: id, accountId: ctx.accountId, portalVisibility: "CUSTOMER" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: page * pageSize, take: pageSize + 1,
      select: { id: true, fileName: true, docType: true, status: true, createdAt: true },
    });
    return NextResponse.json({ documents: documents.slice(0, pageSize).map(d => ({ ...d, status: d.status === "Received" ? "Ready" : "Processing" })), hasMore: documents.length > pageSize });
  }
  if (section === "invoices") {
    const invoices = await db.invoice.findMany({
      where: { accountId: ctx.accountId, clientId: auth.effectiveClientId!, status: { in: ["SENT", "PAID", "OVERDUE", "PARTIALLY_PAID"] }, lines: { some: { shipmentId: id } } },
      orderBy: [{ issueDate: "desc" }, { id: "desc" }], skip: page * pageSize, take: pageSize + 1,
      select: { id: true, invoiceNumber: true, status: true, issueDate: true, dueDate: true, totalAmount: true },
    });
    return NextResponse.json({ invoices: invoices.slice(0, pageSize).map(i => ({ ...i, totalAmount: Number(i.totalAmount) })), hasMore: invoices.length > pageSize });
  }
  if (section === "tracking") {
    const tracking = await db.shipment.findUnique({
      where: { id, accountId: ctx.accountId, deletedAt: null },
      select: { ...shipmentProgressInclude, currentStage: true, stageStatus: true, estimatedArrival: true, lastFreeDay: true },
    });
    if (!tracking) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ progress: { ...buildShipmentProgress(tracking), ...(!canReadEntries ? { workflow: [], currentStage: null } : {}) } });
  }
  // Only the header, milestone stepper, request titles, and published entry metadata
  // are needed on first paint. Conversations, tracking history and tab collections
  // are loaded separately; never fetch the full Shipment row or proof JSON here.
  const { trackingEvents: _events, trackingIdentifiers: _references, etaObservations: _eta, ...milestones } = shipmentProgressInclude;
  const shipment = await db.shipment.findUnique({
    where: { id, accountId: ctx.accountId, deletedAt: null },
    select: {
      id: true, shipmentNumber: true, status: true, poReference: true, importerName: true,
      countryOfOrigin: true, countryOfExport: true, destinationCountry: true, portOfEntry: true,
      entryType: true, incoterm: true, invoiceCurrency: true, transportMode: true, carrierName: true,
      estimatedArrival: true, arrivalDate: true, ladingDate: true, lastFreeDay: true, currentStage: true, stageStatus: true,
      ...milestones,
      customsFilings: {
        where: { customerVisibleAt: { not: null }, ...(!canReadEntries ? { id: { in: [] } } : {}) },
        orderBy: { createdAt: "desc" },
        select: { id: true, entryNumber: true, entryType: true, country: true, procedureCode: true,
          filingType: true, filingStatus: true, totalDuties: true, totalTaxes: true, customerVisibleAt: true },
      },
      customerRequests: {
        where: { accountId: ctx.accountId, clientId: auth.effectiveClientId! },
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, title: true, status: true, dueAt: true, version: true },
      },
    },
  });

  if (!shipment) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // A not-yet-updated proof model must not hide existing shipment data.
  let proofUnavailable: boolean = canReadEntries && !db.entryProof?.findMany;
  const proofs = canReadEntries && !proofUnavailable && shipment.customsFilings.length
    ? await db.entryProof.findMany({
        where: { accountId: ctx.accountId, clientId: auth.effectiveClientId!, status: "PUBLISHED", filingId: { in: shipment.customsFilings.map(f => f.id) } },
        orderBy: { version: "desc" }, select: { filingId: true, scoreOverall: true, scoreBand: true, linesTotal: true },
      }).catch(error => { proofUnavailable = true; console.error("[portal] Shipment proof unavailable; tracking and requests remain available.", error); return []; })
    : [];
  const proofByFiling = new Map(proofs.map(p => [p.filingId, p]));

  const filingStatus = shipment.customsFilings[0]?.filingStatus || null;
  const mapped = mapPortalShipmentStatus({
    internalStatus: shipment.status,
    filingStatus,
    openCustomerRequestCount: shipment.customerRequests.filter((r) => r.status === "OPEN").length,
  });

  return NextResponse.json({
    unavailableSections: proofUnavailable ? ["Entry Proof"] : [],
    progress: { ...buildShipmentProgress({ ...shipment, trackingEvents: [], trackingIdentifiers: [], etaObservations: [] }), ...(!canReadEntries ? { workflow: [], currentStage: null } : {}) },
    filingData: canReadEntries ? {
      importerName: shipment.importerName, countryOfOrigin: shipment.countryOfOrigin, countryOfExport: shipment.countryOfExport,
      destinationCountry: shipment.destinationCountry, portOfEntry: shipment.portOfEntry, entryType: shipment.entryType,
      incoterm: shipment.incoterm, invoiceCurrency: shipment.invoiceCurrency,
    } : null,
    overview: {
      id: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      poReference: shipment.poReference,
      importerName: shipment.importerName,
      origin: shipment.trackingStops[0]?.name || shipment.countryOfExport || shipment.portOfEntry || "Origin",
      destination: shipment.trackingStops.at(-1)?.name || shipment.destinationCountry || "USA",
      transportMode: shipment.transportMode || "Ocean",
      carrierName: shipment.carrierName,
      estimatedArrival: shipment.estimatedArrival,
      arrivalDate: shipment.arrivalDate,
      ladingDate: shipment.ladingDate,
      transportationStatus: mapped.transportationStatus,
      customsStatus: mapped.customsStatus,
    },
    requests: shipment.customerRequests.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      status: r.status,
      dueAt: r.dueAt,
      version: r.version,
    })),
    entries: shipment.customsFilings.map((f) => { const proof = proofByFiling.get(f.id); return ({
      id: f.id,
      entryNumber: f.entryNumber,
      entryType: f.entryType,
      country: f.country,
      procedureCode: f.procedureCode,
      filingType: f.filingType,
      status: f.filingStatus,
      dutyTotal: f.totalDuties ? Number(f.totalDuties) : null,
      taxTotal: f.totalTaxes ? Number(f.totalTaxes) : null,
      publishedAt: f.customerVisibleAt,
      proof: proof ? { available: true, scoreOverall: proof.scoreOverall, scoreBand: proof.scoreBand, linesTotal: proof.linesTotal } : null,

    }); }),
  });
});
