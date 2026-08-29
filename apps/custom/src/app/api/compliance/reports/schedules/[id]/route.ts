import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { computeNextRun } from "@/modules/reports/scheduler";

async function loadOwnedSchedule(accountId: string, id: string) {
  return db.reportSchedule.findFirst({ where: { id, accountId } });
}

export const PUT = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const { id } = params;
  const existing = await loadOwnedSchedule(ctx.accountId, id);
  if (!existing) {
    return NextResponse.json({ error: "Schedule not found.", code: "NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const scheduleConfig = body?.scheduleConfig ?? existing.scheduleConfig;
  const frequency = typeof body?.frequency === "string" ? body.frequency : existing.frequency;

  const schedule = await db.reportSchedule.update({
    where: { id },
    data: {
      frequency: frequency as never,
      timezone: typeof body?.timezone === "string" ? body.timezone : existing.timezone,
      scheduleConfig,
      format: typeof body?.format === "string" ? body.format : existing.format,
      deliveryConfig: body?.deliveryConfig ?? existing.deliveryConfig ?? undefined,
      isActive: body?.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
      nextRunAt: computeNextRun({ frequency, scheduleConfig, lastRunAt: existing.lastRunAt }),
    },
  });

  return NextResponse.json({ schedule });
}, { permission: "compliance.reports.manage", write: true });

export const DELETE = withAuthenticatedRoute<{ id: string }>(async ({ ctx, params }) => {
  const { id } = params;
  const existing = await loadOwnedSchedule(ctx.accountId, id);
  if (!existing) {
    return NextResponse.json({ error: "Schedule not found.", code: "NOT_FOUND" }, { status: 404 });
  }
  await db.reportSchedule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}, { permission: "compliance.reports.manage", write: true });
