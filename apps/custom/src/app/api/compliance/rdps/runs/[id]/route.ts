/**
 * GET /api/compliance/rdps/runs/[id]
 *
 * RdpsRun has no accountId (a single run can span Parties across many
 * accounts), so this returns aggregate run metadata only -- counts and
 * status, never Party-identifying detail -- to any compliance.rdps.read
 * holder. Per-Party detail lives behind the tenant-scoped outcomes route.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { getRun } from "@/modules/compliance/rdps/rdpsQueryService";

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ params, requestId }) => {
    const run = await getRun(params.id);
    if (!run) {
      return buildErrorResponse(404, "NOT_FOUND", "RDPS run not found", undefined, requestId);
    }
    return NextResponse.json({ run, requestId });
  },
  { permission: "compliance.rdps.read" }
);
