import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { db } from "@/lib/db";

const stepSchema = z.object({
  status: z.enum(["done", "in_progress", "blocked", "waived"]),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const PUT = withAuthenticatedRoute(
  async ({ req, params, ctx, requestId }) => {
    const caseId = params.caseId as string;
    const stepNum = parseInt(params.step as string);

    if (isNaN(stepNum) || stepNum < 1 || stepNum > 7) {
      return buildErrorResponse(400, "VALIDATION_ERROR", "Invalid step number", undefined, requestId);
    }

    const existingCase = await db.onboardingCase.findUnique({
      where: { id: caseId },
      select: { accountId: true, stepStatus: true, currentStep: true, status: true },
    });
    if (!existingCase || existingCase.accountId !== ctx.accountId) {
      return buildErrorResponse(404, "NOT_FOUND", "Case not found", undefined, requestId);
    }
    if (existingCase.status === "withdrawn") {
      return buildErrorResponse(409, "CONFLICT", "Cannot update a withdrawn case", undefined, requestId);
    }

    const bodyVal = await parseAndValidateBody(req, stepSchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;

    try {
      const stepStatus = (existingCase.stepStatus as Record<string, unknown>) ?? {};
      stepStatus[`step_${stepNum}`] = bodyVal.data.status;
      if (bodyVal.data.data) {
        stepStatus[`step_${stepNum}_data`] = bodyVal.data.data;
      }

      const nextStep = stepNum < 7 ? stepNum + 1 : 7;
      const newCurrentStep = Math.max(existingCase.currentStep, nextStep);

      const updated = await db.onboardingCase.update({
        where: { id: caseId },
        data: {
          stepStatus: stepStatus as object,
          currentStep: newCurrentStep,
          updatedAt: new Date(),
        },
      });

      await db.onboardingEvent.create({
        data: {
          accountId: ctx.accountId,
          caseId,
          type: "STEP_COMPLETED",
          step: stepNum,
          actorUserId: ctx.userId,
          actorType: "USER",
          detail: { status: bodyVal.data.status },
          createdAt: new Date(),
        },
      });

      return NextResponse.json({ case: updated, requestId });
    } catch (error) {
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed to update step", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
