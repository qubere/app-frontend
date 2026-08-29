import { NextRequest, NextResponse } from "next/server";
import { getAccountContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { evaluateAndAdvanceShipmentStage } from "@/lib/workflow/stageEngine";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const context = await getAccountContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { gateDecisionId, action, note } = body;

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action. Must be 'approve' or 'reject'." }, { status: 400 });
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

  // Find gate decision if provided, or look up active Stage Gate decision
  const gateDecision = gateDecisionId
    ? await db.agentDecision.findFirst({
        where: { id: gateDecisionId, shipmentId: shipment.id, accountId: context.accountId },
      })
    : await db.agentDecision.findFirst({
        where: {
          shipmentId: shipment.id,
          accountId: context.accountId,
          agentName: "Stage Gate",
          triageState: "NEEDS_REVIEW",
        },
      });

  if (action === "reject") {
    if (gateDecision) {
      await db.agentDecision.update({
        where: { id: gateDecision.id },
        data: {
          status: "Rejected",
          triageState: "REJECTED",
          humanNotes: note || "Stage gate advancement rejected by reviewer.",
          reviewedByUserId: context.userId,
        },
      });
    }

    return NextResponse.json({
      shipmentId: shipment.id,
      action: "reject",
      stageStatus: shipment.stageStatus || "GATE_PENDING",
      message: "Stage gate rejected. Shipment remains at current stage.",
    });
  }

  // Action is APPROVE
  if (gateDecision) {
    await db.agentDecision.update({
      where: { id: gateDecision.id },
      data: {
        status: "Approved",
        triageState: "APPROVED",
        humanNotes: note || "Stage gate approved.",
        reviewedByUserId: context.userId,
      },
    });
  }

  // Trigger stage engine evaluation & advancement
  const result = await evaluateAndAdvanceShipmentStage(shipment.id, context.accountId, context.userId);

  return NextResponse.json({
    shipmentId: shipment.id,
    action: "approve",
    result,
  });
}
