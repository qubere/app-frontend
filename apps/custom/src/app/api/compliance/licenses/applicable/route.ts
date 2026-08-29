/**
 * POST /api/compliance/licenses/applicable -- find candidate managed
 * License Lines that could satisfy a LICENSE_REQUIRED determination.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { findApplicableLicenses } from "@/modules/licenses/applicabilityService";
import { CLASSIFICATION_TYPES } from "@/modules/licenses/classification";

const requestSchema = z.object({
  classificationType: z.enum(CLASSIFICATION_TYPES as [string, ...string[]]).optional(),
  classificationNumber: z.string().optional(),
  destinationCountry: z.string().optional().nullable(),
});

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const body = await req.json().catch(() => null);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return buildErrorResponse(400, "INVALID_INPUT", "Request validation failed", parsed.error.issues, requestId);
    }

    const candidates = await findApplicableLicenses({ accountId: ctx.accountId, ...parsed.data });
    return NextResponse.json({ candidates, requestId });
  },
  { permission: "licenses.view" }
);
