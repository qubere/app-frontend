import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { PoaService } from "@/modules/onboarding/poa.service";

const createSchema = z.object({
  caseId: z.string().min(1),
  entityId: z.string().min(1),
  templateId: z.string().optional(),
  executionMethod: z.enum(["E_SIGN", "WET_INK", "WET_INK_NOTARIZED"]),
  providerName: z.enum(["INTERNAL", "DROPBOX_SIGN", "MANUAL_UPLOAD"]).optional(),
  signer: z.object({
    name: z.string().min(1),
    title: z.string().optional(),
    role: z.string().min(1),
    email: z.string().email().optional(),
  }),
});

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, createSchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    try {
      const poa = await PoaService.createPoa(ctx.accountId, ctx.userId, bodyVal.data);
      return NextResponse.json({ poa, requestId }, { status: 201 });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND")
        return buildErrorResponse(404, "NOT_FOUND", "Entity not found", undefined, requestId);
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
