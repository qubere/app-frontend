import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    console.log("[MigrationAPI] Executing ALTER TABLE DDL on Cloud SQL...");

    await db.$executeRawUnsafe(`ALTER TABLE "InboundAddress" ADD COLUMN IF NOT EXISTS "autoAttachPolicy" TEXT DEFAULT 'CONFIDENT';`);
    await db.$executeRawUnsafe(`ALTER TABLE "InboundEmail" ADD COLUMN IF NOT EXISTS "bodyText" TEXT;`);
    await db.$executeRawUnsafe(`ALTER TABLE "DocumentShipmentCandidate" ADD COLUMN IF NOT EXISTS "reasoning" TEXT;`);

    return NextResponse.json({
      success: true,
      message: "DDL Migration 20260903170000 applied successfully to Cloud SQL qubere_db!"
    });
  } catch (error: any) {
    console.error("[MigrationAPI] Error applying DDL:", error);
    return NextResponse.json({
      success: false,
      error: error?.message || String(error)
    }, { status: 500 });
  }
}
