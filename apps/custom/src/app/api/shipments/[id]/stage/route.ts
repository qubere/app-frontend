import { NextRequest, NextResponse } from "next/server";
import { getAccountContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { evaluateStages, ShipmentStage, INITIAL_STAGE } from "@/lib/workflow/stages";
import { buildStageCheckContext, evaluateAndAdvanceShipmentStage } from "@/lib/workflow/stageEngine";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const context = await getAccountContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shipment = await db.shipment.findFirst({
    where: {
      accountId: context.accountId,
      OR: [{ id: params.id }, { shipmentNumber: params.id }],
      deletedAt: null,
    },
    select: {
      id: true,
      shipmentNumber: true,
      currentStage: true,
      stageStatus: true,
      autoAdvance: true,
      stageEnteredAt: true,
      stageUpdatedAt: true,
      entryType: true,
    },
  });

  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }

  const currentStage = (shipment.currentStage as ShipmentStage) || INITIAL_STAGE;
  const stageStatus = shipment.stageStatus || "IN_PROGRESS";

  const ctx = await buildStageCheckContext(shipment.id, context.accountId);
  let stepper = evaluateStages(currentStage, ctx);

  // If stageStatus is GATE_PENDING or BLOCKED, override active stage status for UI rendering
  stepper = stepper.map((step) => {
    if (step.stage === currentStage && step.status !== "complete") {
      if (stageStatus === "GATE_PENDING") return { ...step, status: "gate_pending" as any };
      if (stageStatus === "BLOCKED") return { ...step, status: "blocked" as any };
    }
    return step;
  });

  const [history, runs, gateDecision, openExceptions, pendingDecisions] = await Promise.all([
    db.shipmentStageHistory.findMany({
      where: { shipmentId: shipment.id, accountId: context.accountId },
      orderBy: { enteredAt: "desc" },
    }),
    db.pipelineStageRun.findMany({
      where: { shipmentId: shipment.id, accountId: context.accountId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.agentDecision.findFirst({
      where: {
        shipmentId: shipment.id,
        accountId: context.accountId,
        agentName: "Stage Gate",
        purpose: `Human gate review for stage ${currentStage}`,
      },
      select: {
        id: true,
        status: true,
        triageState: true,
        decisionSummary: true,
        assignedToUserId: true,
        assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    db.exceptionItem.findMany({
      where: { shipmentId: shipment.id, accountId: context.accountId, status: "Open" },
      select: { id: true, category: true, type: true, severity: true, description: true },
    }),
    db.agentDecision.findMany({
      where: {
        shipmentId: shipment.id,
        accountId: context.accountId,
        triageState: "NEEDS_REVIEW",
      },
      select: { id: true, agentName: true, status: true, decisionSummary: true, triageState: true },
    }),
  ]);

  return NextResponse.json({
    shipmentId: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    currentStage,
    stageStatus,
    autoAdvance: shipment.autoAdvance ?? true,
    stageEnteredAt: shipment.stageEnteredAt,
    stageUpdatedAt: shipment.stageUpdatedAt,
    stepper,
    history,
    runs,
    gateDecision,
    openExceptions,
    pendingDecisions,
  });
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const context = await getAccountContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { autoAdvance } = body;

  if (typeof autoAdvance !== "boolean") {
    return NextResponse.json({ error: "autoAdvance boolean required" }, { status: 400 });
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

  await db.shipment.update({
    where: { id: shipment.id },
    data: { autoAdvance, stageUpdatedAt: new Date() },
  });

  let advanceResult = null;
  if (autoAdvance) {
    advanceResult = await evaluateAndAdvanceShipmentStage(shipment.id, context.accountId, context.userId);
  }

  return NextResponse.json({
    shipmentId: shipment.id,
    autoAdvance,
    advanceResult,
  });
}
