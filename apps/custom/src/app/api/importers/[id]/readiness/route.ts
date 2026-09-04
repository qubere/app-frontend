import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { validatePathParams } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { importerReadiness } from "@/modules/importers/importerReadiness";

const pathSchema = z.object({ id: z.string().min(1) });

export const GET = withAuthenticatedRoute<{ id: string }>(async ({ ctx, params, requestId }) => {
  const path = validatePathParams(params, pathSchema, requestId);
  if ("response" in path) return path.response;
  const importer = await db.importerOfRecord.findFirst({
    where: { id: path.data.id, accountId: ctx.accountId },
    select: {
      id: true,
      clientId: true,
      registrationStatus: true,
      bond: { select: { status: true, expirationDate: true, bondAmount: true, continuousBondFormulaAmount: true } },
      powersOfAttorney: { select: { status: true, expirationDate: true, revokedAt: true } },
      onboardingEntities: { select: { screeningStatus: true, bondCoverage: true }, orderBy: { updatedAt: "desc" }, take: 10 },
    },
  });
  if (!importer) return buildErrorResponse(404, "NOT_FOUND", "Importer not found.", undefined, requestId);
  return NextResponse.json({ readiness: importerReadiness(importer), requestId }, { headers: { "Cache-Control": "no-store" } });
}, { permission: { any: ["parties.manage", "client.read"] } });
