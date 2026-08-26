"use server";

import { getAccountContext, hasPermission } from "@/lib/auth";
import { runRateSimulation, SimulationSummary } from "@/lib/billing/rateSimulation";
import { isDataMode, withAccountIdContext, withDataModeContext } from "@/lib/db";

export async function runRateSimulationAction(
  proposedRateCardVersionId: string,
  months: number
): Promise<SimulationSummary> {
  const ctx = await getAccountContext();
  if (!ctx) throw new Error("Unauthorized");
  const canManage = await hasPermission("billing.ratecard.view");
  if (!canManage) throw new Error("Forbidden: billing.ratecard.view permission required");

  if (!Number.isInteger(months) || months < 1 || months > 24) {
    throw new Error("Historical window must be between 1 and 24 months");
  }

  // runRateSimulation (in @qubere/billing/rateSimulation) queries UsageEvent
  // internally, which is dataMode-scoped via its Account relation -- without
  // this wrapper it silently defaults to PRODUCTION isolation.
  return withDataModeContext(isDataMode(ctx.dataMode) ? ctx.dataMode : null, async () => withAccountIdContext(ctx.accountId, async () => {
    return runRateSimulation({
      accountId: ctx.accountId,
      proposedRateCardVersionId,
      months,
    });
  }));
}
