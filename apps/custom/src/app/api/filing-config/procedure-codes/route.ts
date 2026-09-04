import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { getRequestLocale, localizeDescription } from "@/lib/i18n/serverLocale";

/**
 * GET /api/filing-config/procedure-codes
 * Returns active filing procedure codes for procedureCode dropdowns across
 * Filing Configuration (Action Message Mapping, Action Configuration, Action
 * Data Requirement, etc.), with optionLabels localized to the caller's
 * current UI locale.
 *
 * Sources from FilingProcedureCatalog (the admin-managed procedure code
 * master), not a distinct-values scan of FilingProcedureConfig as before --
 * that only ever offered already-used codes, which made it impossible to
 * configure a brand new procedure code's first action mapping.
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

