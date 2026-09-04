import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { getRequestLocale, localizeDescription } from "@/lib/i18n/serverLocale";

/**
 * GET /api/filing-config/actions
 * Returns action codes from FilingActionCatalog, with optionLabels
 * localized to the caller's current UI locale (from
 * FilingActionCatalog.descriptions).
 */
export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
  }

  const locale = await getRequestLocale();
  const actions = await db.filingActionCatalog.findMany({
    where: { isActive: true },
    select: { code: true, descriptions: true },
    orderBy: { code: "asc" },
  });

  return NextResponse.json({
    codes: actions.map((action) => action.code),
    optionLabels: Object.fromEntries(
      actions.map((action) => [action.code, localizeDescription(action.descriptions, locale, action.code)])
    ),
    requestId,
  });
});

