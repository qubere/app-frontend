import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";

/**
 * GET /api/filing-config/customers
 * Returns every non-deleted Account (i.e. customer/tenant) as select options,
 * for the Customer Customs Versions "Customer" dropdown.
 */
export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
  }

  const accounts = await db.account.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    codes: accounts.map((a) => a.id),
    optionLabels: Object.fromEntries(accounts.map((a) => [a.id, a.name])),
    requestId,
  });
});
