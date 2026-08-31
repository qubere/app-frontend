import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { FiveOhSixService } from "@/modules/onboarding/fiveOhSix.service";

const schema = z.object({
  deliveryMethod: z.enum(["ACE_PORTAL", "PAPER"]),
  confirmationNumber: z.string().optional(),
});

export const POST = withAuthenticatedRoute<{ caseId: string; recordId: string }>(
  async ({ req, params, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, schema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    try {
      const updated = await FiveOhSixService.markFiled(
        ctx.accountId,
        params.caseId,
        params.recordId,
        bodyVal.data,
        ctx.userId
      );
      return NextResponse.json({ record: updated, requestId });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND")
        return buildErrorResponse(404, "NOT_FOUND", "Record not found", undefined, requestId);
      if (err.code === "CONFLICT")
        return buildErrorResponse(409, "CONFLICT", errorMessage(error) || "Conflict", undefined, requestId);
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
