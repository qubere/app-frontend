import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { FiveOhSixService } from "@/modules/onboarding/fiveOhSix.service";

const patchSchema = z.object({
  action: z.enum(["CREATE", "UPDATE"]).optional(),
  importerNumberType: z.enum(["EIN", "SSN", "CBP_ASSIGNED"]).optional(),
  importerNumber: z.string().nullable().optional(),
  legalName: z.string().min(1).optional(),
  tradeName: z.string().nullable().optional(),
  entityType: z.string().optional(),
  naicsCode: z.string().nullable().optional(),
  relatedBusiness: z.boolean().optional(),
  officers: z
    .array(
      z.object({
        name: z.string(),
        title: z.string(),
        ssnLast4: z.string().length(4),
        dobLast4: z.string().length(4),
      })
    )
    .optional(),
  programIndicator: z.literal("IR").optional(),
  physicalAddress: z
    .object({
      line1: z.string(),
      city: z.string(),
      stateProvince: z.string(),
      postalCode: z.string(),
      country: z.string(),
    })
    .optional(),
  mailingAddress: z
    .object({
      line1: z.string(),
      city: z.string(),
      stateProvince: z.string(),
      postalCode: z.string(),
      country: z.string(),
    })
    .nullable()
    .optional(),
  contact: z
    .object({ name: z.string(), phone: z.string(), email: z.string() })
    .optional(),
  residentAgent: z
    .object({ name: z.string(), address: z.string(), phone: z.string() })
    .nullable()
    .optional(),
});

export const GET = withAuthenticatedRoute<{ caseId: string; recordId: string }>(
  async ({ params, ctx, requestId }) => {
    try {
      const record = await FiveOhSixService.getRecord(ctx.accountId, params.caseId, params.recordId);
      return NextResponse.json({ record, requestId });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND")
        return buildErrorResponse(404, "NOT_FOUND", "Record not found", undefined, requestId);
      return buildErrorResponse(500, "INTERNAL_ERROR", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage" }
);

export const PATCH = withAuthenticatedRoute<{ caseId: string; recordId: string }>(
  async ({ req, params, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, patchSchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    try {
      const updated = await FiveOhSixService.updateRecord(
        ctx.accountId,
        params.caseId,
        params.recordId,
        bodyVal.data,
        ctx.userId
      );
      return NextResponse.json({ record: updated, requestId });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND")
        return buildErrorResponse(404, "NOT_FOUND", "Record not found", undefined, requestId);
      if (err.code === "CONFLICT")
        return buildErrorResponse(409, "CONFLICT", errorMessage(error) || "Conflict", undefined, requestId);
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
