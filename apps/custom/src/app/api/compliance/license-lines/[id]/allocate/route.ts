/**
 * POST /api/compliance/license-lines/[id]/allocate -- reserve remaining
 * license-line capacity against a determination/shipment.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import {
  reserveLicenseAllocation,
  InsufficientLicenseCapacityError,
  LicenseEventConflictError,
} from "@/modules/licenses/allocationService";

const allocateSchema = z.object({
  determinationId: z.string().optional().nullable(),
  shipmentId: z.string().optional().nullable(),
  lineItemId: z.string().optional().nullable(),
  quantity: z.union([z.number(), z.string()]).optional().nullable(),
  value: z.union([z.number(), z.string()]).optional().nullable(),
  transactionId: z.string().optional().nullable(),
  transactionLineId: z.string().optional().nullable(),
});

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, params, ctx, requestId }) => {
    const line = await db.licenseLine.findFirst({ where: { id: params.id, accountId: ctx.accountId } });
    if (!line) {
      return buildErrorResponse(404, "NOT_FOUND", "License line not found.", undefined, requestId);
    }

    const body = await req.json().catch(() => null);
    const parsed = allocateSchema.safeParse(body);
    if (!parsed.success) {
      return buildErrorResponse(400, "INVALID_INPUT", "Request validation failed", parsed.error.issues, requestId);
    }

    try {
      const allocation = await reserveLicenseAllocation({
        accountId: ctx.accountId,
        licenseLineId: line.id,
        userId: ctx.userId,
        ...parsed.data,
      });
      return NextResponse.json({ allocation, requestId }, { status: 201 });
    } catch (error) {
      if (error instanceof InsufficientLicenseCapacityError) {
        return buildErrorResponse(422, "INSUFFICIENT_LICENSE_CAPACITY", error.message, undefined, requestId);
      }
      if (error instanceof LicenseEventConflictError) {
        return buildErrorResponse(409, "LICENSE_EVENT_CONFLICT", error.message, undefined, requestId);
      }
      throw error;
    }
  },
  { permission: "licenses.allocate", write: true }
);

/** Lists allocations reserved/released against a single license line, newest first. */
export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ params, ctx, requestId }) => {
    const line = await db.licenseLine.findFirst({ where: { id: params.id, accountId: ctx.accountId } });
    if (!line) {
      return buildErrorResponse(404, "NOT_FOUND", "License line not found.", undefined, requestId);
    }

    const allocations = await db.licenseAllocation.findMany({
      where: { licenseLineId: line.id, accountId: ctx.accountId },
      orderBy: { reservedAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ allocations, requestId });
  },
  { permission: "licenses.view" }
);
