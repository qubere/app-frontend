import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { CaseService } from "@/modules/onboarding/case.service";

export const GET = withAuthenticatedRoute(
  async ({ params, ctx, requestId }) => {
    try {
      const events = await CaseService.listEvents(ctx.accountId, params.caseId as string);
      return NextResponse.json({ events, requestId });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND") return buildErrorResponse(404, "NOT_FOUND", "Case not found", undefined, requestId);
      return buildErrorResponse(500, "INTERNAL_ERROR", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage" }
);
