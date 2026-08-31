import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { PoaService } from "@/modules/onboarding/poa.service";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  entityTypes: z.array(z.string()).default([]),
  bodyStorageUrl: z.string().url(),
  termMonths: z.number().int().positive().optional(),
  requiresNotarization: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const GET = withAuthenticatedRoute(
  async ({ req, ctx }) => {
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType") ?? undefined;
    const templates = await PoaService.listTemplates(ctx.accountId, entityType);
    return NextResponse.json({ templates });
  },
  { permission: "onboarding.manage" }
);

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, createSchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    try {
      const template = await PoaService.createTemplate(ctx.accountId, ctx.userId, bodyVal.data);
      return NextResponse.json({ template, requestId }, { status: 201 });
    } catch (error: unknown) {
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
