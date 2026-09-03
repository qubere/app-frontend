import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";

/**
 * GET /api/filing-config/procedure-catalog
 * Returns active filing procedure codes for procedureCode dropdowns.
 */
export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
  }

  const procedures = await db.filingProcedureCatalog.findMany({
    where: { isActive: true },
    select: { procedureCode: true },
    orderBy: { procedureCode: "asc" },
  });

  return NextResponse.json({
    codes: procedures.map((procedure) => procedure.procedureCode),
    requestId,
  });
});
