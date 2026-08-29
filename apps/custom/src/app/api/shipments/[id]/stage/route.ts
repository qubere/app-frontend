import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { evaluateStages, ShipmentStage, INITIAL_STAGE } from "@/lib/workflow/stages";
import { buildStageCheckContext, evaluateAndAdvanceShipmentStage } from "@/lib/workflow/stageEngine";

export const GET = withAuthenticatedRoute<{ id: string }>(async ({ ctx, params }) => {
  const shipment = await db.shipment.findFirst({
    where: {
      accountId: ctx.accountId,
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

  const ctxStages = await buildStageCheckContext(shipment.id, ctx.accountId);
  let stepper = evaluateStages(currentStage, ctxStages);

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
      where: { shipmentId: shipment.id, accountId: ctx.accountId },
      orderBy: { enteredAt: "desc" },
    }),
    db.pipelineStageRun.findMany({
      where: { shipmentId: shipment.id, accountId: ctx.accountId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.agentDecision.findFirst({
      where: {
        shipmentId: shipment.id,
        accountId: ctx.accountId,
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
      where: { shipmentId: shipment.id, accountId: ctx.accountId, status: "Open" },
      select: { id: true, category: true, type: true, severity: true, description: true },
    }),
    db.agentDecision.findMany({
      where: {
        shipmentId: shipment.id,
        accountId: ctx.accountId,
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
}, { permission: "shipments.read" });

export const PATCH = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const body = await req.json();
  const { autoAdvance } = body;

  if (typeof autoAdvance !== "boolean") {
    return NextResponse.json({ error: "autoAdvance boolean required" }, { status: 400 });
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

  await db.shipment.update({
    where: { id: shipment.id },
    data: { autoAdvance, stageUpdatedAt: new Date() },
  });

  let advanceResult = null;
  if (autoAdvance) {
    advanceResult = await evaluateAndAdvanceShipmentStage(shipment.id, ctx.accountId, ctx.userId);
  }

  return NextResponse.json({
    shipmentId: shipment.id,
    autoAdvance,
    advanceResult,
  });
}, { permission: "shipments.manage", write: true });
