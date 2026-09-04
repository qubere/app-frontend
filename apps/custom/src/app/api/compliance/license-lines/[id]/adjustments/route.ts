/**
 * POST /api/compliance/license-lines/[id]/adjustments -- post a manual,
 * reason-required correction to a license line's ledger totals.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { postLicenseAdjustment, LicenseEventConflictError } from "@/modules/licenses/utilizationService";

const adjustmentSchema = z.object({
  adjustmentType: z.enum(["INCREASE", "DECREASE", "CORRECTION", "OPENING_BALANCE"]),
  quantityDelta: z.union([z.number(), z.string()]).optional(),
  valueDelta: z.union([z.number(), z.string()]).optional(),
  reason: z.string().min(1),
  relatedEventId: z.string().optional().nullable(),
});

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, params, ctx, requestId }) => {
    const line = await db.licenseLine.findFirst({ where: { id: params.id, accountId: ctx.accountId } });
    if (!line) {
      return buildErrorResponse(404, "NOT_FOUND", "License line not found.", undefined, requestId);
    }

    const body = await req.json().catch(() => null);
    const parsed = adjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return buildErrorResponse(400, "INVALID_INPUT", "Request validation failed", parsed.error.issues, requestId);
    }

    try {
      const adjustment = await postLicenseAdjustment({
        accountId: ctx.accountId,
        licenseLineId: line.id,
        userId: ctx.userId,
        ...parsed.data,
      });
      return NextResponse.json({ adjustment, requestId }, { status: 201 });
    } catch (error) {
      if (error instanceof LicenseEventConflictError) {
        return buildErrorResponse(409, "LICENSE_ADJUSTMENT_CONFLICT", error.message, undefined, requestId);
      }
      throw error;
    }
  },
  { permission: "licenses.adjust", write: true }
);

/** Lists the reason-required adjustment history for a single license line, newest first. */
export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ params, ctx, requestId }) => {
    const line = await db.licenseLine.findFirst({ where: { id: params.id, accountId: ctx.accountId } });
    if (!line) {
      return buildErrorResponse(404, "NOT_FOUND", "License line not found.", undefined, requestId);
    }

    const adjustments = await db.licenseAdjustment.findMany({
      where: { licenseLineId: line.id, accountId: ctx.accountId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ adjustments, requestId });
  },
  { permission: "licenses.view" }
);
