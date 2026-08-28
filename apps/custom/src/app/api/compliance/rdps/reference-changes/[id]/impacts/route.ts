/**
 * GET /api/compliance/rdps/reference-changes/[id]/impacts
 *
 * Impacted Parties drill-down for one ReferenceDataChangeSet, tenant-scoped
 * via RdpsPartyOutcome.accountId -- see runs/[id]/outcomes/route.ts for the
 * same rationale.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { listImpactsForChange } from "@/modules/compliance/rdps/rdpsQueryService";

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, params, requestId }) => {
    const url = new URL(req.url);
    const page = url.searchParams.get("page");
    const pageSize = url.searchParams.get("pageSize");

    const result = await listImpactsForChange(ctx.accountId, params.id, {
      page: page ? Number.parseInt(page, 10) : undefined,
      pageSize: pageSize ? Number.parseInt(pageSize, 10) : undefined,
    });

    return NextResponse.json({ ...result, requestId });
  },
  { permission: "compliance.rdps.read" }
);
