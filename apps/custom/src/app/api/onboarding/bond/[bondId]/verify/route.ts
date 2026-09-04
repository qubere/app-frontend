import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { BondVerificationService } from "@/modules/onboarding/bondVerification.service";

const schema = z.object({
  importerNumber: z.string().min(1),
});

export const POST = withAuthenticatedRoute<{ bondId: string }>(
  async ({ req, params, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, schema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    const { importerNumber } = bodyVal.data;
    try {
      const verification = await BondVerificationService.verifyBond(
        ctx.accountId,
        params.bondId,
        importerNumber,
        ctx.userId
      );
      return NextResponse.json({ verification, requestId });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND")
        return buildErrorResponse(404, "NOT_FOUND", "Bond not found", undefined, requestId);
      return buildErrorResponse(500, "INTERNAL_ERROR", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
