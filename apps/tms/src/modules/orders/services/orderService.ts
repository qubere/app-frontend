import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";
import { publishTransportationEvent } from "../../events/services/eventService";

export interface CreateTransportationOrderInput {
  clientId?: string | null;
  externalReference?: string | null;
  customerReference?: string | null;
  poReferences?: string[] | null;
  source?: "EMAIL" | "MANUAL" | "API" | "EDI" | "DOCUMENT";
  inboundEmailId?: string | null;
  rawRequestText?: string | null;
  requestedBy?: string | null;
  requestedPickupDate?: Date | null;
  requestedDeliveryDate?: Date | null;
  requestedPickupWindow?: Record<string, unknown> | null;
  requestedDeliveryWindow?: Record<string, unknown> | null;
  incoterm?: string | null;
  originAddress?: Record<string, unknown> | null;
  destinationAddress?: Record<string, unknown> | null;
  origin?: Record<string, unknown> | null;
  destination?: Record<string, unknown> | null;
  commodityDescription?: string | null;
  cargoSummary?: string | null;
  weight?: number | null;
  totalWeight?: number | null;
  totalVolume?: number | null;
  packageInfo?: Record<string, unknown> | null;
  equipmentRequirements?: string[] | Record<string, unknown> | null;
  specialRequirements?: Record<string, unknown> | null;
  customsRequired?: boolean;
  confidence?: number | null;
  mode?: "OCEAN" | "AIR" | "TRUCK" | "RAIL" | "DRAYAGE" | null;
  serviceLevel?: string | null;
  status?: string;
  agentDecisionId?: string | null;
}

export async function createTransportationOrder(
  ctx: AccountContext,
  input: CreateTransportationOrderInput
) {
  const confidence = input.confidence ?? 100;
  const isHighConfidence = confidence >= 80;
  const status = input.status ?? (isHighConfidence ? "UNDERSTOOD" : "NEEDS_REVIEW");

  const canonicalOrigin = input.origin ?? input.originAddress ?? null;
  const canonicalOriginAddr = input.originAddress ?? input.origin ?? null;
  const canonicalDest = input.destination ?? input.destinationAddress ?? null;
  const canonicalDestAddr = input.destinationAddress ?? input.destination ?? null;

  const order = await db.transportationOrder.create({
    data: {
      accountId: ctx.accountId,
      clientId: input.clientId ?? null,
      externalReference: input.externalReference ?? null,
      customerReference: input.customerReference ?? null,
      poReferences: input.poReferences ? (input.poReferences as any) : undefined,
      source: input.source ?? "EMAIL",
      inboundEmailId: input.inboundEmailId ?? null,
      rawRequestText: input.rawRequestText ?? null,
      requestedBy: input.requestedBy ?? null,
      requestedPickupDate: input.requestedPickupDate ?? null,
      requestedDeliveryDate: input.requestedDeliveryDate ?? null,
      requestedPickupWindow: input.requestedPickupWindow ? (input.requestedPickupWindow as any) : undefined,
      requestedDeliveryWindow: input.requestedDeliveryWindow ? (input.requestedDeliveryWindow as any) : undefined,
      incoterm: input.incoterm ?? null,
      originAddress: canonicalOriginAddr ? (canonicalOriginAddr as any) : undefined,
      destinationAddress: canonicalDestAddr ? (canonicalDestAddr as any) : undefined,
      origin: canonicalOrigin ? (canonicalOrigin as any) : undefined,
      destination: canonicalDest ? (canonicalDest as any) : undefined,
      commodityDescription: input.commodityDescription ?? null,
      cargoSummary: input.cargoSummary ?? null,
      weight: input.weight ?? null,
      totalWeight: input.totalWeight ?? null,
      totalVolume: input.totalVolume ?? null,
      packageInfo: input.packageInfo ? (input.packageInfo as any) : undefined,
      equipmentRequirements: input.equipmentRequirements ? (input.equipmentRequirements as any) : undefined,
      specialRequirements: input.specialRequirements ? (input.specialRequirements as any) : undefined,
      customsRequired: input.customsRequired ?? true,
      confidence: input.confidence ?? null,
      mode: input.mode ?? null,
      serviceLevel: input.serviceLevel ?? null,
      status,
      agentDecisionId: input.agentDecisionId ?? null,
      createdByUserId: ctx.userId ?? null,
    },
  });

  await publishTransportationEvent(ctx, {
    entityType: "TRANSPORTATION_ORDER",
    entityId: order.id,
    transportationOrderId: order.id,
    eventType: "ORDER_CREATED",
    source: input.source ?? "EMAIL",
    confidence,
    payload: { status, mode: input.mode, commodity: input.commodityDescription },
  });

  return order;
}

export async function promoteOrderToShipment(
  ctx: AccountContext,
  transportationOrderId: string
) {
  const order = await db.transportationOrder.findFirst({
    where: {
      accountId: ctx.accountId,
      id: transportationOrderId,
    },
  });

  if (!order) {
    throw new Error(`TransportationOrder ${transportationOrderId} not found`);
  }

  // Create shared Shipment aggregate root
  const year = new Date().getFullYear();
  const count = await db.shipment.count({ where: { accountId: ctx.accountId } });
  const shipmentNumber = `SHP-${year}-${String(count + 1).padStart(6, "0")}`;

  const shipment = await db.shipment.create({
    data: {
      accountId: ctx.accountId,
      shipmentNumber,
      importerName: order.requestedBy ?? "TMS Client",
      clientId: order.clientId ?? null,
      incoterm: order.incoterm ?? null,
      transportMode: order.mode ?? "OCEAN",
      poReference: Array.isArray(order.poReferences) ? (order.poReferences[0] as string) : order.customerReference ?? null,
      status: "In Progress",
      currentStage: "DOCUMENT_INTAKE",
    },
  });

  // Link Order to Shipment
  const updatedOrder = await db.transportationOrder.update({
    where: { id: order.id },
    data: {
      shipmentId: shipment.id,
      status: "SHIPMENT_CREATED",
    },
  });

  await publishTransportationEvent(ctx, {
    entityType: "SHIPMENT",
    entityId: shipment.id,
    shipmentId: shipment.id,
    transportationOrderId: order.id,
    eventType: "SHIPMENT_CREATED",
    source: "SYSTEM",
    payload: { shipmentNumber, orderId: order.id },
  });

  return {
    order: updatedOrder,
    shipment,
  };
}
