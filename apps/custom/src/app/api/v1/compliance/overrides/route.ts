/**
 * POST /api/v1/compliance/overrides
 *
 * Creates a formal compliance override (ComplianceFormalOverride). Requires
 * `compliance.override`. Always attributed to the authenticated session
 * user -- overriddenByUserId is taken from ctx, never from the request
 * body, so this can never be spoofed as another user or as a
 * system/LLM-initiated action.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { parseAndValidateBody } from "@/lib/api/validation";
import { createFormalOverride, FormalOverrideValidationError } from "@/modules/compliance/formalOverride";

const createOverrideSchema = z.object({
  executionId: z.string().optional(),
  resultRefType: z.string().min(1),
  resultRefId: z.string().min(1),
  originalDecision: z.string().min(1),
  overrideDecision: z.string().min(1),
  reason: z.string().min(1),
});

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const body = await parseAndValidateBody(req, createOverrideSchema, requestId);
    if ("response" in body) return body.response;

    if (!ctx.userId) {
      return NextResponse.json(
        { error: "A formal override must be created by an authenticated human user", requestId },
        { status: 403 }
      );
    }

    try {
      const override = await createFormalOverride({
        accountId: ctx.accountId,
        executionId: body.data.executionId ?? null,
        resultRefType: body.data.resultRefType,
        resultRefId: body.data.resultRefId,
        originalDecision: body.data.originalDecision,
        overrideDecision: body.data.overrideDecision,
        reason: body.data.reason,
        overriddenByUserId: ctx.userId,
        requestId,
      });
      return NextResponse.json({ success: true, override, requestId }, { status: 201 });
    } catch (err) {
      if (err instanceof FormalOverrideValidationError) {
        return NextResponse.json({ error: err.message, requestId }, { status: 400 });
      }
      throw err;
    }
  },
  { permission: "compliance.override", write: true }
);
