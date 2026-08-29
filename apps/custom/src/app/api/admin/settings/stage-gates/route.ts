import { NextRequest, NextResponse } from "next/server";
import { getAccountContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { SHIPMENT_STAGES, ShipmentStage } from "@/lib/workflow/stages";

export async function GET() {
  const context = await getAccountContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const policies = await db.stageGatePolicy.findMany({
    where: { accountId: context.accountId },
    orderBy: [{ stage: "asc" }, { entryType: "asc" }],
  });

  return NextResponse.json({ policies });
}

export async function PUT(request: NextRequest) {
  const context = await getAccountContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { policies } = body;

  if (!Array.isArray(policies)) {
    return NextResponse.json({ error: "policies array required" }, { status: 400 });
  }

  const upserted = [];

  for (const pol of policies) {
    if (!pol.stage || !SHIPMENT_STAGES.includes(pol.stage as ShipmentStage)) {
      continue;
    }

    const entryType = pol.entryType || null;
    const mode = pol.mode === "HUMAN_GATE" ? "HUMAN_GATE" : "AUTO_ADVANCE";
    const minimumReviewerRole = pol.minimumReviewerRole || "SPECIALIST";
    const requireLicensedBroker = Boolean(pol.requireLicensedBroker);
    const gateReason = pol.gateReason || null;

    const row = await db.stageGatePolicy.upsert({
      where: {
        accountId_stage_entryType: {
          accountId: context.accountId,
          stage: pol.stage,
          entryType,
        },
      },
      create: {
        accountId: context.accountId,
        stage: pol.stage,
        entryType,
        mode,
        minimumReviewerRole,
        requireLicensedBroker,
        gateReason,
        createdBy: context.userId,
      },
      update: {
        mode,
        minimumReviewerRole,
        requireLicensedBroker,
        gateReason,
      },
    });

    upserted.push(row);
  }

  return NextResponse.json({ policies: upserted });
}
