import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";

/**
 * GET /api/filing-config/procedure-configs?country=NL&procedureCode=H1
 *
 * Supplies the visual editor's country → procedure → message selector.
 */
export const GET = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return buildErrorResponse(
      403,
      "FORBIDDEN",
      "Filing configuration is available to Platform Admins only.",
      undefined,
      requestId
    );
  }

  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country");
  const procedureCode = searchParams.get("procedureCode");

  const where: { isActive: true; country?: string; procedureCode?: string } = { isActive: true };
  if (country) where.country = country;
  if (procedureCode) where.procedureCode = procedureCode;

  const configs = await db.filingProcedureConfig.findMany({
    where,
    select: {
      id: true,
      country: true,
      procedureCode: true,
      messageName: true,
      filingSchemaId: true,
    },
    orderBy: [
      { country: "asc" },
      { procedureCode: "asc" },
      { messageName: "asc" },
    ],
  });

  return NextResponse.json({ configs, requestId });
});
