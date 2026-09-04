/**
 * GET /api/compliance/rdps/reference-changes/[id]
 *
 * Single ReferenceDataChangeSet row -- platform-level, see runs/[id]/route.ts
 * for the same no-accountId rationale.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { getReferenceChange } from "@/modules/compliance/rdps/rdpsQueryService";

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ params, requestId }) => {
    const change = await getReferenceChange(params.id);
    if (!change) {
      return buildErrorResponse(404, "NOT_FOUND", "Reference data change not found", undefined, requestId);
    }
    return NextResponse.json({ change, requestId });
  },
  { permission: "compliance.rdps.read" }
);
