/**
 * POST /api/compliance/licenses/[id]/notes -- add a free-text note to a license.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

const noteSchema = z.object({ content: z.string().min(1) });

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, params, ctx, requestId }) => {
    const license = await db.license.findFirst({ where: { id: params.id, accountId: ctx.accountId } });
    if (!license) {
      return buildErrorResponse(404, "NOT_FOUND", "License not found.", undefined, requestId);
    }
    const body = await req.json().catch(() => null);
    const parsed = noteSchema.safeParse(body);
    if (!parsed.success) {
      return buildErrorResponse(400, "INVALID_INPUT", "Request validation failed", parsed.error.issues, requestId);
    }

    const note = await db.licenseNote.create({
      data: { accountId: ctx.accountId, licenseId: license.id, authorUserId: ctx.userId, content: parsed.data.content },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "LICENSE_NOTE_ADDED",
      entity: "LicenseNote",
      entityId: note.id,
      source: "UI",
      metadata: { licenseId: license.id },
    });

    return NextResponse.json({ note, requestId }, { status: 201 });
  },
  { permission: "licenses.update", write: true }
);
