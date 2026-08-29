import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { runSlaSweep } from "@/lib/inngest/slaSweepJob";

/**
 * SLA sweep — runs every 15 minutes.
 *
 * Marks SLA breaches on open decisions / exceptions, evaluates active
 * EscalationRule rows, bumps escalation levels and fires notifications.
 *
 * Auth: CRON_SECRET bearer token, required (withCronRoute). There is no
 * unauthenticated fallback and no mutating GET without the secret — an
 * unauthenticated caller must never be able to trigger a cross-account
 * escalation sweep.
 */

export const maxDuration = 60;

export const GET = withCronRoute(async () => {
  const result = await runSlaSweep();
  return NextResponse.json({ ok: true, ...result });
});
