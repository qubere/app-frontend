import { NextRequest, NextResponse } from "next/server";
import { getAccountContext } from "@/lib/auth";
import { runSlaSweep } from "@/lib/inngest/slaSweepJob";

export async function POST(request: NextRequest) {
  const context = await getAccountContext();
  const accountId = context?.accountId || undefined;

  const result = await runSlaSweep(accountId);

  return NextResponse.json({ success: true, result });
}

export async function GET(request: NextRequest) {
  const context = await getAccountContext();
  const accountId = context?.accountId || undefined;

  const result = await runSlaSweep(accountId);

  return NextResponse.json({ success: true, result });
}
