import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { createAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { SHIPMENT_STAGES, ShipmentStage } from "@/lib/workflow/stages";

export const GET = withAuthenticatedRoute(async ({ ctx }) => {
  const policies = await db.stageGatePolicy.findMany({
    where: { accountId: ctx.accountId },
    orderBy: [{ stage: "asc" }, { entryType: "asc" }],
  });
  return NextResponse.json({ policies });
}, { permission: "settings.manage" });

export const PUT = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json();
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
    const minimumReviewerRole = ["SPECIALIST", "LICENSED_BROKER", "MANAGER"].includes(pol.minimumReviewerRole)
      ? pol.minimumReviewerRole
      : "SPECIALIST";
    const requireLicensedBroker = Boolean(pol.requireLicensedBroker);
    const gateReason = pol.gateReason || null;

    const row = await db.stageGatePolicy.upsert({
      where: {
        accountId_stage_entryType: { accountId: ctx.accountId, stage: pol.stage, entryType },
      },
      create: {
        accountId: ctx.accountId,
        stage: pol.stage,
        entryType,
        mode,
        minimumReviewerRole,
        requireLicensedBroker,
        gateReason,
        createdBy: ctx.userId,
      },
      update: { mode, minimumReviewerRole, requireLicensedBroker, gateReason },
    });

    upserted.push(row);
  }

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "STAGE_GATE_POLICY_UPDATED",
    entity: "StageGatePolicy",
    entityId: ctx.accountId,
    source: "UI",
    metadata: {
      count: upserted.length,
      stages: upserted.map((p) => `${p.stage}${p.entryType ? `:${p.entryType}` : ""}=${p.mode}`),
    },
    success: true,
  });

  return NextResponse.json({ policies: upserted });
}, { permission: "settings.manage", write: true });
