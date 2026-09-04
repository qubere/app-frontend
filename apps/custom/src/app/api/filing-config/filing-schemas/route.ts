import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";

/**
 * GET /api/filing-config/filing-schemas
 * Returns active FilingSchema ids for the Procedure Configuration tab's
 * "Filing Schema" dropdown, labeled with their path + version so an admin
 * can tell which schema document a row is pointing at.
 */
export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
  }

  const schemas = await db.filingSchema.findMany({
    where: { isActive: true },
    select: { id: true, schemaPath: true, schemaVersion: true },
    orderBy: [{ schemaPath: "asc" }, { schemaVersion: "asc" }],
  });

  return NextResponse.json({
    codes: schemas.map((schema) => schema.id),
    optionLabels: Object.fromEntries(schemas.map((schema) => [schema.id, `${schema.schemaPath} (v${schema.schemaVersion})`])),
    requestId,
  });
});
