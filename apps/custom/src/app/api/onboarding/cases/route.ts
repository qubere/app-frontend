import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { CaseService } from "@/modules/onboarding/case.service";

const createCaseSchema = z.object({
  path: z.enum(["STANDARD", "SWITCHING", "NON_RESIDENT", "BULK", "ERP"]),
  clientId: z.string().optional(),
  newClient: z
    .object({
      name: z.string().min(1),
      contactName: z.string().optional(),
      contactEmail: z.string().email().optional(),
    })
    .optional(),
  assignedUserId: z.string().optional(),
});

export const GET = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const { searchParams } = new URL(req.url);
    const filters = {
      status: searchParams.get("status") ?? undefined,
      assignedUserId: searchParams.get("assignee") ?? undefined,
      clientId: searchParams.get("clientId") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    };
    const cases = await CaseService.listCases(ctx.accountId, filters);
    return NextResponse.json({ cases, requestId });
  },
  { permission: "onboarding.manage" }
);

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, createCaseSchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;

    const { data } = bodyVal;
    if (!data.clientId && !data.newClient) {
      return buildErrorResponse(422, "VALIDATION_ERROR", "clientId or newClient is required", undefined, requestId);
    }

    try {
      const onboardingCase = await CaseService.createCase(ctx.accountId, ctx.userId, data);
      return NextResponse.json({ case: onboardingCase, requestId }, { status: 201 });
    } catch (error) {
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed to create onboarding case", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
