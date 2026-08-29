import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";

export const POST = withAuthenticatedRoute<{ id: string }>(async ({ ctx, params }) => {
  const { id } = params;
  const schedule = await db.reportSchedule.findFirst({ where: { id, accountId: ctx.accountId } });
  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found.", code: "NOT_FOUND" }, { status: 404 });
  }
  await db.reportSchedule.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}, { permission: "compliance.reports.manage", write: true });
