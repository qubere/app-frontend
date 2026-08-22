import { NextRequest, NextResponse } from "next/server";
import { getAccountContext } from "@qubere/auth";
import { runTmsAutonomousPipeline } from "@/lib/tmsPipelineEngine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getAccountContext().catch(() => null);
    const accountId = context?.accountId || "default-account";
    const userId = context?.userId || "system";

    const job = await runTmsAutonomousPipeline(id, accountId, userId);
    return NextResponse.json({ ok: true, job });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to trigger pipeline" }, { status: 500 });
  }
}
