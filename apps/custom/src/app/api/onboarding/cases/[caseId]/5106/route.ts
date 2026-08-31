import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { FiveOhSixService } from "@/modules/onboarding/fiveOhSix.service";

const addressSchema = z.object({
  line1: z.string().min(1),
  city: z.string().min(1),
  stateProvince: z.string().default(""),
  postalCode: z.string().min(1),
  country: z.string().default("US"),
});

const officerSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  ssnLast4: z.string().length(4).regex(/^\d{4}$/),
  dobLast4: z.string().length(4).regex(/^\d{4}$/),
});

const createSchema = z.object({
  onboardingEntityId: z.string().nullable().optional(),
  payload: z.object({
    action: z.enum(["CREATE", "UPDATE"]),
    importerNumberType: z.enum(["EIN", "SSN", "CBP_ASSIGNED"]),
    importerNumber: z.string().nullable().optional(),
    legalName: z.string().min(1),
    tradeName: z.string().nullable().optional(),
    entityType: z.string().min(1),
    programIndicator: z.literal("IR"),
    naicsCode: z.string().nullable().optional(),
    relatedBusiness: z.boolean().default(false),
    officers: z.array(officerSchema).default([]),
    physicalAddress: addressSchema,
    mailingAddress: addressSchema.nullable().optional(),
    contact: z.object({
      name: z.string().default(""),
      phone: z.string().default(""),
      email: z.string().default(""),
    }),
    residentAgent: z
      .object({ name: z.string(), address: z.string(), phone: z.string() })
      .nullable()
      .optional(),
  }),
});

export const GET = withAuthenticatedRoute<{ caseId: string }>(
  async ({ params, ctx, requestId }) => {
    try {
      const records = await FiveOhSixService.listRecords(ctx.accountId, params.caseId);
      return NextResponse.json({ records, requestId });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND")
        return buildErrorResponse(404, "NOT_FOUND", "Case not found", undefined, requestId);
      return buildErrorResponse(500, "INTERNAL_ERROR", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage" }
);

export const POST = withAuthenticatedRoute<{ caseId: string }>(
  async ({ req, params, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, createSchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    const { onboardingEntityId, payload } = bodyVal.data;
    try {
      const record = await FiveOhSixService.createRecord(
        ctx.accountId,
        params.caseId,
        onboardingEntityId ?? null,
        payload as Parameters<typeof FiveOhSixService.createRecord>[3],
        ctx.userId
      );
      return NextResponse.json({ record, requestId }, { status: 201 });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "NOT_FOUND")
        return buildErrorResponse(404, "NOT_FOUND", "Case not found", undefined, requestId);
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
