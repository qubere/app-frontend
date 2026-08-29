import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";

export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  const { searchParams } = new URL(req.url);
  const reportType = searchParams.get("reportType") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10) || 50));

  const where = { accountId: ctx.accountId, ...(reportType ? { reportType } : {}) };

  const [total, runs] = await Promise.all([
    db.reportRun.count({ where }),
    db.reportRun.findMany({
      where,
      include: { artifacts: true },
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    runs: runs.map((r) => ({ ...r, artifacts: r.artifacts.map((a) => ({ ...a, sizeBytes: a.sizeBytes?.toString() ?? null })) })),
    count: total,
    page,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
}, { permission: "compliance.reports.view" });
