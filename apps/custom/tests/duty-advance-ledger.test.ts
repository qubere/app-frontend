import { describe, it, expect } from "vitest";
import { db as prisma, withAccountIdContext } from "@qubere/db";
import { getOrCreateDisbursementAccount, assertAccountDrift } from "../src/modules/billing/funds/accountService";
import { postLedgerEntry, reverseLedgerEntry } from "../src/modules/billing/funds/ledgerService";

describe("Duty Advance - Append-Only Ledger & Balance Math", () => {
  async function setupTestContext() {
    const accountId = `acc_ledger_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const clientId = `cli_ledger_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await prisma.account.create({
      data: {
        id: accountId,
        name: "Test Account",
        slug: `slug-${accountId}`,
        dataMode: "PRODUCTION",
      },
    });

    await prisma.client.create({
      data: {
        id: clientId,
        accountId,
        name: "Test Client",
      },
    });

    return { accountId, clientId };
  }

  it("posts deposits and disbursements calculating sequential running balances", async () => {
    const { accountId, clientId } = await setupTestContext();

    await withAccountIdContext(accountId, async () => {
      const acc = await getOrCreateDisbursementAccount({
        accountId,
        clientId,
        minimumBalance: 1000,
        targetBalance: 5000,
      });

      // 1. Initial Deposit $5,000
      const dep1 = await postLedgerEntry({
        accountId,
        disbursementAccountId: acc.id,
        type: "ADVANCE_DEPOSIT",
        amount: 5000,
        description: "Initial client deposit",
        idempotencyKey: `dep1-${Date.now()}`,
      });

      expect(Number(dep1.amount)).toBe(5000);
      expect(Number(dep1.runningBalance)).toBe(5000);

      // 2. Disbursement -$1,200
      const dis1 = await postLedgerEntry({
        accountId,
        disbursementAccountId: acc.id,
        type: "DUTY_DISBURSEMENT",
        amount: -1200,
        description: "Duty payment for Entry 123",
        idempotencyKey: `dis1-${Date.now()}`,
      });

      expect(Number(dis1.amount)).toBe(-1200);
      expect(Number(dis1.runningBalance)).toBe(3800);

      // 3. Fee Disbursement -$150
      const fee1 = await postLedgerEntry({
        accountId,
        disbursementAccountId: acc.id,
        type: "FEE_DISBURSEMENT",
        amount: -150,
        description: "MPF/HMF fees",
        idempotencyKey: `fee1-${Date.now()}`,
      });

      expect(Number(fee1.runningBalance)).toBe(3650);

      // Assert drift check
      const drift = await assertAccountDrift(accountId, acc.id);
      expect(drift.isDrifted).toBe(false);
      expect(drift.currentBalance).toBe(3650);
    });
  });

  it("handles idempotency cleanly without duplicate postings", async () => {
    const { accountId, clientId } = await setupTestContext();

    await withAccountIdContext(accountId, async () => {
      const acc = await getOrCreateDisbursementAccount({
        accountId,
        clientId,
      });

      const key = `idem-key-unique-123-${Date.now()}`;
      const first = await postLedgerEntry({
        accountId,
        disbursementAccountId: acc.id,
        type: "ADVANCE_DEPOSIT",
        amount: 2000,
        description: "Idempotent deposit",
        idempotencyKey: key,
      });

      const second = await postLedgerEntry({
        accountId,
        disbursementAccountId: acc.id,
        type: "ADVANCE_DEPOSIT",
        amount: 2000,
        description: "Idempotent deposit duplicate call",
        idempotencyKey: key,
      });

      expect(first.id).toBe(second.id);
      expect(Number(second.runningBalance)).toBe(2000);
    });
  });

  it("reverses an entry and restores balance exactly", async () => {
    const { accountId, clientId } = await setupTestContext();

    await withAccountIdContext(accountId, async () => {
      const acc = await getOrCreateDisbursementAccount({
        accountId,
        clientId,
      });

      const dep = await postLedgerEntry({
        accountId,
        disbursementAccountId: acc.id,
        type: "ADVANCE_DEPOSIT",
        amount: 1000,
        description: "Original deposit",
        idempotencyKey: `rev-dep-${Date.now()}`,
      });

      expect(Number(dep.runningBalance)).toBe(1000);

      const rev = await reverseLedgerEntry({
        accountId,
        entryId: dep.id,
        reason: "Deposit check bounced",
        idempotencyKey: `rev-action-${Date.now()}`,
      });

      expect(Number(rev.amount)).toBe(-1000);
      expect(Number(rev.runningBalance)).toBe(0);

      // Double reversal attempt must fail
      await expect(
        reverseLedgerEntry({
          accountId,
          entryId: dep.id,
          reason: "Duplicate reversal attempt",
          idempotencyKey: `rev-action-dup-${Date.now()}`,
        })
      ).rejects.toThrow();
    });
  });

  it("validates entry sign requirements and non-zero amounts", async () => {
    const { accountId, clientId } = await setupTestContext();

    await withAccountIdContext(accountId, async () => {
      const acc = await getOrCreateDisbursementAccount({
        accountId,
        clientId,
      });

      // Zero amount
      await expect(
        postLedgerEntry({
          accountId,
          disbursementAccountId: acc.id,
          type: "ADVANCE_DEPOSIT",
          amount: 0,
          description: "Zero deposit",
          idempotencyKey: `zero-${Date.now()}`,
        })
      ).rejects.toThrow("Ledger entry amount cannot be zero");

      // Negative deposit
      await expect(
        postLedgerEntry({
          accountId,
          disbursementAccountId: acc.id,
          type: "ADVANCE_DEPOSIT",
          amount: -500,
          description: "Negative deposit",
          idempotencyKey: `neg-dep-${Date.now()}`,
        })
      ).rejects.toThrow("must be positive");

      // Positive disbursement
      await expect(
        postLedgerEntry({
          accountId,
          disbursementAccountId: acc.id,
          type: "DUTY_DISBURSEMENT",
          amount: 500,
          description: "Positive disbursement",
          idempotencyKey: `pos-disb-${Date.now()}`,
        })
      ).rejects.toThrow("must be negative");
    });
  });
});
