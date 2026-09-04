import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { BondVerificationService } from "@/modules/onboarding/bondVerification.service";

const schema = z.object({
  note: z.string().min(1, "Attestation note is required"),
  suretyLetterDocumentId: z.string().optional(),
});

export const POST = withAuthenticatedRoute<{ bondId: string }>(
  async ({ req, params, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, schema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    const { note, suretyLetterDocumentId } = bodyVal.data;
    try {
      const verification = await BondVerificationService.attestBond(
        ctx.accountId,
        params.bondId,
        ctx.userId,
        note,
        suretyLetterDocumentId
      );
      return NextResponse.json({ verification, requestId });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND")
        return buildErrorResponse(404, "NOT_FOUND", "Bond not found", undefined, requestId);
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
