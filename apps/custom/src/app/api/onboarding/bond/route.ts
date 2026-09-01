import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { BondVerificationService } from "@/modules/onboarding/bondVerification.service";

const schema = z.object({
  caseId: z.string().min(1),
  entityId: z.string().min(1),
  coverage: z.enum(["own", "broker_bond", "single_transaction", "none"]),
  bond: z.object({
    suretyName: z.string().min(1),
    suretyCode: z.string().optional(),
    bondNumber: z.string().min(1),
    bondType: z.enum(["continuous", "single_transaction"]).optional(),
    bondAmount: z.number().positive(),
    activityCode: z.string().optional(),
    effectiveDate: z.string().optional(),
    expirationDate: z.string().optional(),
  }).optional(),
});

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, schema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    const { caseId, entityId, coverage, bond } = bodyVal.data;
    try {
      const result = await BondVerificationService.createBondForEntity(
        ctx.accountId,
        caseId,
        entityId,
        ctx.userId,
        { coverage, bond }
      );
      return NextResponse.json({ ...result, requestId }, { status: 201 });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND")
        return buildErrorResponse(404, "NOT_FOUND", "Entity not found", undefined, requestId);
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
