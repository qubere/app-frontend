// Disposition a screening result on a single OnboardingEntity.
// FLAGGED → operator note → proceed (any onboarding.manage user).
// BLOCKED → OVERRIDE requires compliance.override permission.

import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/auth";

const dispositionSchema = z.object({
  disposition: z.enum(["FALSE_POSITIVE", "CONFIRMED_MATCH", "OVERRIDE"]),
  note: z.string().min(1, "A disposition note is required"),
});

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId, params }) => {
    const entityId = (params as Record<string, string>).entityId;

    const bodyVal = await parseAndValidateBody(req, dispositionSchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;
    const { disposition, note } = bodyVal.data;

    const entity = await db.onboardingEntity.findFirst({
      where: { id: entityId },
      include: { case: { select: { accountId: true, id: true } } },
    });

    if (!entity || entity.case.accountId !== ctx.accountId) {
      return buildErrorResponse(404, "NOT_FOUND", "Entity not found", undefined, requestId);
    }

    if (entity.screeningStatus !== "flagged" && entity.screeningStatus !== "blocked") {
      return buildErrorResponse(
        400,
        "BUSINESS_RULE_FAILURE",
        `Entity screening status is '${entity.screeningStatus}' — only flagged or blocked entities can be dispositioned.`,
        undefined,
        requestId
      );
    }

    // OVERRIDE on BLOCKED requires compliance.override
    if (disposition === "OVERRIDE" && entity.screeningStatus === "blocked") {
      const canOverride = await hasPermission("compliance.override");
      if (!canOverride) {
        return buildErrorResponse(
          403,
          "FORBIDDEN",
          "Overriding a BLOCKED screening result requires the compliance.override role.",
          undefined,
          requestId
        );
      }
    }

    try {
      const newStatus =
        disposition === "FALSE_POSITIVE" ? "passed" :
        disposition === "OVERRIDE" ? "overridden" :
        "blocked"; // CONFIRMED_MATCH keeps blocked

      await db.onboardingEntity.update({
        where: { id: entityId },
        data: { screeningStatus: newStatus },
      });

      // Store disposition detail in the case event log
      const stepStatus = entity.case as Record<string, unknown>;
      void stepStatus;

      await db.onboardingEvent.create({
        data: {
          accountId: ctx.accountId,
          caseId: entity.case.id,
          type: "SCREENING_DISPOSITIONED",
          actorUserId: ctx.userId,
          actorType: "USER",
          detail: { entityId, disposition, note, newStatus, prevStatus: entity.screeningStatus },
          createdAt: new Date(),
        },
      });

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: "SCREENING_DISPOSITIONED",
        entity: "OnboardingEntity",
        entityId,
        source: "UI",
        metadata: { disposition, note, prevStatus: entity.screeningStatus, newStatus },
      });

      return NextResponse.json({ dispositioned: true, disposition, newStatus, requestId });
    } catch (error) {
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed to record disposition", undefined, requestId);
    }
  },
  { permission: "onboarding.manage", write: true }
);
