/**
 * POST /api/compliance/license-lines/[id]/events -- post a utilization event
 * (order commitment / shipment / assignment / release / reversal / renewal /
 * expiration / update / opening balance) to a license line via the
 * canonical utilizationService (concurrency-safe, dedupe-safe).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { postLicenseEvent, LicenseEventConflictError } from "@/modules/licenses/utilizationService";

const eventSchema = z.object({
  eventType: z.enum([
    "ORDER_COMMITMENT",
    "SHIPMENT",
    "ASSIGNMENT",
    "RELEASE",
    "REVERSAL",
    "RENEWAL",
    "EXPIRATION",
    "UPDATE",
    "OPENING_BALANCE",
  ]),
  quantityDelta: z.union([z.number(), z.string()]).optional(),
  valueDelta: z.union([z.number(), z.string()]).optional(),
  sourceSystem: z.string().optional().nullable(),
  sourceEventId: z.string().optional().nullable(),
  transactionId: z.string().optional().nullable(),
  transactionLineId: z.string().optional().nullable(),
  shipmentId: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, params, ctx, requestId }) => {
    const line = await db.licenseLine.findFirst({ where: { id: params.id, accountId: ctx.accountId } });
    if (!line) {
      return buildErrorResponse(404, "NOT_FOUND", "License line not found.", undefined, requestId);
    }

    const body = await req.json().catch(() => null);
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
      return buildErrorResponse(400, "INVALID_INPUT", "Request validation failed", parsed.error.issues, requestId);
    }

    try {
      const { event, deduped } = await postLicenseEvent({
        accountId: ctx.accountId,
        licenseLineId: line.id,
        userId: ctx.userId,
        ...parsed.data,
      });
      return NextResponse.json({ event, deduped, requestId }, { status: deduped ? 200 : 201 });
    } catch (error) {
      if (error instanceof LicenseEventConflictError) {
        return buildErrorResponse(409, "LICENSE_EVENT_CONFLICT", error.message, undefined, requestId);
      }
      throw error;
    }
  },
  { permission: "licenses.post_events", write: true }
);

/** Lists the immutable utilization ledger for a single license line, newest first. */
export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ params, ctx, requestId }) => {
    const line = await db.licenseLine.findFirst({ where: { id: params.id, accountId: ctx.accountId } });
    if (!line) {
      return buildErrorResponse(404, "NOT_FOUND", "License line not found.", undefined, requestId);
    }

    const events = await db.licenseEvent.findMany({
      where: { licenseLineId: line.id, accountId: ctx.accountId },
      orderBy: { eventAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ events, requestId });
  },
  { permission: "licenses.view" }
);
