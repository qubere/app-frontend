import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import type { AccountContext } from "@qubere/auth";
import { publishTransportationEvent } from "../events/services/eventService";
import { auditShipmentInvoices } from "../invoices/services/freightAuditAgent";
import { emitTmsBillingEvent } from "../../lib/billingTelemetry";

// ---------------------------------------------------------------------------
// POD Pipeline
//
// Processes a Proof of Delivery and triggers the delivery close workflow:
//   1. Create ProofOfDelivery record
//   2. Update delivery ShipmentStop.actualArrival
//   3. Update Shipment.status → DELIVERED + promiseState outcome
//   4. Emit DELIVERED TransportationEvent
//   5. Trigger Freight Audit Agent — process all pending invoices now that
//      delivery is confirmed (financial close can now begin)
//   6. Audit log
// ---------------------------------------------------------------------------

export interface IngestPodInput {
  accountId: string;
  shipmentId: string;
  documentId: string;
  deliveredAt?: Date | null;
  receivedByName?: string | null;
  exceptionNoted?: boolean;
  notes?: string | null;
}

export async function processProofOfDelivery(input: IngestPodInput) {
  const deliveredAt = input.deliveredAt ?? new Date();

  // Build a minimal AccountContext for service calls
  const ctx = { accountId: input.accountId } as unknown as AccountContext;

  // 1. Load shipment to determine promise outcome
  const shipment = await db.shipment
    .findFirst({
      where: { id: input.shipmentId, accountId: input.accountId },
      select: {
        id: true,
        shipmentNumber: true,
        customerPromiseDate: true,
        promiseState: true,
        sellAmount: true,
      },
    })
    .catch(() => null);

  // 2. Create ProofOfDelivery record
  const pod = await db.proofOfDelivery.create({
    data: {
      accountId: input.accountId,
      shipmentId: input.shipmentId,
      documentId: input.documentId,
      deliveredAt,
      receivedByName: input.receivedByName ?? null,
      exceptionNoted: input.exceptionNoted ?? false,
      notes: input.notes ?? null,
    },
  });

  // 3. Update delivery ShipmentStop.actualArrival
  const deliveryStop = await db.shipmentStop
    .findFirst({
      where: { shipmentId: input.shipmentId, type: "DELIVERY" },
      orderBy: { sequence: "desc" },
    })
    .catch(() => null);

  if (deliveryStop) {
    await db.shipmentStop
      .update({
        where: { id: deliveryStop.id },
        data: { actualArrival: deliveredAt },
      })
      .catch(() => null);
  }

  // 4. Determine final promise outcome
  const customerPromiseDate = shipment?.customerPromiseDate;
  const deliveredOnTime =
    !customerPromiseDate || deliveredAt <= customerPromiseDate;
  const finalPromiseState = deliveredOnTime ? "ON_PROMISE" : "MISSED";

  // Compute days late if missed
  const daysLate =
    !deliveredOnTime && customerPromiseDate
      ? Math.ceil(
          (deliveredAt.getTime() - customerPromiseDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

  // 5. Update Shipment — mark delivered, lock promiseState, clear active fields
  await db.shipment.update({
    where: { id: input.shipmentId },
    data: {
      status: input.exceptionNoted ? "Delivered with Exception" : "DELIVERED",
      promiseState: finalPromiseState,
      // Clear demurrage exposure — no longer at risk post-delivery
      demurrageExposureUsd: 0 as any,
    },
  });

  // If exception noted on POD, create an ExceptionItem
  if (input.exceptionNoted) {
    await db.exceptionItem
      .create({
        data: {
          accountId: input.accountId,
          shipmentId: input.shipmentId,
          type: "POD_EXCEPTION",
          category: "TRANSPORTATION",
          severity: "High",
          description: `Proof of delivery for ${shipment?.shipmentNumber ?? input.shipmentId} noted an exception at delivery. Notes: ${input.notes ?? "None provided."}`,
          requiredAction: "Review delivery exception with carrier and customer.",
          blocking: false,
          status: "Open",
          sourceAgent: "POD Pipeline",
        },
      })
      .catch(() => null);
  }

  // 6. Emit DELIVERED TransportationEvent
  await publishTransportationEvent(ctx, {
    entityType: "SHIPMENT",
    entityId: input.shipmentId,
    shipmentId: input.shipmentId,
    eventType: "DELIVERED",
    source: "DOCUMENT",
    payload: {
      podId: pod.id,
      deliveredAt: deliveredAt.toISOString(),
      receivedByName: input.receivedByName ?? null,
      exceptionNoted: input.exceptionNoted ?? false,
      promiseOutcome: finalPromiseState,
      daysLate: daysLate > 0 ? daysLate : null,
    },
  }).catch(() => null);

  // 7. Audit log
  await createAuditLog({
    accountId: input.accountId,
    action: "PROOF_OF_DELIVERY_INGESTED",
    entity: "ProofOfDelivery",
    entityId: pod.id,
    source: "SYSTEM",
    metadata: {
      shipmentId: input.shipmentId,
      deliveredAt: deliveredAt.toISOString(),
      receivedByName: input.receivedByName ?? null,
      promiseOutcome: finalPromiseState,
      daysLate,
    },
  }).catch(() => null);

  await Promise.all([
    emitTmsBillingEvent({
      accountId: input.accountId,
      shipmentId: input.shipmentId,
      eventCode: "TMS_POD_CONFIRMED",
      idempotencyKey: `billing:tms:pod:${pod.id}`,
      sourceFunction: "processProofOfDelivery",
      sourceAgent: "POD Pipeline",
      metadata: { podId: pod.id, exceptionNoted: input.exceptionNoted ?? false },
    }),
    emitTmsBillingEvent({
      accountId: input.accountId,
      shipmentId: input.shipmentId,
      eventCode: "TMS_LOAD_DELIVERED",
      idempotencyKey: `billing:tms:delivery:${pod.id}`,
      sourceFunction: "processProofOfDelivery",
      sourceAgent: "POD Pipeline",
      metadata: { podId: pod.id, promiseOutcome: finalPromiseState, daysLate },
    }),
  ]).catch((error) => console.error("[TMS billing] POD telemetry failed", error));

  // 8. Trigger Freight Audit Agent now that delivery is confirmed
  //    Run asynchronously — don't block the POD response
  auditShipmentInvoices(ctx, input.shipmentId).catch(() => null);

  return {
    pod,
    promiseOutcome: finalPromiseState,
    deliveredOnTime,
    daysLate,
  };
}
