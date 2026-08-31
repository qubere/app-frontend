// Runs denied-party screening for all entities on an onboarding case.
// Updates OnboardingEntity.screeningStatus for each entity.

import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export const POST = withAuthenticatedRoute(
  async ({ ctx, requestId, params }) => {
    const caseId = (params as Record<string, string>).caseId;

    const onboardingCase = await db.onboardingCase.findUnique({
      where: { id: caseId },
      include: { entities: { include: { legalEntity: true } } },
    });

    if (!onboardingCase || onboardingCase.accountId !== ctx.accountId) {
      return buildErrorResponse(404, "NOT_FOUND", "Case not found", undefined, requestId);
    }

    if (onboardingCase.entities.length === 0) {
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", "No entities to screen — complete Step 1 first", undefined, requestId);
    }

    const results: Array<{
      entityId: string;
      name: string;
      screeningStatus: string;
      hitCount: number;
    }> = [];

    for (const entity of onboardingCase.entities) {
      const legalName = entity.legalEntity?.legalName ?? entity.importerNumber ?? entity.id;

      // In production this would call the real denied-party screening engine
      // (OFAC SDN, BIS Entity List, UFLPA). For the demo, names containing
      // SANCTIONED/BLOCKED simulate hits; FLAGGED/REVIEW simulate soft matches.
      const nameUpper = legalName.toUpperCase();
      const isBlocked = nameUpper.includes("SANCTIONED") || nameUpper.includes("BLOCKED");
      const isFlagged = nameUpper.includes("FLAGGED") || nameUpper.includes("REVIEW");
      const hitCount = isBlocked ? 3 : isFlagged ? 1 : 0;
      const screeningStatus = isBlocked ? "blocked" : isFlagged ? "flagged" : "passed";

      await db.onboardingEntity.update({
        where: { id: entity.id },
        data: { screeningStatus },
      });

      results.push({ entityId: entity.id, name: legalName, screeningStatus, hitCount });
    }

    await db.onboardingEvent.create({
      data: {
        accountId: ctx.accountId,
        caseId,
        type: "SCREENING_RUN",
        actorUserId: ctx.userId,
        actorType: "USER",
        detail: { results },
        createdAt: new Date(),
      },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "ONBOARDING_SCREENING_RUN",
      entity: "OnboardingCase",
      entityId: caseId,
      source: "UI",
      metadata: { entityCount: onboardingCase.entities.length, results },
    });

    const anyBlocked = results.some((r) => r.screeningStatus === "blocked");
    const anyFlagged = results.some((r) => r.screeningStatus === "flagged");

    return NextResponse.json({
      results,
      summary: anyBlocked ? "blocked" : anyFlagged ? "flagged" : "passed",
      message: anyBlocked
        ? "BLOCKED — compliance-role disposition required before activation."
        : anyFlagged
        ? "FLAGGED — review required. Operator note needed before proceeding."
        : "All entities cleared screening.",
      requestId,
    });
  },
  { permission: "onboarding.manage", write: true }
);
