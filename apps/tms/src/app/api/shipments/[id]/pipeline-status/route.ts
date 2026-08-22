import { NextRequest, NextResponse } from "next/server";
import { getPipelineStatus } from "@/lib/tmsPipelineEngine";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const status = getPipelineStatus(id);
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch pipeline status" }, { status: 500 });
  }
}
