/**
 * GET /api/compliance/rdps/reference-data-health
 *
 * RPS reference-data health rollup -- Provider / List / Last Successful
 * Import / Published Version / Record Count / Added / Updated / Removed /
 * Import Status per dataset. Platform-level, like reference-changes: this
 * describes the shared screening lists, not tenant data.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { getReferenceDataHealth } from "@/modules/compliance/rdps/rdpsQueryService";

export const GET = withAuthenticatedRoute(
  async ({ requestId }) => {
    const datasets = await getReferenceDataHealth();
    return NextResponse.json({ datasets, requestId });
  },
  { permission: "compliance.rdps.read" }
);
