import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { REPORT_CATALOG } from "@/modules/reports/catalog";

export const GET = withAuthenticatedRoute(async () => {
  return NextResponse.json({ reports: REPORT_CATALOG });
}, { permission: "compliance.reports.view" });
