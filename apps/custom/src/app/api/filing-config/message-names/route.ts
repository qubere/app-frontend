import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { getRequestLocale, localizeDescription } from "@/lib/i18n/serverLocale";

/**
 * GET /api/filing-config/message-names
 * Returns message names for messageName dropdowns across Filing
 * Configuration, with optionLabels localized to the caller's current UI
 * locale (from FilingMessageCatalog.descriptions).
 *
 * Sources from FilingMessageCatalog (the admin-managed message name
 * master), not a distinct-values scan of FilingProcedureConfig as before --
 * that only ever offered already-used names, which made it impossible to
 * configure a brand new message name's first procedure/action mapping.
 */
export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
  }

  const locale = await getRequestLocale();
  const messages = await db.filingMessageCatalog.findMany({
    where: { isActive: true },
    select: { messageName: true, descriptions: true },
    orderBy: { messageName: "asc" },
  });

  return NextResponse.json({
    codes: messages.map((message) => message.messageName),
    optionLabels: Object.fromEntries(
      messages.map((message) => [message.messageName, localizeDescription(message.descriptions, locale, message.messageName)])
    ),
    requestId,
  });
});

