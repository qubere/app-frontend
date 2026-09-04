import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { getRequestLocale, localizeDescription } from "@/lib/i18n/serverLocale";

/**
 * GET /api/filing-config/procedure-catalog-codes
 * Returns active filing procedure codes for procedureCode dropdowns, with
 * optionLabels localized to the caller's current UI locale (from
 * FilingProcedureCatalog.descriptions).
 *
 * Deliberately NOT named "procedure-catalog" -- that exact path is also the
 * FilingConfigTableKey used by the generic CRUD route at
 * /api/filing-config/[table], and a static route always shadows a dynamic
 * one at the same path. Giving this its own distinct path keeps both routes
 * reachable (mirrors the old /transaction-types vs "transaction-type" split).
 */
export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
  }

  const locale = await getRequestLocale();
  const procedures = await db.filingProcedureCatalog.findMany({
    where: { isActive: true },
    select: { procedureCode: true, descriptions: true },
    orderBy: { procedureCode: "asc" },
  });

  return NextResponse.json({
    codes: procedures.map((procedure) => procedure.procedureCode),
    optionLabels: Object.fromEntries(
      procedures.map((procedure) => [procedure.procedureCode, localizeDescription(procedure.descriptions, locale, procedure.procedureCode)])
    ),
    requestId,
  });
});

