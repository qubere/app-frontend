import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { dispatchDueReportSchedules } from "@/modules/reports/scheduler";

export const maxDuration = 120;

async function handleDispatch(requestId: string) {
  try {
    const result = await dispatchDueReportSchedules();
    return NextResponse.json({ status: "SUCCESS", requestId, ...result });
  } catch (err) {
    console.error("[report-schedules] Dispatch failed:", err);
    return NextResponse.json(
      { status: "FAILED", requestId, error: err instanceof Error ? err.message : "Report schedule dispatch failed" },
      { status: 502 }
    );
  }
}

export const GET = withCronRoute(async ({ requestId }) => handleDispatch(requestId));
export const POST = withCronRoute(async ({ requestId }) => handleDispatch(requestId));
