import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@qubere/db";
import { computeAndPersistEtaObservation } from "../../../../modules/tracking/etaEngine";
import { evaluateTrackingExceptions } from "../../../../modules/tracking/exceptionDetector";
import { z } from "zod";

const trackingWebhookSchema = z.object({
  idempotencyKey: z.string(),
  shipmentId: z.string(),
  eventCode: z.string(),
  eventDescription: z.string().optional().nullable(),
  eventTimestamp: z.string(),
  locationName: z.string().optional().nullable(),
  estimatedArrival: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const webhookSecret = process.env.WEBHOOK_SECRET || process.env.ERP_WEBHOOK_API_KEY;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  const sig = req.headers.get("x-webhook-signature") || req.headers.get("authorization") || req.headers.get("x-api-key");
  if (!sig || (sig !== webhookSecret && sig !== `Bearer ${webhookSecret}`)) {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing webhook signature" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = trackingWebhookSchema.parse(body);

  const shipment = await db.shipment.findUnique({
    where: { id: parsed.shipmentId },
  });

  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }

  let trackingEvent;
  try {
    trackingEvent = await db.trackingEvent.create({
      data: {
        accountId: shipment.accountId,
        shipmentId: shipment.id,
        idempotencyKey: parsed.idempotencyKey,
        eventType: parsed.eventCode,
        classifier: "ACTUAL",
        provider: "CARRIER_WEBHOOK",
        sourceType: "CARRIER",
        occurredAt: new Date(parsed.eventTimestamp),
        locationName: parsed.locationName ?? null,
        normalizedData: parsed as any,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ status: "DUPLICATE_EVENT_IGNORED" }, { status: 200 });
    }
    throw error;
  }

  // Compute ETA Observation if updated estimate provided
  if (parsed.estimatedArrival) {
    const etaObs = await computeAndPersistEtaObservation({
      shipmentId: shipment.id,
      trackingEventId: trackingEvent.id,
      newEstimatedArrival: new Date(parsed.estimatedArrival),
    });

    // Evaluate logistics exceptions
    if (typeof etaObs.deltaMinutes === "number") {
      await evaluateTrackingExceptions({
        accountId: shipment.accountId,
        shipmentId: shipment.id,
        etaDeltaMinutes: etaObs.deltaMinutes,
      });
    }
  }

  return NextResponse.json({ trackingEvent }, { status: 201 });
}
