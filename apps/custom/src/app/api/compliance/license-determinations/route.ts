/**
 * GET /api/compliance/license-determinations
 *
 * Lists LicenseDeterminationResult rows for the current tenant, optionally
 * filtered by status/shipmentId/operationType.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";

export const GET = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const operationType = url.searchParams.get("operationType") ?? undefined;
    const shipmentId = url.searchParams.get("shipmentId") ?? undefined;
    const take = Math.min(Number(url.searchParams.get("take") ?? 50) || 50, 200);
    const cursor = url.searchParams.get("cursor") ?? undefined;

    const determinations = await db.licenseDeterminationResult.findMany({
      where: {
        accountId: ctx.accountId,
        ...(status ? { status: status as never } : {}),
        ...(operationType ? { operationType: operationType as never } : {}),
        ...(shipmentId ? { shipmentId } : {}),
      },
      orderBy: { automatedAt: "desc" },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    return NextResponse.json({
      determinations,
      requestId,
      nextCursor: determinations.length === take ? determinations[determinations.length - 1]?.id : null,
    });
  },
  { permission: "license_determination.view" }
);
