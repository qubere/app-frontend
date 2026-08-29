import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { evaluateAndAdvanceShipmentStage } from "@/lib/workflow/stageEngine";
import { ShipmentStage, INITIAL_STAGE } from "@/lib/workflow/stages";

const MANAGER_ROLES = ["ADMIN", "OWNER", "MANAGER"];

export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const body = await req.json();
  const { gateDecisionId, action, note } = body;

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action. Must be 'approve' or 'reject'." }, { status: 400 });
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

  const currentStage = (shipment.currentStage as ShipmentStage) || INITIAL_STAGE;

  // Enforce the stage gate's minimum reviewer authority before allowing an
  // approval to advance. Resolution order matches the engine:
  // (stage, entryType) -> (stage, null).
  if (action === "approve") {
    let policy = null;
    if (shipment.entryType) {
      policy = await db.stageGatePolicy.findFirst({
        where: { accountId: ctx.accountId, stage: currentStage, entryType: shipment.entryType },
      });
    }
    if (!policy) {
      policy = await db.stageGatePolicy.findFirst({
        where: { accountId: ctx.accountId, stage: currentStage, entryType: null },
      });
    }

    if (policy) {
      const needsManager = policy.minimumReviewerRole === "MANAGER";
      const needsBroker =
        policy.requireLicensedBroker || policy.minimumReviewerRole === "LICENSED_BROKER";

      if (needsManager && !ctx.roleNames.some((r) => MANAGER_ROLES.includes(r))) {
        return NextResponse.json(
          { error: "This stage gate requires a MANAGER or ADMIN to approve advancement." },
          { status: 403 }
        );
      }

      if (needsBroker) {
        const reviewer = await db.user.findUnique({
          where: { id: ctx.userId },
          select: { brokerLicenseNumber: true },
        });
        if (!reviewer?.brokerLicenseNumber) {
          return NextResponse.json(
            { error: "This stage gate requires a licensed customs broker to approve advancement." },
            { status: 403 }
          );
        }
      }
    }
  }

  // Find gate decision if provided, or look up active Stage Gate decision
  const gateDecision = gateDecisionId
    ? await db.agentDecision.findFirst({
        where: { id: gateDecisionId, shipmentId: shipment.id, accountId: ctx.accountId },
      })
    : await db.agentDecision.findFirst({
        where: {
          shipmentId: shipment.id,
          accountId: ctx.accountId,
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
          reviewedByUserId: ctx.userId,
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
        reviewedByUserId: ctx.userId,
      },
    });
  }

  const result = await evaluateAndAdvanceShipmentStage(shipment.id, ctx.accountId, ctx.userId);

  return NextResponse.json({
    shipmentId: shipment.id,
    action: "approve",
    result,
  });
}, { permission: "specialist.write", write: true });
