/**
 * GET /api/compliance/rdps/runs/[id]/outcomes
 *
 * Per-Party outcomes for a run, tenant-scoped via RdpsPartyOutcome.accountId
 * -- a caller only ever sees the slice of a (possibly cross-tenant) run that
 * belongs to their own account.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { listOutcomesForRun } from "@/modules/compliance/rdps/rdpsQueryService";

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, params, requestId }) => {
    const url = new URL(req.url);
    const isWorsening = url.searchParams.get("isWorsening");
    const page = url.searchParams.get("page");
    const pageSize = url.searchParams.get("pageSize");

    const result = await listOutcomesForRun(ctx.accountId, params.id, {
      isWorsening: isWorsening === null ? undefined : isWorsening === "true",
      page: page ? Number.parseInt(page, 10) : undefined,
      pageSize: pageSize ? Number.parseInt(pageSize, 10) : undefined,
    });

    return NextResponse.json({ ...result, requestId });
  },
  { permission: "compliance.rdps.read" }
);
