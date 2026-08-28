import { db } from "../index";

export interface PortalEntryDto {
  id: string;
  entryNumber: string;
  shipmentId: string | null;
  shipmentReference: string | null;
  importerName: string;
  entryType: string | null;
  filingStatus: string;
  customerVisibleAt: Date;
  dutyTotal: number | null;
  taxTotal: number | null;
  totalValue: number | null;
  createdAt: Date;
}

/**
 * Retrieves customer-published entry summaries for a client.
 * Strictly excludes unpublished/draft entries, raw CBP message logs, internal notes, and agent data.
 */
export async function getCustomerPublishedEntries(params: {
  accountId: string;
  clientId?: string;
  shipmentId?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: PortalEntryDto[]; nextCursor?: string }> {
  const { accountId, clientId, shipmentId, limit = 25, cursor } = params;

  const filings = await db.customsFiling.findMany({
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: "desc" },
    where: {
      accountId,
      customerVisibleAt: { not: null },
      ...(clientId ? { shipment: { clientId } } : {}),
      ...(shipmentId ? { shipmentId } : {}),
    },
    include: {
      shipment: {
        select: {
          id: true,
          shipmentNumber: true,
          importerName: true,
        },
      },
      importerOfRecord: {
        select: { name: true },
      },
    },
  });

  let nextCursor: string | undefined = undefined;
  if (filings.length > limit) {
    const nextItem = filings.pop();
    nextCursor = nextItem?.id;
  }

  const items: PortalEntryDto[] = filings.map((f) => ({
    id: f.id,
    entryNumber: f.entryNumber,
    shipmentId: f.shipmentId,
    shipmentReference: f.shipment?.shipmentNumber || null,
    importerName: f.importerOfRecord?.name || f.shipment?.importerName || "Importer",
    entryType: f.entryType,
    filingStatus: f.filingStatus === "Released" ? "Released" : "Filed with customs",
    customerVisibleAt: f.customerVisibleAt!,
    dutyTotal: f.totalDuties ? Number(f.totalDuties) : null,
    taxTotal: f.totalTaxes ? Number(f.totalTaxes) : null,
    totalValue: f.totalValue ? Number(f.totalValue) : null,
    createdAt: f.createdAt,
  }));

  return { items, nextCursor };
}
