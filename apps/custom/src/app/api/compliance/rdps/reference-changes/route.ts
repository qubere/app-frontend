/**
 * GET /api/compliance/rdps/reference-changes
 *
 * Lists ReferenceDataChangeSet rows -- platform-level, since reference
 * data (screening list entries) has no tenant/accountId, it applies
 * uniformly to every account.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { listReferenceChanges } from "@/modules/compliance/rdps/rdpsQueryService";

export const GET = withAuthenticatedRoute(
  async ({ req, requestId }) => {
    const url = new URL(req.url);
    const datasetId = url.searchParams.get("datasetId");
    const changeType = url.searchParams.get("changeType");
    const page = url.searchParams.get("page");
    const pageSize = url.searchParams.get("pageSize");

    const result = await listReferenceChanges({
      datasetId: datasetId ?? undefined,
      changeType: changeType ?? undefined,
      page: page ? Number.parseInt(page, 10) : undefined,
      pageSize: pageSize ? Number.parseInt(pageSize, 10) : undefined,
    });

    return NextResponse.json({ ...result, requestId });
  },
  { permission: "compliance.rdps.read" }
);
