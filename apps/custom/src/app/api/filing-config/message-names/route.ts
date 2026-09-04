import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";

/**
 * GET /api/filing-config/message-names
 * Returns distinct message names from FilingProcedureConfig
 */
export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
  }

  const results = await db.filingProcedureConfig.findMany({
    where: { isActive: true },
    select: { messageName: true },
    distinct: ['messageName'],
    orderBy: { messageName: "asc" },
  });

  return NextResponse.json({ 
    codes: results.map(r => r.messageName),
    requestId 
  });
});
