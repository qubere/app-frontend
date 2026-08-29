import { NextResponse } from "next/server";
import { z } from "zod";
import { runInference, applyInferredJourney } from "@qubere/shipment-legs";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { getShipmentTrackingProjection } from "@/modules/tracking/shipmentTracking";
import { resolveOwnedShipment } from "@/modules/legs/legService";
import { loadInferenceInputs, legSnapshots } from "@/modules/legs/inferenceInputs";

const paramsSchema = z.object({ id: z.string().min(1) });

/**
 * Run journey inference. If the shipment has no legs yet, the inferred journey
 * is applied immediately (source=INFERRED, unconfirmed). If it already has
 * legs, a PROPOSED LegInferenceRun is persisted and the diff proposal is
 * returned for the broker to accept or reject.
 */
export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, requestId, params }) => {
    const p = validatePathParams(params, paramsSchema, requestId);
    if ("response" in p) return p.response;

    const shipment = await resolveOwnedShipment(ctx.accountId, p.data.id);
    if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

    const { documents, identifiers, existingLegs } = await loadInferenceInputs(shipment.id);
    const { inference, proposal } = runInference({
      shipment: { ...shipment },
      documents,
      identifiers,
      existingLegs: legSnapshots(existingLegs),
      nowIso: new Date().toISOString(),
    });

    if (existingLegs.length === 0 && inference.legs.length > 0) {
      await db.$transaction((tx) =>
        applyInferredJourney(tx, {
          accountId: ctx.accountId,
          shipment,
          inference,
          proposal,
          appliedByUserId: ctx.userId,
        })
      );
      const projection = await getShipmentTrackingProjection(ctx.accountId, shipment.id);
      return NextResponse.json({ applied: true, proposal, journey: projection?.journey ?? null });
    }

    // Persist the proposal so accept/reject can reference it by inputsHash.
    await db.legInferenceRun.upsert({
      where: { shipmentId_inputsHash: { shipmentId: shipment.id, inputsHash: inference.inputsHash } },
      update: {
        overallConfidence: inference.overallConfidence,
        legCount: inference.legs.length,
        proposal: proposal as unknown as object,
        status: proposal.hasChanges ? "PROPOSED" : "SUPERSEDED",
      },
      create: {
        accountId: ctx.accountId,
        shipmentId: shipment.id,
        inputsHash: inference.inputsHash,
        overallConfidence: inference.overallConfidence,
        legCount: inference.legs.length,
        proposal: proposal as unknown as object,
        status: proposal.hasChanges ? "PROPOSED" : "SUPERSEDED",
      },
    });

    return NextResponse.json({ applied: false, proposal });
  },
  { permission: "shipments.manage", write: true }
);
