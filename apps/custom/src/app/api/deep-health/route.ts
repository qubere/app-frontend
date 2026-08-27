import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const commit =
    process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "unknown";

  let dbStatus = "unknown";
  let isHealthy = true;

  try {
    // Quick readiness check against database
    await db.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch (error: any) {
    dbStatus = `error: ${error?.message || "connection failed"}`;
    isHealthy = false;
  }

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      service: "qubere-customs-app",
      gitCommit: commit,
      database: dbStatus,
      timestamp: new Date().toISOString(),
    },
    { status: isHealthy ? 200 : 503 }
  );
}
