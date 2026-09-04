/**
 * POST /api/compliance/community-screening/[id]/rescreen
 *
 * Re-runs the FAILED/ERROR/INCOMPLETE rows of an existing run in place.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { CommunityScreeningService } from "@/modules/compliance/communityScreening/service";

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    const run = await CommunityScreeningService.rescreenRun(ctx.accountId, params.id, {
      userId: ctx.userId,
      requestId,
    });

    if (!run) {
      return NextResponse.json({ error: "Community screening run not found", requestId }, { status: 404 });
    }

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: AuditAction.COMMUNITY_SCREENING_RESCREENED,
      entity: "CommunityScreeningRun",
      entityId: params.id,
      source: "UI",
      metadata: {},
      requestId,
    });

    return NextResponse.json({ run, requestId });
  },
  { permission: "compliance.community_screening.screen", write: true }
);
