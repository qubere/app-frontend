import { db } from "@qubere/db";

export interface ErpPurchaseOrderPayload {
  poNumber: string;
  clientName: string;
  clientAccountId?: string;
  originPortCode: string;
  destinationAddress: string;
  promisedDeliveryIso: string;
  transportMode?: string;
  lineItems: Array<{
    htsCode: string;
    description: string;
    quantity: number;
    declaredValueUsd: number;
  }>;
}

export async function ingestErpPurchaseOrder(ctx: any, payload: ErpPurchaseOrderPayload) {
  const accountId = ctx?.accountId;
  if (!accountId) {
    throw new Error("accountId is required for ERP ingestion");
  }

  const order = await db.transportationOrder.create({
    data: {
      accountId,
      externalReference: payload.poNumber,
      customerReference: payload.poNumber,
      source: "API",
      requestedBy: payload.clientName,
      mode: payload.transportMode || "OCEAN",
      commodityDescription: payload.lineItems.map((l) => l.description).join("; "),
      origin: { unlocode: payload.originPortCode || "CNSHA" },
      destination: { address: payload.destinationAddress },
      requestedDeliveryDate: payload.promisedDeliveryIso ? new Date(payload.promisedDeliveryIso) : null,
      status: "RECEIVED",
      confidence: 100,
    },
  });

  return {
    success: true,
    orderId: order.id,
    poNumber: payload.poNumber,
    status: order.status,
    lineItemsIngestedCount: payload.lineItems.length,
    message: `PO #${payload.poNumber} ingested successfully as TransportationOrder #${order.id.slice(0, 10)}.`,
  };
}
