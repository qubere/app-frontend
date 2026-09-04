/**
 * POST /api/compliance/rdps/reference-changes/[id]/preview-impact
 *
 * Strictly read-only preview of which of the caller's Parties a given
 * reference-data change would plausibly impact -- reuses the exact same
 * reverse impact-matching logic the delta-impact dispatcher uses, but never
 * creates an RdpsRun/RdpsPartyOutcome, never triggers rescreenParty, and
 * never raises an alert/exception/notification. POST (not GET) only because
 * it's the action-style verb the RDPS panel uses for on-demand analysis --
 * it does not mutate anything, so it reuses the read permission rather than
 * requiring compliance.rdps.manage.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { previewReferenceChangeImpact, ReferenceChangeNotFoundError } from "@/modules/compliance/rdps/rdpsQueryService";

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    try {
      const candidates = await previewReferenceChangeImpact(ctx.accountId, params.id);
      return NextResponse.json({ candidates, requestId });
    } catch (err) {
      if (err instanceof ReferenceChangeNotFoundError) {
        return buildErrorResponse(404, "NOT_FOUND", "Reference data change not found", undefined, requestId);
      }
      throw err;
    }
  },
  { permission: "compliance.rdps.read" }
);
