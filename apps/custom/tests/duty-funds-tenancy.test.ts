import { describe, it, expect } from "vitest";
import { getOrCreateDisbursementAccount, getDisbursementAccount, listDisbursementAccounts } from "../src/modules/billing/funds/accountService";
import { PERMISSION_CATALOGUE } from "@qubere/auth";
import { db as prisma } from "@qubere/db";

describe("Duty Funds Tenancy & Permission Verification", () => {
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

  it("enforces tenant accountId isolation on disbursement account queries", async () => {
    const accIdA = `acc_tenant_A_${Date.now()}`;
    const accIdB = `acc_tenant_B_${Date.now()}`;
    const cliIdA = `cli_tenant_A_${Date.now()}`;
    const cliIdB = `cli_tenant_B_${Date.now()}`;

    await setupAccountAndClient(accIdA, cliIdA);
    await setupAccountAndClient(accIdB, cliIdB);

    const accA = await getOrCreateDisbursementAccount({
      accountId: accIdA,
      clientId: cliIdA,
    });

    const accB = await getOrCreateDisbursementAccount({
      accountId: accIdB,
      clientId: cliIdB,
    });

    // Account A listing should not see Account B's trust account
    const listA = await listDisbursementAccounts(accIdA);
    expect(listA.some((a) => a.id === accA.id)).toBe(true);
    expect(listA.some((a) => a.id === accB.id)).toBe(false);

    // Cross-tenant get attempt must throw
    await expect(getDisbursementAccount(accIdA, accB.id)).rejects.toThrow();
  });

  it("verifies all 9 duty funds permissions exist in permission catalog", () => {
    const permNames = PERMISSION_CATALOGUE.map((p) => p.name);
    const expected = [
      "billing.funds.view",
      "billing.funds.manage",
      "billing.funds.authorize",
      "billing.funds.disburse",
      "billing.funds.deposit",
      "billing.funds.refund",
      "billing.funds.adjust",
      "billing.funds.reconcile",
      "billing.funds.override",
    ];

    for (const name of expected) {
      expect(permNames).toContain(name);
    }
  });
});
