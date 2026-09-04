import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";

/**
 * GET /api/filing-config/country-customs-versions
 * Returns every active FilingCountryCustomsVersion (id + a human-readable
 * "Country ProcedureCode Release" label), for the Customer Customs Versions
 * "Country Customs Version" dropdown.
 */
export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
  }

  const versions = await db.filingCountryCustomsVersion.findMany({
    where: { isActive: true },
    select: { id: true, country: true, procedureCode: true, release: true },
    orderBy: [{ country: "asc" }, { procedureCode: "asc" }, { release: "asc" }],
  });

  return NextResponse.json({
    codes: versions.map((v) => v.id),
    optionLabels: Object.fromEntries(
      versions.map((v) => [v.id, `${v.country} ${v.procedureCode} ${v.release}`.trim()])
    ),
    requestId,
  });
});
