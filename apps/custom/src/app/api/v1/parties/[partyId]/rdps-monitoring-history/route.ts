/**
 * GET /api/v1/parties/[partyId]/rdps-monitoring-history
 *
 * Continuous Party Monitoring (RDPS) transition history for a Party Master
 * record, tenant-scoped. A partyId belonging to another account is reported
 * as not found, never forbidden -- same enumeration-oracle rule as the
 * restricted-party-screening-history route. Requires `compliance.rdps.read`.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams } from "@/lib/api/validation";
import { getPartyMonitoringHistory } from "@/modules/compliance/rdps/rdpsQueryService";

const paramsSchema = z.object({ partyId: z.string().min(1) });

export const GET = withAuthenticatedRoute<{ partyId: string }>(
  async ({ ctx, requestId, params }) => {
    const paramsVal = validatePathParams(params, paramsSchema, requestId);
    if ("response" in paramsVal) return paramsVal.response;

    const outcomes = await getPartyMonitoringHistory(ctx.accountId, paramsVal.data.partyId);
    if (outcomes === null) {
      return NextResponse.json({ error: "Party not found", requestId }, { status: 404 });
    }

    return NextResponse.json({ success: true, outcomes, requestId }, { status: 200 });
  },
  { permission: "compliance.rdps.read" }
);
