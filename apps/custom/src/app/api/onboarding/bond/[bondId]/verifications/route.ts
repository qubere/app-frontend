import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { BondVerificationService } from "@/modules/onboarding/bondVerification.service";

export const GET = withAuthenticatedRoute<{ bondId: string }>(
  async ({ params, ctx, requestId }) => {
    try {
      const verifications = await BondVerificationService.listVerifications(ctx.accountId, params.bondId);
      return NextResponse.json({ verifications, requestId });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND")
        return buildErrorResponse(404, "NOT_FOUND", "Bond not found", undefined, requestId);
      return buildErrorResponse(500, "INTERNAL_ERROR", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage" }
);
