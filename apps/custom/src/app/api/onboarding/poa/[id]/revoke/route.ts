import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { PoaService } from "@/modules/onboarding/poa.service";

const schema = z.object({ reason: z.string().min(1).max(500) });

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, params, requestId }) => {
    const poaId = params.id as string;
    const bodyVal = await parseAndValidateBody(req, schema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    try {
      const poa = await PoaService.revokePoa(ctx.accountId, ctx.userId, poaId, bodyVal.data.reason);
      return NextResponse.json({ poa, requestId });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND")
        return buildErrorResponse(404, "NOT_FOUND", "POA not found", undefined, requestId);
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
