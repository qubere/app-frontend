/**
 * GET /api/compliance/community-screening/[id]/results
 *
 * Returns the paginated per-party results for a Community Screening run.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { CommunityScreeningService } from "@/modules/compliance/communityScreening/service";

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, params, requestId }) => {
    const url = new URL(req.url);
    const page = url.searchParams.get("page");
    const pageSize = url.searchParams.get("pageSize");
    const status = url.searchParams.get("status");

    const result = await CommunityScreeningService.getRunResults(ctx.accountId, params.id, {
      page: page ? Number.parseInt(page, 10) : undefined,
      pageSize: pageSize ? Number.parseInt(pageSize, 10) : undefined,
      status: status ?? undefined,
    });

    if (!result) {
      return NextResponse.json({ error: "Community screening run not found", requestId }, { status: 404 });
    }

    return NextResponse.json({ ...result, requestId });
  },
  { permission: "compliance.communityScreening.read" }
);
