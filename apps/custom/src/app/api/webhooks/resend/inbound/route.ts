import { clientInboundEnabled, resolveInboundAddress, acceptsInboundAddress } from "@/modules/inbound/inboundAddressService";
import { NextResponse, after } from "next/server";
import { Prisma } from "@prisma/client";
import { withPublicRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import {
  verifyResendWebhook,
  ResendConfigError,
  ResendWebhookVerificationError,
} from "@/lib/inbound/resendClient";
import { normalizeSenderEmail, recipientMatches } from "@/modules/inbound/emailNormalization";
import { runInboundEmailWorkerTick } from "@/modules/documents/processing/inboundEmailWorker";

/**
 * Public, signed entry point for Resend's `email.received` webhook.
 *
 * Does the minimum needed to answer fast and durably: verify the signature,
 * confirm the email was actually addressed to an address we ingest, dedupe
 * the provider event, persist minimal state, and return. No attachment
 * fetch, no storage, no Gemini call happens in this request -- that is
 * `runInboundEmailWorkerTick`'s job, dispatched after the response and
 * backstopped by the `inbound-email-processing` cron tick.
 */
function allowedRecipients(): string[] {
  const configured = process.env.RESEND_ALLOWED_INBOUND_RECIPIENTS;
  const raw = configured && configured.trim() !== "" ? configured : "docs@inbound.qubere.ai";
  return raw.split(",").map((addr) => normalizeSenderEmail(addr)).filter(Boolean);
}

function log(requestId: string, event: string, fields: Record<string, string | number | boolean | null> = {}): void {
  console.log(`[ResendWebhook] ${event}`, { requestId, ...fields });
}

export const POST = withPublicRoute(async ({ req, requestId }) => {
  log(requestId, "webhook.received");

  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    log(requestId, "webhook.missing_signature_headers", {
      hasSvixId: !!svixId,
      hasSvixTimestamp: !!svixTimestamp,
      hasSvixSignature: !!svixSignature,
    });
    return NextResponse.json({ error: "MISSING_SIGNATURE_HEADERS", requestId }, { status: 400 });
  }

  let payload;
  try {
    payload = verifyResendWebhook(rawBody, {
      id: svixId,
      timestamp: svixTimestamp,
      signature: svixSignature,
    });
    log(requestId, "webhook.signature_verified", { svixId, eventType: payload.type });
  } catch (error) {
    if (error instanceof ResendConfigError) {
      console.error("[ResendWebhook] Not configured:", error.message);
      log(requestId, "webhook.not_configured", { svixId, error: error.message });
      return NextResponse.json({ error: "NOT_CONFIGURED", requestId }, { status: 503 });
    }
    if (error instanceof ResendWebhookVerificationError) {
      log(requestId, "webhook.invalid_signature", { svixId, error: error.message });
      return NextResponse.json({ error: "INVALID_SIGNATURE", requestId }, { status: 400 });
    }
    throw error;
  }

  // Only the event this endpoint is meant for is processed; anything else
  // (delivery/open/click events, if ever misconfigured onto this endpoint)
  // is acknowledged and ignored.
  if (payload.type !== "email.received") {
    log(requestId, "webhook.ignored_event_type", { svixId, eventType: payload.type });
    return NextResponse.json({ status: "IGNORED", requestId });
  }

  const { data } = payload;
  const allowed = allowedRecipients();
  const candidateRecipients = [...(data.to ?? []), ...(data.received_for ?? [])];
  const destinationRouting = clientInboundEnabled();
  const destinations = destinationRouting
    ? (await Promise.all(candidateRecipients.map(resolveInboundAddress))).filter(d => d !== null)
    : [];
  const distinctDestinations = new Set(destinations.map(d => `${d.accountId}:${d.clientId ?? ''}:${d.purpose}`));
  // Multiple clients in To/CC must never select the first recipient silently.
  const destination = distinctDestinations.size === 1 ? destinations.find(d => acceptsInboundAddress(d)) ?? destinations[0] : null;
  const isAddressedToUs = destinationRouting
    ? !!destination && acceptsInboundAddress(destination)
    : candidateRecipients.some(candidate => allowed.some(expected => recipientMatches(candidate, expected)));
  const rejectionReason = distinctDestinations.size > 1 ? "multiple_destinations" : destination ? "recipient_inactive" : "recipient_not_recognised";

  const normalizedFrom = normalizeSenderEmail(data.from);

  log(requestId, "webhook.recipient_check", {
    svixId,
    from: data.from,
    candidateRecipients: candidateRecipients.join(", "),
    allowedRecipients: allowed.join(", "),
    isAddressedToUs,
  });

  let inboundEmailId: string;
  try {
    const created = await db.inboundEmail.create({
      data: {
        accountId: destination?.accountId ?? null,
        clientId: destination?.clientId ?? null,
        inboundAddressId: destination?.id ?? null,
        recipientAddress: destination?.address ?? null,
        provider: "resend",
        providerEventId: svixId,
        providerEmailId: data.email_id,
        normalizedFromAddress: normalizedFrom,
        originalFromAddress: data.from,
        toAddresses: candidateRecipients.join(", "),
        subject: data.subject ?? null,
        receivedAt: new Date(data.created_at),
        routingStatus: isAddressedToUs ? "RECEIVED" : "REJECTED",
        quarantineReason: isAddressedToUs ? null : destinationRouting ? rejectionReason : "recipient_not_allowed",
      },
    });
    inboundEmailId = created.id;
    log(requestId, "webhook.inbound_email_created", {
      svixId,
      inboundEmailId,
      routingStatus: created.routingStatus,
      quarantineReason: created.quarantineReason,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Duplicate webhook delivery for an event we've already recorded.
      // Idempotent no-op: the original delivery (or the cron backstop) owns
      // processing this email.
      log(requestId, "webhook.duplicate_delivery", { svixId });
      return NextResponse.json({ status: "DUPLICATE", requestId }, { status: 200 });
    }
    log(requestId, "webhook.create_failed", { svixId, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }

  if (isAddressedToUs) {
    // Fire-and-forget: keeps this response fast while the durable worker
    // does the slow work (attachment fetch, storage, extraction). The
    // `inbound-email-processing` cron tick is the retry path if this doesn't
    // finish (cold start, timeout, crash).
    log(requestId, "webhook.dispatching_immediate_tick", { svixId, inboundEmailId });
    after(async () => {
      try {
        const result = await runInboundEmailWorkerTick();
        log(requestId, "webhook.immediate_tick_finished", { svixId, inboundEmailId, ...result });
      } catch (err) {
        console.error("[ResendWebhook] Immediate processing tick failed:", err);
        log(requestId, "webhook.immediate_tick_failed", {
          svixId,
          inboundEmailId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  log(requestId, "webhook.responding_accepted", { svixId, inboundEmailId });
  return NextResponse.json({ status: "ACCEPTED", requestId }, { status: 202 });
});
