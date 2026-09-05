import { describe, it, expect } from "vitest";
import { getOrCreateDisbursementAccount } from "../src/modules/billing/funds/accountService";
import { postLedgerEntry } from "../src/modules/billing/funds/ledgerService";
import {
  evaluateAndCreateReplenishmentRequests,
  satisfyReplenishmentRequest,
  checkOverdueReplenishmentRequests,
} from "../src/modules/billing/funds/replenishmentService";
import { db as prisma } from "@qubere/db";

describe("Duty Replenishment Workflow", () => {
  async function setupAccountAndClient(accId: string, cliId: string) {
    await prisma.account.upsert({
      where: { id: accId },
      create: { id: accId, name: `Account ${accId}`, slug: `slug-${accId}`, dataMode: "PRODUCTION" },
      update: {},
    });

    await prisma.client.upsert({
      where: { id: cliId },
      create: { id: cliId, accountId: accId, name: `Client ${cliId}` },
      update: {},
    });
  }

  it("creates a replenishment request when balance falls below minimum threshold", async () => {
    const accountId = `acc_replenish_${Date.now()}`;
    const clientId = `cli_replenish_${Date.now()}`;
    await setupAccountAndClient(accountId, clientId);

    const acc = await getOrCreateDisbursementAccount({
      accountId,
      clientId,
      minimumBalance: 2000,
      targetBalance: 10000,
      autoRequestReplenishment: true,
    });

    // Account balance is $0 < $2,000 minimum
    const created = await evaluateAndCreateReplenishmentRequests(accountId);
    expect(created.length).toBeGreaterThan(0);

    const req = created.find((r) => r.disbursementAccountId === acc.id);
    expect(req).toBeDefined();
    expect(Number(req!.amount)).toBe(10000); // target (10000) - current (0)
    expect(req!.state).toBe("REQUESTED");

    // Second run must deduplicate and not create a second open request
    const secondRun = await evaluateAndCreateReplenishmentRequests(accountId);
    const dupReq = secondRun.find((r) => r.disbursementAccountId === acc.id);
    expect(dupReq).toBeUndefined();
  });

  it("satisfies a replenishment request when sufficient deposit is linked", async () => {
    const accountId = `acc_satisfy_${Date.now()}`;
    const clientId = `cli_satisfy_${Date.now()}`;
    await setupAccountAndClient(accountId, clientId);

    const acc = await getOrCreateDisbursementAccount({
      accountId,
      clientId,
      minimumBalance: 1000,
      targetBalance: 5000,
      autoRequestReplenishment: true,
    });

    const created = await evaluateAndCreateReplenishmentRequests(accountId);
    const req = created.find((r) => r.disbursementAccountId === acc.id);
    expect(req).toBeDefined();

    // Satisfy request with $5,000 deposit
    const satisfied = await satisfyReplenishmentRequest({
      accountId,
      requestId: req!.id,
      depositAmount: 5000,
    });

    expect(satisfied.state).toBe("SATISFIED");

    const accAfter = await prisma.dutyDisbursementAccount.findUnique({ where: { id: acc.id } });
    expect(Number(accAfter?.currentBalance)).toBe(5000);
  });
});
