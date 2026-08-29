import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { getCatalogEntry } from "@/modules/reports/catalog";

export const GET = withAuthenticatedRoute(async ({ ctx }) => {
  const definitions = await db.reportDefinition.findMany({
    where: {
      accountId: ctx.accountId,
      isActive: true,
      OR: [{ ownerUserId: ctx.userId }, { isShared: true }],
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ definitions });
}, { permission: "compliance.reports.view" });

export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const reportType = typeof body?.reportType === "string" ? body.reportType : "";
  const filters = (body?.filters ?? {}) as Record<string, unknown>;
  const isShared = Boolean(body?.isShared);

  if (!name || !getCatalogEntry(reportType)) {
    return NextResponse.json({ error: "name and a valid reportType are required.", code: "INVALID_REQUEST" }, { status: 400 });
  }
  if (isShared && !ctx.permissions.includes("compliance.reports.manage")) {
    return NextResponse.json({ error: "Sharing a saved report requires compliance.reports.manage.", code: "FORBIDDEN" }, { status: 403 });
  }

  const definition = await db.reportDefinition.create({
    data: {
      accountId: ctx.accountId,
      ownerUserId: ctx.userId,
      name,
      reportType,
      filters: filters as Prisma.InputJsonValue,
      columns: body?.columns ?? undefined,
      sort: body?.sort ?? undefined,
      defaultFormat: typeof body?.defaultFormat === "string" ? body.defaultFormat : "CSV",
      isShared,
    },
  });

  return NextResponse.json({ definition }, { status: 201 });
}, { permission: "compliance.reports.generate", write: true });
