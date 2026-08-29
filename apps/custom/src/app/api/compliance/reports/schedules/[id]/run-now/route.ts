import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { REPORT_RUN_REQUESTED_EVENT } from "@/lib/inngest/functions/reportRun";

export const POST = withAuthenticatedRoute<{ id: string }>(async ({ ctx, params }) => {
  const { id } = params;
  const schedule = await db.reportSchedule.findFirst({
    where: { id, accountId: ctx.accountId },
    include: { reportDefinition: true },
  });
  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found.", code: "NOT_FOUND" }, { status: 404 });
  }

  const run = await db.reportRun.create({
    data: {
      accountId: schedule.accountId,
      reportDefinitionId: schedule.reportDefinitionId,
      scheduleId: schedule.id,
      reportType: schedule.reportDefinition.reportType,
      format: schedule.format,
      requestedByUserId: ctx.userId,
      filterSnapshot: schedule.reportDefinition.filters ?? {},
    },
  });

  await inngest.send({ name: REPORT_RUN_REQUESTED_EVENT, data: { runId: run.id } });

  return NextResponse.json({ run }, { status: 202 });
}, { permission: "compliance.reports.manage", write: true });

