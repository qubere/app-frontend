import { NextResponse } from "next/server";
import { withPublicRoute } from "@/lib/api/auth-guards";

/**
 * Process-only liveness endpoint for container platforms.
 *
 * Do not add database or third-party checks here: a dependency outage should
 * make readiness degraded, not cause Cloud Run to restart a healthy process.
 */
export const GET = withPublicRoute(async () =>
  NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  })
);
