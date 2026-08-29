import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { computeNextOccurrences } from "@/modules/reports/scheduler";

const MAX_PREVIEW_OCCURRENCES = 3;

/** Read-only preview of the next N schedule occurrences -- shown in the schedule editor before save. */
export const POST = withAuthenticatedRoute(async ({ req }) => {
  const body = await req.json().catch(() => null);
  const frequency = typeof body?.frequency === "string" ? body.frequency : "";
  if (!["ONCE", "DAILY", "WEEKLY", "MONTHLY"].includes(frequency)) {
    return NextResponse.json({ error: "Invalid frequency.", code: "SCHEDULE_ERROR" }, { status: 400 });
  }
  const scheduleConfig = (body?.scheduleConfig ?? {}) as Record<string, unknown>;

  const occurrences = computeNextOccurrences({ frequency, scheduleConfig, lastRunAt: null }, MAX_PREVIEW_OCCURRENCES);

  return NextResponse.json({ occurrences: occurrences.map((d) => d.toISOString()) });
}, { permission: "compliance.reports.manage" });
