/**
 * POST /api/compliance/licenses/[id]/lines -- add a licensed line to a license.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { CLASSIFICATION_TYPES } from "@/modules/licenses/classification";

const createLineSchema = z.object({
  lineNumber: z.number().int().positive(),
  productId: z.string().optional().nullable(),
  productDescription: z.string().optional().nullable(),
  classificationType: z.enum(CLASSIFICATION_TYPES as [string, ...string[]]).optional().nullable(),
  classificationNumber: z.string().optional().nullable(),
  licensedQuantity: z.union([z.number(), z.string()]).optional().nullable(),
  licensedValue: z.union([z.number(), z.string()]).optional().nullable(),
  uom: z.string().optional().nullable(),
  currency: z.string().optional().nullable(),
  replacementIndicator: z.boolean().optional(),
});

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, params, ctx, requestId }) => {
    const body = await req.json().catch(() => null);
    const parsed = createLineSchema.safeParse(body);
    if (!parsed.success) {
      return buildErrorResponse(400, "INVALID_INPUT", "Request validation failed", parsed.error.issues, requestId);
    }

    const license = await db.license.findFirst({ where: { id: params.id, accountId: ctx.accountId } });
    if (!license) {
      return buildErrorResponse(404, "NOT_FOUND", "License not found.", undefined, requestId);
    }

    const existingLine = await db.licenseLine.findUnique({
      where: { licenseId_lineNumber: { licenseId: license.id, lineNumber: parsed.data.lineNumber } },
    });
    if (existingLine) {
      return buildErrorResponse(409, "DUPLICATE_LINE_NUMBER", "A line with this number already exists on this license.", undefined, requestId);
    }

    const line = await db.licenseLine.create({
      data: {
        accountId: ctx.accountId,
        licenseId: license.id,
        ...parsed.data,
      },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "LICENSE_LINE_CREATED",
      entity: "LicenseLine",
      entityId: line.id,
      source: "UI",
      metadata: { licenseId: license.id, lineNumber: line.lineNumber },
    });

    return NextResponse.json({ line, requestId }, { status: 201 });
  },
  { permission: "licenses.update", write: true }
);
