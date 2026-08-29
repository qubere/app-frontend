import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { recordStageFailureAndCheckBreaker } from "@/lib/workflow/stageEngine";
import { ShipmentStage, INITIAL_STAGE } from "@/lib/workflow/stages";

const MANAGER_ROLES = ["ADMIN", "OWNER", "MANAGER"];

/**
 * Demo / diagnostic aid: records a synthetic stage-execution failure for the
 * shipment's current stage, so the circuit breaker can be exercised without
 * an actual agent crash. Manager/admin only. Call it three times to trip.
 */
export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  if (!ctx.roleNames.some((r) => MANAGER_ROLES.includes(r))) {
    return NextResponse.json(
      { error: "Forbidden: simulate-failure requires MANAGER or ADMIN role." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" && body.reason.trim()
    ? body.reason.trim()
    : "Simulated stage failure (demo)";

  const shipment = await db.shipment.findFirst({
    where: {
      accountId: ctx.accountId,
      OR: [{ id: params.id }, { shipmentNumber: params.id }],
      deletedAt: null,
    },
    select: { id: true, currentStage: true },
  });
  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }

  const stage = (shipment.currentStage as ShipmentStage) || INITIAL_STAGE;
  const result = await recordStageFailureAndCheckBreaker(shipment.id, ctx.accountId, stage, reason);

  return NextResponse.json({ shipmentId: shipment.id, stage, ...result });
}, { permission: "shipments.manage", write: true });
