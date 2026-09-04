import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

async function loadOwnedDefinition(accountId: string, userId: string, id: string) {
  return db.reportDefinition.findFirst({ where: { id, accountId, ownerUserId: userId } });
}

export const PUT = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const { id } = params;
  const existing = await loadOwnedDefinition(ctx.accountId, ctx.userId, id);
  if (!existing) {
    return NextResponse.json({ error: "Saved report not found.", code: "NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const isShared = body?.isShared !== undefined ? Boolean(body.isShared) : existing.isShared;
  if (isShared && !existing.isShared && !ctx.permissions.includes("compliance.reports.manage")) {
    return NextResponse.json({ error: "Sharing a saved report requires compliance.reports.manage.", code: "FORBIDDEN" }, { status: 403 });
  }

  const definition = await db.reportDefinition.update({
    where: { id },
    data: {
      name: typeof body?.name === "string" && body.name.trim() ? body.name.trim() : existing.name,
      filters: body?.filters ?? existing.filters,
      columns: body?.columns ?? existing.columns ?? undefined,
      sort: body?.sort ?? existing.sort ?? undefined,
      defaultFormat: typeof body?.defaultFormat === "string" ? body.defaultFormat : existing.defaultFormat,
      isShared,
      isActive: body?.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
    },
  });

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "COMPLIANCE_REPORT_DEFINITION_UPDATED",
    entity: "ReportDefinition",
    entityId: definition.id,
    source: "UI",
    metadata: { isShared },
  });

  return NextResponse.json({ definition });
}, { permission: "compliance.reports.generate", write: true });

export const DELETE = withAuthenticatedRoute<{ id: string }>(async ({ ctx, params }) => {
  const { id } = params;
  const existing = await loadOwnedDefinition(ctx.accountId, ctx.userId, id);
  if (!existing) {
    return NextResponse.json({ error: "Saved report not found.", code: "NOT_FOUND" }, { status: 404 });
  }
  await db.reportDefinition.update({ where: { id }, data: { isActive: false } });

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "COMPLIANCE_REPORT_DEFINITION_DELETED",
    entity: "ReportDefinition",
    entityId: id,
    source: "UI",
  });

  return NextResponse.json({ ok: true });
}, { permission: "compliance.reports.generate", write: true });
