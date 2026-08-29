import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { runSlaSweep } from "@/lib/inngest/slaSweepJob";

/**
 * Runs the SLA sweep for the caller's account only — an operator-facing
 * trigger for the same job the `qubere-sla-sweep` cron runs account-wide.
 * Handy for demos and for a lead who wants escalations evaluated now.
 */
export const POST = withAuthenticatedRoute(async ({ ctx }) => {
  const result = await runSlaSweep(ctx.accountId);
  return NextResponse.json({ ok: true, ...result });
}, { permission: "settings.manage", write: true });
