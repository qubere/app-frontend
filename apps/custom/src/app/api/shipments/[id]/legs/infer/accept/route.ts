import { NextResponse } from "next/server";
import { z } from "zod";
import { runInference, applyInferredJourney, appendInferredLegs } from "@qubere/shipment-legs";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams, parseAndValidateBody } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { getShipmentTrackingProjection } from "@/modules/tracking/shipmentTracking";
import { resolveOwnedShipment } from "@/modules/legs/legService";
import { loadInferenceInputs, legSnapshots } from "@/modules/legs/inferenceInputs";

const paramsSchema = z.object({ id: z.string().min(1) });
const bodySchema = z.object({ inputsHash: z.string().min(8) });

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, requestId, params }) => {
    const p = validatePathParams(params, paramsSchema, requestId);
    if ("response" in p) return p.response;
    const body = await parseAndValidateBody(req, bodySchema, requestId);
    if ("response" in body) return body.response;

    const shipment = await resolveOwnedShipment(ctx.accountId, p.data.id);
    if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

    const run = await db.legInferenceRun.findFirst({
      where: { shipmentId: shipment.id, inputsHash: body.data.inputsHash },
    });
    if (!run || run.status === "APPLIED") {
      return NextResponse.json({ error: "No pending proposal for that inputsHash", code: "PROPOSAL_NOT_PENDING" }, { status: 409 });
    }

    const { documents, identifiers, existingLegs } = await loadInferenceInputs(shipment.id);
    const { inference, proposal } = runInference({
      shipment: { ...shipment },
      documents,
      identifiers,
      existingLegs: legSnapshots(existingLegs),
      nowIso: new Date().toISOString(),
    });

    if (inference.inputsHash !== body.data.inputsHash) {
      return NextResponse.json(
        { error: "Shipment documents changed since this proposal was generated — re-run inference.", code: "PROPOSAL_STALE" },
        { status: 409 }
      );
    }

    await db.$transaction(async (tx) => {
      if (existingLegs.length === 0) {
        await applyInferredJourney(tx, {
          accountId: ctx.accountId, shipment, inference, proposal, appliedByUserId: ctx.userId,
        });
      } else {
        const last = existingLegs[existingLegs.length - 1];
        await appendInferredLegs(tx, {
          accountId: ctx.accountId,
          shipment,
          inference,
          proposal,
          existingLegCount: existingLegs.length,
          lastDestinationStopId: last.destinationStop?.id ?? null,
          appliedByUserId: ctx.userId,
        });
      }
    });

    const projection = await getShipmentTrackingProjection(ctx.accountId, shipment.id);
    return NextResponse.json({ applied: true, journey: projection?.journey ?? null });
  },
  { permission: "shipments.manage", write: true }
);
