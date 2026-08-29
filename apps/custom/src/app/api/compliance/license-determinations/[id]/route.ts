/**
 * GET /api/compliance/license-determinations/[id]
 * POST /api/compliance/license-determinations/[id] -- review/override disposition
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { reviewLicenseDetermination } from "@/modules/licenses/determinationService";

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ params, ctx, requestId }) => {
    const determination = await db.licenseDeterminationResult.findFirst({
      where: { id: params.id, accountId: ctx.accountId },
    });
    if (!determination) {
      return buildErrorResponse(404, "NOT_FOUND", "License determination not found.", undefined, requestId);
    }
    return NextResponse.json({ determination, requestId });
  },
  { permission: "licenseDetermination.view" }
);

const reviewSchema = z.object({
  disposition: z.enum(["VERIFIED", "RETURNED_FOR_INFO", "OVERRIDDEN"]),
  reviewReason: z.string().optional(),
  overrideType: z.string().optional(),
  overrideReason: z.string().optional(),
  newFinalDecision: z
    .enum([
      "LICENSE_REQUIRED",
      "NO_LICENSE_REQUIRED",
      "LICENSE_EXCEPTION_APPLIES",
      "REVIEW_REQUIRED",
      "INCOMPLETE",
      "INVALID_CLASSIFICATION",
      "UNSUPPORTED_JURISDICTION",
      "RULE_DATA_UNAVAILABLE",
      "BLOCKED",
      "ERROR",
    ])
    .optional(),
});

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, params, ctx, requestId }) => {
    const body = await req.json().catch(() => null);
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return buildErrorResponse(400, "INVALID_INPUT", "Request validation failed", parsed.error.issues, requestId);
    }
    if (parsed.data.disposition === "OVERRIDDEN" && !parsed.data.overrideReason?.trim()) {
      return buildErrorResponse(400, "INVALID_INPUT", "overrideReason is required to override a determination.", undefined, requestId);
    }

    const updated = await reviewLicenseDetermination({
      accountId: ctx.accountId,
      determinationId: params.id,
      userId: ctx.userId,
      ...parsed.data,
    });
    if (!updated) {
      return buildErrorResponse(404, "NOT_FOUND", "License determination not found.", undefined, requestId);
    }

    return NextResponse.json({ determination: updated, requestId });
  },
  { permission: "licenseDetermination.review", write: true }
);
