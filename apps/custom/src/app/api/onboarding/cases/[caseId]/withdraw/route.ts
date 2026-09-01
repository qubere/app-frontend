import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { CaseService } from "@/modules/onboarding/case.service";

const schema = z.object({ reason: z.string().min(1, "reason is required") });

export const POST = withAuthenticatedRoute(
  async ({ req, params, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, schema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    try {
      const result = await CaseService.withdrawCase(ctx.accountId, params.caseId as string, ctx.userId, bodyVal.data.reason);
      return NextResponse.json({ ...result, requestId });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND") return buildErrorResponse(404, "NOT_FOUND", "Case not found", undefined, requestId);
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Withdraw failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
