import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";

export const GET = withAuthenticatedRoute<{ id: string }>(async ({ ctx, params }) => {
  const { id } = params;
  const run = await db.reportRun.findFirst({
    where: { id, accountId: ctx.accountId },
    include: { artifacts: true },
  });
  if (!run) {
    return NextResponse.json({ error: "Report run not found.", code: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({
    run: { ...run, artifacts: run.artifacts.map((a) => ({ ...a, sizeBytes: a.sizeBytes?.toString() ?? null })) },
  });
}, { permission: "compliance.reports.view" });
