/**
 * GET /api/compliance/rdps/alerts
 *
 * Lists worsening RDPS outcomes for the caller's tenant.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { listAlerts } from "@/modules/compliance/rdps/rdpsQueryService";

export const GET = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const url = new URL(req.url);
    const dispositioned = url.searchParams.get("dispositioned");
    const page = url.searchParams.get("page");
    const pageSize = url.searchParams.get("pageSize");

    const result = await listAlerts(ctx.accountId, {
      dispositioned: dispositioned === null ? undefined : dispositioned === "true",
      page: page ? Number.parseInt(page, 10) : undefined,
      pageSize: pageSize ? Number.parseInt(pageSize, 10) : undefined,
    });

    return NextResponse.json({ ...result, requestId });
  },
  { permission: "compliance.rdps.read" }
);
