import { NextResponse } from "next/server";
import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";
import { publishTransportationEvent } from "@/modules/events/services/eventService";
import { runTrackingEtaAgent } from "@/modules/agents/services/operationalAgents";

export async function POST(req: Request) {
  try {
    const webhookSecret = process.env.WEBHOOK_SECRET || process.env.ERP_WEBHOOK_API_KEY;
    if (!webhookSecret) {
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }
    const sig = req.headers.get("x-webhook-signature") || req.headers.get("authorization") || req.headers.get("x-api-key");
    if (!sig || (sig !== webhookSecret && sig !== `Bearer ${webhookSecret}`)) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing webhook signature" }, { status: 401 });
    }

    const body = await req.json();
    const {
      shipmentId,
      filingId,
      entryNumber,
      filingStatus,
      cbpDispositionCode,
      accountId,
    } = body;

    if (!shipmentId) {
      return NextResponse.json({ error: "shipmentId is required" }, { status: 400 });
    }

    const isReleased =
      filingStatus === "RELEASED" ||
      filingStatus === "ACCEPTED" ||
      cbpDispositionCode === "1C";

    // Update DB customs filing record if found
    if (filingId) {
      await db.customsFiling
        .updateMany({
          where: { id: filingId },
          data: { filingStatus: isReleased ? "RELEASED" : filingStatus },
        })
        .catch(() => null);
    }

    // Resolve any pending CUSTOMS_HOLD exceptions on this shipment
    if (isReleased) {
      await db.exceptionItem
        .updateMany({
          where: { shipmentId, type: "CUSTOMS_HOLD" },
          data: {
            status: "Resolved",
            resolvedAt: new Date(),
            resolvedBy: "SYSTEM",
            resolvedByName: "CBP ACE ABI Webhook",
            resolutionNote:
              "Customs released automatically via CBP ACE ABI Webhook (1C disposition).",
          },
        })
        .catch(() => null);

      // Also resolve LFD_AT_RISK exceptions — customs released means no demurrage
      await db.exceptionItem
        .updateMany({
          where: { shipmentId, type: "LFD_AT_RISK", status: "Open" },
          data: {
            status: "Resolved",
            resolvedAt: new Date(),
            resolvedBy: "SYSTEM",
            resolvedByName: "CBP ACE ABI Webhook",
            resolutionNote: "Customs released — LFD risk cleared.",
          },
        })
        .catch(() => null);
    }

    // Determine accountId for event publishing (look it up if not provided)
    let resolvedAccountId = accountId;
    if (!resolvedAccountId) {
      const shipment = await db.shipment
        .findFirst({
          where: { id: shipmentId },
          select: { accountId: true },
        })
        .catch(() => null);
      resolvedAccountId = shipment?.accountId;
    }

    // Emit TransportationEvent for the customs release — this creates an
    // immutable audit trail entry and can trigger downstream Inngest functions
    if (resolvedAccountId) {
      // For a CBP webhook (no user session), construct a minimal service context.
      // All services here only use ctx.accountId.
      const ctx = {
        accountId: resolvedAccountId,
      } as unknown as AccountContext;

      await publishTransportationEvent(ctx, {
        entityType: "SHIPMENT",
        entityId: shipmentId,
        shipmentId,
        eventType: isReleased ? "CUSTOMS_RELEASED" : "CUSTOMS_HOLD",
        source: "CBP",
        payload: {
          filingId: filingId ?? null,
          entryNumber: entryNumber ?? null,
          filingStatus: isReleased ? "RELEASED" : filingStatus,
          cbpDispositionCode: cbpDispositionCode ?? null,
          releasedAt: isReleased ? new Date().toISOString() : null,
        },
      }).catch(() => null);

      // After customs release, trigger ETA Agent to recompute ETA/promise state
      // since drayage can now be dispatched (customs was a blocking dependency)
      if (isReleased) {
        await runTrackingEtaAgent(ctx, shipmentId).catch(() => null);
      }
    }

    return NextResponse.json({
      success: true,
      shipmentId,
      entryNumber: entryNumber ?? null,
      customsStatus: isReleased ? "RELEASED" : "HOLD",
      drayageDispatchUnlocked: isReleased,
      message: isReleased
        ? "CBP 7501 Entry Released. Drayage pickup dispatch automatically unlocked. ETA Agent notified."
        : "CBP 7501 Entry Hold active. Drayage pickup remains held to prevent demurrage.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Webhook processing error" },
      { status: 500 }
    );
  }
}
