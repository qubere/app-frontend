/**
 * GET /api/compliance/community-screening/[id]
 *
 * Returns a single Community Screening run, tenant-scoped by ctx.accountId.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { CommunityScreeningService } from "@/modules/compliance/communityScreening/service";

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    const run = await CommunityScreeningService.getRun(ctx.accountId, params.id);
    if (!run) {
      return NextResponse.json({ error: "Community screening run not found", requestId }, { status: 404 });
    }

    return NextResponse.json({ run, requestId });
  },
  { permission: "compliance.communityScreening.read" }
);
