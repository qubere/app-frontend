import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";

/**
 * GET /api/filing-config/list-types
 * Returns active FilingCodeListType rows as select options, for the Filing
 * Code List Header's "List Type" dropdown (the only real FK relationship in
 * the code-list-* table set).
 */
export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
  }

  const types = await db.filingCodeListType.findMany({
    where: { isActive: true },
    select: { listType: true, listTypeName: true },
    orderBy: { listType: "asc" },
  });

  return NextResponse.json({
    codes: types.map((t) => t.listType),
    optionLabels: Object.fromEntries(types.map((t) => [t.listType, `${t.listType} — ${t.listTypeName}`])),
    requestId,
  });
});
