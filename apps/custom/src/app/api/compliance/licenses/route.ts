/**
 * GET  /api/compliance/licenses -- list managed licenses for the tenant.
 * POST /api/compliance/licenses -- create a new managed license header.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export const GET = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const q = url.searchParams.get("q") ?? undefined;
    const take = Math.min(Number(url.searchParams.get("take") ?? 50) || 50, 200);

    const licenses = await db.license.findMany({
      where: {
        accountId: ctx.accountId,
        ...(status ? { status: status as never } : {}),
        ...(q ? { licenseNumber: { contains: q, mode: "insensitive" } } : {}),
      },
      include: { _count: { select: { lines: true } } },
      orderBy: { createdAt: "desc" },
      take,
    });

    return NextResponse.json({ licenses, requestId });
  },
  { permission: "licenses.view" }
);

const createSchema = z.object({
  licenseNumber: z.string().min(1),
  licenseType: z.string().min(1),
  agency: z.string().optional().nullable(),
  jurisdiction: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  effectiveDate: z.coerce.date(),
  originalExpirationDate: z.coerce.date().optional().nullable(),
  expirationDate: z.coerce.date().optional().nullable(),
  purchaserPartyId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return buildErrorResponse(400, "INVALID_INPUT", "Request validation failed", parsed.error.issues, requestId);
    }

    const existing = await db.license.findUnique({
      where: { accountId_licenseNumber: { accountId: ctx.accountId, licenseNumber: parsed.data.licenseNumber } },
    });
    if (existing) {
      return buildErrorResponse(409, "DUPLICATE_LICENSE_NUMBER", "A license with this number already exists.", undefined, requestId);
    }

    const license = await db.license.create({
      data: {
        accountId: ctx.accountId,
        ...parsed.data,
        createdByUserId: ctx.userId,
        updatedByUserId: ctx.userId,
      },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "LICENSE_CREATED",
      entity: "License",
      entityId: license.id,
      source: "UI",
      metadata: { licenseNumber: license.licenseNumber },
    });

    return NextResponse.json({ license, requestId }, { status: 201 });
  },
  { permission: "licenses.create", write: true }
);
