import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { CaseService } from "@/modules/onboarding/case.service";

export const POST = withAuthenticatedRoute(
  async ({ params, ctx, requestId }) => {
    try {
      const result = await CaseService.activateCase(ctx.accountId, params.caseId as string, ctx.userId);
      return NextResponse.json({ ...result, requestId });
    } catch (error: unknown) {
      const err = error as { code?: string; blockers?: unknown[] };
      if (err.code === "NOT_FOUND") return buildErrorResponse(404, "NOT_FOUND", "Case not found", undefined, requestId);
      if (err.code === "NOT_READY") {
        return NextResponse.json(
          { error: { code: "NOT_READY", message: "Case not ready to activate", blockers: err.blockers }, requestId },
          { status: 409 }
        );
      }
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Activation failed", undefined, requestId);
    }
  },
  { permission: "onboarding.activate", write: true }
);
