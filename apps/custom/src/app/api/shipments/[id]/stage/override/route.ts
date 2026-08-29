import { NextRequest, NextResponse } from "next/server";
import { getAccountContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { SHIPMENT_STAGES, ShipmentStage } from "@/lib/workflow/stages";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const context = await getAccountContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Manager or Enterprise Admin permission check
  const isManagerOrAdmin =
    context.roleNames.includes("ADMIN") ||
    context.roleNames.includes("OWNER") ||
    context.roleNames.includes("MANAGER") ||
    context.accountType === "ENTERPRISE";

  if (!isManagerOrAdmin) {
    return NextResponse.json(
      { error: "Forbidden: Stage override requires MANAGER or ADMIN role." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { toStage, resetBreaker, reason } = body;

  if (!reason || typeof reason !== "string") {
    return NextResponse.json({ error: "Reason for stage override is required." }, { status: 400 });
  }

  if (toStage && !SHIPMENT_STAGES.includes(toStage as ShipmentStage)) {
    return NextResponse.json({ error: `Invalid target stage: ${toStage}` }, { status: 400 });
  }

  const shipment = await db.shipment.findFirst({
    where: {
      accountId: context.accountId,
      OR: [{ id: params.id }, { shipmentNumber: params.id }],
      deletedAt: null,
    },
  });

  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }

  const newStage = (toStage as ShipmentStage) || shipment.currentStage || "DOCUMENT_INTAKE";
  const now = new Date();

  // Close active history entry if any
  await db.shipmentStageHistory.updateMany({
    where: { shipmentId: shipment.id, exitedAt: null },
    data: { exitedAt: now, outcome: "MANUAL_OVERRIDE" },
  });

  // Write new history entry
  const history = await db.shipmentStageHistory.create({
    data: {
      accountId: context.accountId,
      shipmentId: shipment.id,
      stage: newStage,
      enteredAt: now,
      outcome: resetBreaker ? "BREAKER_RESET" : "MANUAL_OVERRIDE",
      advancedBy: context.userId,
      note: reason,
    },
  });

  // Update shipment
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
}
