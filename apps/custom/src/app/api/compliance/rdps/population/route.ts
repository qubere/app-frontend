/**
 * GET /api/compliance/rdps/population
 *
 * Tenant-scoped view of the Parties in RDPS monitoring scope (every active
 * Party -- there is no separate opt-in/opt-out flag in V1), annotated with
 * each Party's most recent RdpsPartyOutcome.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { listPopulation } from "@/modules/compliance/rdps/rdpsQueryService";

export const GET = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const url = new URL(req.url);
    const page = url.searchParams.get("page");
    const pageSize = url.searchParams.get("pageSize");

    const result = await listPopulation(ctx.accountId, {
      page: page ? Number.parseInt(page, 10) : undefined,
      pageSize: pageSize ? Number.parseInt(pageSize, 10) : undefined,
    });

    return NextResponse.json({ ...result, requestId });
  },
  { permission: "compliance.rdps.read" }
);
