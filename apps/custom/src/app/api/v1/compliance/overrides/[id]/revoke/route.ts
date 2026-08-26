/**
 * POST /api/v1/compliance/overrides/[id]/revoke
 *
 * Revokes a formal compliance override in place -- sets revoked fields, NEVER
 * deletes the row (immutability of the override history). Requires
 * `compliance.override`. Always attributed to the authenticated session
 * user.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { parseAndValidateBody, validatePathParams } from "@/lib/api/validation";
import { revokeFormalOverride, FormalOverrideValidationError } from "@/modules/compliance/formalOverride";

const paramsSchema = z.object({ id: z.string().min(1) });
const revokeBodySchema = z.object({ revokedReason: z.string().min(1) });

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, requestId, params }) => {
    const paramsVal = validatePathParams(params, paramsSchema, requestId);
    if ("response" in paramsVal) return paramsVal.response;

    const body = await parseAndValidateBody(req, revokeBodySchema, requestId);
    if ("response" in body) return body.response;

    try {
      const override = await revokeFormalOverride({
        id: paramsVal.data.id,
        accountId: ctx.accountId,
        revokedByUserId: ctx.userId,
        revokedReason: body.data.revokedReason,
        requestId,
      });
      return NextResponse.json({ success: true, override, requestId }, { status: 200 });
    } catch (err) {
      if (err instanceof FormalOverrideValidationError) {
        return NextResponse.json({ error: err.message, requestId }, { status: 400 });
      }
      throw err;
    }
  },
  { permission: "compliance.override", write: true }
);
