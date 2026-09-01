import { dispatchAssistBells } from "@/modules/notifications/assistAlertNotifications";
import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { ComplianceNotificationDispatcher } from "@/modules/compliance/notifications/dispatcher";

export const maxDuration = 120;

async function handleDispatch(requestId: string) {
  try {
    await dispatchAssistBells();
    const result = await ComplianceNotificationDispatcher.dispatchPending();
    return NextResponse.json({ status: "SUCCESS", requestId, ...result });
  } catch (err: any) {
    console.error("[compliance-notification-dispatch] Execution failed:", err);
    return NextResponse.json(
      { status: "FAILED", requestId, error: err.message || "Compliance notification dispatch failed" },
      { status: 502 }
    );
  }
}

export const GET = withCronRoute(async ({ requestId }) => handleDispatch(requestId));

export const POST = withCronRoute(async ({ requestId }) => handleDispatch(requestId));
