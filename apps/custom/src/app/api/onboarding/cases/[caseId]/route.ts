import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { CaseService } from "@/modules/onboarding/case.service";

const patchSchema = z.object({
  assignedUserId: z.string().nullable().optional(),
  projectedAnnualDutyTaxFee: z.string().optional(),
  path: z.enum(["STANDARD", "SWITCHING", "NON_RESIDENT", "BULK", "ERP"]).optional(),
});

export const GET = withAuthenticatedRoute(
  async ({ params, ctx, requestId }) => {
    try {
      const result = await CaseService.getCase(ctx.accountId, params.caseId as string);
      return NextResponse.json({ case: result, requestId });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND") return buildErrorResponse(404, "NOT_FOUND", "Onboarding case not found", undefined, requestId);
      return buildErrorResponse(500, "INTERNAL_ERROR", errorMessage(error) || "Failed to get case", undefined, requestId);
    }
  },
  { permission: "onboarding.manage" }
);

export const PATCH = withAuthenticatedRoute(
  async ({ req, params, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, patchSchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    try {
      const updated = await CaseService.patchCase(ctx.accountId, params.caseId as string, bodyVal.data);
      return NextResponse.json({ case: updated, requestId });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND") return buildErrorResponse(404, "NOT_FOUND", "Onboarding case not found", undefined, requestId);
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed to update case", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
