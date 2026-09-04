import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { PoaService } from "@/modules/onboarding/poa.service";

export const POST = withAuthenticatedRoute(
  async ({ ctx, params, requestId }) => {
    const poaId = params.id as string;
    try {
      const result = await PoaService.sendEnvelope(ctx.accountId, ctx.userId, poaId);
      return NextResponse.json({ ...result, requestId });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND")
        return buildErrorResponse(404, "NOT_FOUND", "POA not found", undefined, requestId);
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
