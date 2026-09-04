/**
 * GET   /api/compliance/licenses/[id] -- license header + lines + parties + notes.
 * PATCH /api/compliance/licenses/[id] -- update header fields/status.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { createAuditLog, diff } from "@/lib/audit";

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ params, ctx, requestId }) => {
    const license = await db.license.findFirst({
      where: { id: params.id, accountId: ctx.accountId },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        parties: { include: { party: true } },
        documents: true,
        licenseNotes: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!license) {
      return buildErrorResponse(404, "NOT_FOUND", "License not found.", undefined, requestId);
    }
    return NextResponse.json({ license, requestId });
  },
  { permission: "licenses.view" }
);

const updateSchema = z.object({
  licenseType: z.string().optional(),
  agency: z.string().optional().nullable(),
  jurisdiction: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  effectiveDate: z.coerce.date().optional(),
  originalExpirationDate: z.coerce.date().optional().nullable(),
  expirationDate: z.coerce.date().optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "SUSPENDED", "EXPIRED", "REVOKED", "CLOSED"]).optional(),
  purchaserPartyId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const PATCH = withAuthenticatedRoute<{ id: string }>(
  async ({ req, params, ctx, requestId }) => {
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return buildErrorResponse(400, "INVALID_INPUT", "Request validation failed", parsed.error.issues, requestId);
    }

    const existing = await db.license.findFirst({ where: { id: params.id, accountId: ctx.accountId } });
    if (!existing) {
      return buildErrorResponse(404, "NOT_FOUND", "License not found.", undefined, requestId);
    }

    const updated = await db.license.update({
      where: { id: existing.id },
      data: { ...parsed.data, updatedByUserId: ctx.userId },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "LICENSE_UPDATED",
      entity: "License",
      entityId: updated.id,
      source: "UI",
      metadata: diff(existing, updated),
    });

    return NextResponse.json({ license: updated, requestId });
  },
  { permission: "licenses.update", write: true }
);

/** Soft-closes a license (status: CLOSED) -- never a hard delete of an authorization record. */
export const DELETE = withAuthenticatedRoute<{ id: string }>(
  async ({ req, params, ctx, requestId }) => {
    const existing = await db.license.findFirst({ where: { id: params.id, accountId: ctx.accountId } });
    if (!existing) {
      return buildErrorResponse(404, "NOT_FOUND", "License not found.", undefined, requestId);
    }
    if (existing.status === "CLOSED") {
      return buildErrorResponse(409, "ALREADY_CLOSED", "License is already closed.", undefined, requestId);
    }

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : undefined;

    const closed = await db.license.update({
      where: { id: existing.id },
      data: { status: "CLOSED", updatedByUserId: ctx.userId },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "LICENSE_CLOSED",
      entity: "License",
      entityId: closed.id,
      source: "UI",
      metadata: { previousStatus: existing.status, reason },
    });

    return NextResponse.json({ license: closed, requestId });
  },
  { permission: "licenses.delete", write: true }
);
