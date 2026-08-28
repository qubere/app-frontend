import { NextResponse } from "next/server";
import { db } from "@qubere/db";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    checks.database = { ok: false, detail: message };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      service: "qubere-customer-portal",
      environment: process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || "demo",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
