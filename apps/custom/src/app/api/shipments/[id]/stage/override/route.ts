import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { SHIPMENT_STAGES, ShipmentStage } from "@/lib/workflow/stages";

const MANAGER_ROLES = ["ADMIN", "OWNER", "MANAGER"];

export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  // Stage override is a privileged action — it can push a shipment past a
  // human gate. Gate strictly on role, never on account tier.
  if (!ctx.roleNames.some((r) => MANAGER_ROLES.includes(r))) {
    return NextResponse.json(
      { error: "Forbidden: Stage override requires MANAGER or ADMIN role." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { toStage, resetBreaker, reason } = body;

  if (!reason || typeof reason !== "string") {
    return NextResponse.json({ error: "Reason for stage override is required." }, { status: 400 });
  }

  if (toStage && !SHIPMENT_STAGES.includes(toStage as ShipmentStage)) {
    return NextResponse.json({ error: `Invalid target stage: ${toStage}` }, { status: 400 });
  }

  const shipment = await db.shipment.findFirst({
    where: {
      accountId: ctx.accountId,
      OR: [{ id: params.id }, { shipmentNumber: params.id }],
      deletedAt: null,
    },
  });

  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }

  const newStage = (toStage as ShipmentStage) || shipment.currentStage || "DOCUMENT_INTAKE";
  const now = new Date();

  await db.shipmentStageHistory.updateMany({
    where: { shipmentId: shipment.id, exitedAt: null },
    data: { exitedAt: now, outcome: "MANUAL_OVERRIDE" },
  });

  const history = await db.shipmentStageHistory.create({
    data: {
      accountId: ctx.accountId,
      shipmentId: shipment.id,
      stage: newStage,
      enteredAt: now,
      outcome: resetBreaker ? "BREAKER_RESET" : "MANUAL_OVERRIDE",
      advancedBy: ctx.userId,
      note: reason,
    },
  });

  await db.shipment.update({
    where: { id: shipment.id },
    data: {
      currentStage: newStage,
      stageStatus: "IN_PROGRESS",
      stageEnteredAt: now,
      stageUpdatedAt: now,
    },
  });

  return NextResponse.json({
    shipmentId: shipment.id,
    currentStage: newStage,
    stageStatus: "IN_PROGRESS",
    historyId: history.id,
    message: resetBreaker ? "Breaker reset and stage set to IN_PROGRESS." : "Stage manually overridden.",
  });
}, { permission: "shipments.manage", write: true });
