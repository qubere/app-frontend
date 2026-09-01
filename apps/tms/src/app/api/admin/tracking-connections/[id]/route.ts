import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";

const updateConnectionSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) });

export const PATCH = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, params }: any) => {
    const { id } = await params;
    const parsed = updateConnectionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });

    const existing = await db.integrationConfig.findFirst({
      where: { id, accountId: ctx.accountId, category: "SHIPMENT_TRACKING" },
      select: { id: true, status: true, provider: true },
    });
    if (!existing) return NextResponse.json({ error: "CONNECTION_NOT_FOUND" }, { status: 404 });

    await db.integrationConfig.updateMany({
      where: { id, accountId: ctx.accountId, category: "SHIPMENT_TRACKING" },
      data: { status: parsed.data.status },
    });
    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: parsed.data.status === "ACTIVE" ? "TRACKING_CONNECTION_ENABLED" : "TRACKING_CONNECTION_DISABLED",
      entity: "IntegrationConfig",
      entityId: id,
      source: "UI",
      beforeJson: { status: existing.status },
      afterJson: { status: parsed.data.status },
      metadata: { provider: existing.provider },
    });

    return NextResponse.json({ success: true, status: parsed.data.status });
  },
  { permission: "integration.disable", write: true }
);
