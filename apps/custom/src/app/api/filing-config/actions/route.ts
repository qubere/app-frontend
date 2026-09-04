import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";

/**
 * GET /api/filing-config/actions
 * Returns action codes from FilingActionCatalog
 */
export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
  }

  const actions = await db.filingActionCatalog.findMany({
    where: { isActive: true },
    select: { code: true },
    orderBy: { code: "asc" },
  });

  return NextResponse.json({ 
    codes: actions.map(a => a.code),
    requestId 
  });
});
