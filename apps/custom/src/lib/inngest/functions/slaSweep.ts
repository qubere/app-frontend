import { inngest } from "../client";
import { db, runWithAccountId } from "@/lib/db";
import { runSlaSweep } from "@/lib/inngest/slaSweepJob";

/**
 * SLA sweep — marks SLA breaches and evaluates escalation rules across every
 * account. Runs per-account inside runWithAccountId so DEMO/SANDBOX accounts
 * stay in their own data partition.
 *
 * Also reachable via the CRON_SECRET-guarded HTTP route
 * `/api/cron/sla-sweep` (GCP Cloud Scheduler) and the account-scoped operator
 * trigger `/api/admin/work/run-sla-sweep`.
 */
export async function executeSlaSweep() {
  const accounts = await db.account.findMany({ select: { id: true } });
  let breachedDecisions = 0;
  let breachedExceptions = 0;
  let escalationsCreated = 0;
  let atRiskWarnings = 0;

  for (const account of accounts) {
    await runWithAccountId(account.id, async () => {
      const r = await runSlaSweep(account.id);
      breachedDecisions += r.breachedDecisions;
      breachedExceptions += r.breachedExceptions;
      escalationsCreated += r.escalationsCreated;
      atRiskWarnings += r.atRiskWarnings;
    });
  }

  return { accounts: accounts.length, breachedDecisions, breachedExceptions, escalationsCreated, atRiskWarnings };
}

export const slaSweepJob = (inngest.createFunction as any)(
  { id: "work-sla-sweep", triggers: [{ cron: "*/15 * * * *" }, { event: "work/sla.sweep.requested" }] },
  async ({ step }: { step: any }) => {
    return await step.run("run-sla-sweep", async () => executeSlaSweep());
  }
);
