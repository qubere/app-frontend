import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";

/**
 * GET /api/filing-config/releases?country=NL
 * Returns releases from FilingCountryCustomsVersion, optionally filtered by country.
 */
export const GET = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
  }

  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country");

  const where: any = { isActive: true };
  if (country) where.country = country;

  const releases = await db.filingCountryCustomsVersion.findMany({
    where,
    select: {
      id: true,
      country: true,
      procedureCode: true,
      release: true,
      description: true,
    },
    orderBy: [
      { country: "asc" },
      { procedureCode: "asc" },
      { release: "asc" },
    ],
  });

  return NextResponse.json({ releases, requestId });
});