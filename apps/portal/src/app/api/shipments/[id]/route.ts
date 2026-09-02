import { withPortalAccount } from "@/lib/portal-scope";
import { NextResponse } from "next/server";
import { authorizePortalResource } from "@qubere/auth";
import { db, mapPortalShipmentStatus } from "@qubere/db";

export const GET = withPortalAccount(async (ctx, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  // Fetch target shipment metadata for authorization check
  const rawShipment = await db.shipment.findUnique({
    where: { id, accountId: ctx.accountId, deletedAt: null },
    select: { id: true, accountId: true, clientId: true, importerName: true },
  });

  if (!rawShipment) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const auth = await authorizePortalResource({
    permission: "portal.shipments.read",
    resourceAccountId: rawShipment.accountId,
    resourceClientId: rawShipment.clientId,
    importerName: rawShipment.importerName,
  });

  if (!auth.authorized || auth.errorResponse) {
    return auth.errorResponse || NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const shipment = await db.shipment.findUnique({
    where: { id, accountId: ctx.accountId, deletedAt: null },
    include: {
      customsFilings: {
        where: { customerVisibleAt: { not: null } },
        select: {
          id: true,
          entryNumber: true,
          entryType: true,
          filingStatus: true,
          totalDuties: true,
          totalTaxes: true,
          customerVisibleAt: true,
          entryProofs: { where: { status: "PUBLISHED" }, orderBy: { version: "desc" }, take: 1, select: { scoreOverall: true, scoreBand: true, linesVerified: true, linesTotal: true, openFindingsCount: true, dutySavingsIdentifiedUsd: true } },
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
    overview: {
      id: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      poReference: shipment.poReference,
      importerName: shipment.importerName,
      origin: shipment.countryOfExport || shipment.portOfEntry || "Origin",
      destination: shipment.destinationCountry || "USA",
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
    entries: shipment.customsFilings.map((f) => ({
      id: f.id,
      entryNumber: f.entryNumber,
      entryType: f.entryType,
      status: f.filingStatus === "Released" ? "Released" : "Filed with customs",
      dutyTotal: f.totalDuties ? Number(f.totalDuties) : null,
      taxTotal: f.totalTaxes ? Number(f.totalTaxes) : null,
      publishedAt: f.customerVisibleAt,
      proof: f.entryProofs[0] ? { available: true, ...f.entryProofs[0], dutySavingsIdentifiedUsd: Number(f.entryProofs[0].dutySavingsIdentifiedUsd) } : null,
    })),
    invoices: Array.from(invoicesMap.values()),
  });
});
