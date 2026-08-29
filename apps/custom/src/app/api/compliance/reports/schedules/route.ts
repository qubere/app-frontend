import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { computeNextRun } from "@/modules/reports/scheduler";

export const GET = withAuthenticatedRoute(async ({ ctx }) => {
  const schedules = await db.reportSchedule.findMany({
    where: { accountId: ctx.accountId },
    include: { reportDefinition: true },
    orderBy: { nextRunAt: "asc" },
  });
  return NextResponse.json({ schedules });
}, { permission: "compliance.reports.view" });

export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json().catch(() => null);
  const reportDefinitionId = typeof body?.reportDefinitionId === "string" ? body.reportDefinitionId : "";
  const frequency = typeof body?.frequency === "string" ? body.frequency : "";
  const format = typeof body?.format === "string" ? body.format : "CSV";
  const timezone = typeof body?.timezone === "string" && body.timezone ? body.timezone : "UTC";
  const scheduleConfig = (body?.scheduleConfig ?? {}) as Record<string, unknown>;

  if (!["ONCE", "DAILY", "WEEKLY", "MONTHLY"].includes(frequency)) {
    return NextResponse.json({ error: "Invalid frequency.", code: "SCHEDULE_ERROR" }, { status: 400 });
  }

  const definition = await db.reportDefinition.findFirst({
    where: { id: reportDefinitionId, accountId: ctx.accountId, isActive: true },
  });
  if (!definition) {
    return NextResponse.json({ error: "Saved report not found.", code: "INVALID_REQUEST" }, { status: 400 });
  }

  const nextRunAt = computeNextRun({ frequency, scheduleConfig, lastRunAt: null });

  const schedule = await db.reportSchedule.create({
    data: {
      accountId: ctx.accountId,
      reportDefinitionId,
      ownerUserId: ctx.userId,
      frequency: frequency as never,
      timezone,
      scheduleConfig: scheduleConfig as Prisma.InputJsonValue,
      format,
      nextRunAt,
      deliveryConfig: body?.deliveryConfig ?? undefined,
    },
  });

  return NextResponse.json({ schedule }, { status: 201 });
}, { permission: "compliance.reports.manage", write: true });
