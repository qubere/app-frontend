import type { EntryProofPayload } from "@qubere/entry-proof";
import { buildShipmentProgress, shipmentProgressInclude } from "@/lib/shipment-progress";
import { shipmentReadPermission } from "@/lib/shipment-access";
import { withPortalAccount } from "@/lib/portal-scope";
import { NextResponse } from "next/server";
import { authorizePortalResource, hasRequiredPortalPermission } from "@qubere/auth";
import { db, mapPortalShipmentStatus } from "@qubere/db";

export const GET = withPortalAccount(async (ctx, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

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
  const shipment = await db.shipment.findUnique({
    where: { id, accountId: ctx.accountId, deletedAt: null },
    include: {
      ...shipmentProgressInclude,
      customsFilings: {
        where: { customerVisibleAt: { not: null }, ...(!canReadEntries ? { id: { in: [] } } : {}) },
        select: {
          id: true,
          entryNumber: true,
          entryType: true,
          country: true,
          procedureCode: true,
          filingType: true,
          filingStatus: true,
          totalDuties: true,
          totalTaxes: true,
          customerVisibleAt: true,
        },
      },
      documents: {
        where: { portalVisibility: "CUSTOMER" },
        select: {
          id: true,
          fileName: true,
          docType: true,
          status: true,
          createdAt: true,
        },
      },
      customerRequests: {
        where: { accountId: ctx.accountId, clientId: auth.effectiveClientId! },
        orderBy: { createdAt: "desc" },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              authorType: true,
              body: true,
              createdAt: true,
            },
          },
        },
      },
      invoiceLines: {
        where: { invoice: { accountId: ctx.accountId, clientId: auth.effectiveClientId! } },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              issueDate: true,
              dueDate: true,
              totalAmount: true,
            },
          },
        },
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
        orderBy: { version: "desc" }, select: { filingId: true, payload: true, scoreOverall: true, scoreBand: true },
      }).catch(error => { proofUnavailable = true; console.error("[portal] Shipment proof unavailable; tracking and requests remain available.", error); return []; })
    : [];
  const proofByFiling = new Map(proofs.map(p => [p.filingId, p]));

  const filingStatus = shipment.customsFilings[0]?.filingStatus || null;
  const mapped = mapPortalShipmentStatus({
    internalStatus: shipment.status,
    filingStatus,
    openCustomerRequestCount: shipment.customerRequests.filter((r) => r.status === "OPEN").length,
  });

  // Unique issued customer invoices for this shipment
  const invoicesMap = new Map<string, any>();
  for (const line of shipment.invoiceLines) {
    if (
      line.invoice &&
      ["ISSUED", "SENT", "PAID", "OVERDUE", "PARTIALLY_PAID"].includes(line.invoice.status)
    ) {
      invoicesMap.set(line.invoice.id, {
        id: line.invoice.id,
        invoiceNumber: line.invoice.invoiceNumber,
        issueDate: line.invoice.issueDate,
        dueDate: line.invoice.dueDate,
        totalAmount: Number(line.invoice.totalAmount),
        status: line.invoice.status,
      });
    }
  }

  return NextResponse.json({
    unavailableSections: proofUnavailable ? ["Entry Proof"] : [],
    progress: { ...buildShipmentProgress(shipment), ...(!canReadEntries ? { workflow: [], currentStage: null } : {}) },
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
      description: r.description,
      status: r.status,
      dueAt: r.dueAt,
      version: r.version,
      messages: r.messages,
    })),
    documents: shipment.documents.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      docType: d.docType,
      status: d.status === "Received" ? "Ready" : "Processing",
      createdAt: d.createdAt,
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
      proof: proof ? { available: true, scoreOverall: proof.scoreOverall, scoreBand: proof.scoreBand } : null,
      lines: proof ? (proof.payload as unknown as EntryProofPayload).lines.map(l => ({ lineNumber: l.lineNumber, description: l.description, htsCode: l.htsCode, countryOfOrigin: l.countryOfOrigin, quantity: l.quantity, enteredValueUsd: l.enteredValueUsd, lineDutyTotalUsd: l.lineDutyTotalUsd, dutyComplete: l.dutyStack.every(d => !['NOT_EVALUATED', 'DATA_UNAVAILABLE', 'REVIEW_REQUIRED'].includes(d.status)) })) : [],
    }); }),
    invoices: Array.from(invoicesMap.values()),
  });
});
