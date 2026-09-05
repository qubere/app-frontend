import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { getOrCreateDisbursementAccount } from "../src/modules/billing/funds/accountService";
import { postLedgerEntry } from "../src/modules/billing/funds/ledgerService";
import { createOrUpdateEstimatedDisbursement, authorizeDisbursement, markDisbursementPaid } from "../src/modules/billing/funds/disbursementService";
import { runStatementReconciliation, resolveReconciliationLine } from "../src/modules/billing/funds/reconciliationService";
import { db as prisma } from "@qubere/db";

describe("CBP Statement Reconciliation Flow", () => {
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

  it("reconciles matching statement lines and creates variance lines for mismatches", async () => {
    const accountId = `acc_recon_${Date.now()}`;
    const clientId = `cli_recon_${Date.now()}`;
    await setupAccountAndClient(accountId, clientId);

    const acc = await getOrCreateDisbursementAccount({ accountId, clientId });

    // Deposit $1000 to cover disbursement
    await postLedgerEntry({
      accountId,
      disbursementAccountId: acc.id,
      type: "ADVANCE_DEPOSIT",
      amount: 1000,
      description: "Deposit",
      idempotencyKey: `dep-recon-${Date.now()}`,
    });

    // Create paid disbursement
    const disb = await createOrUpdateEstimatedDisbursement({
      accountId,
      clientId,
      entryNumber: "333-1111111-1",
      dutyAmount: 500,
      taxAmount: 0,
      feeAmount: 50,
      feeLines: [{ accountingClassCode: "501", estimatedAmount: 50 }],
    });
    await authorizeDisbursement({ accountId, disbursementId: disb.id });
    await markDisbursementPaid({
      accountId,
      disbursementId: disb.id,
      paidAt: new Date(),
      actualAmount: 550,
      feeBreakdown: [{ accountingClassCode: "501", actualAmount: 50 }],
      idempotencyKey: `recon-paid-${disb.id}`,
    });

    // Create StatementRecord in DB
    const statement = await prisma.statementRecord.create({
      data: {
        accountId,
        statementType: "daily",
        statementNumber: `STMT-${Date.now()}`,
        totalDuty: new Prisma.Decimal(500),
        totalFee: new Prisma.Decimal(50),
        totalAmount: new Prisma.Decimal(550),
        statementFeeLines: {
          create: [{ accountingClassCode: "501", amount: new Prisma.Decimal(50), sequence: 1 }],
        },
      },
    });

    // Run reconciliation
    const recon = await runStatementReconciliation({
      accountId,
      statementRecordId: statement.id,
    });

    expect(recon.status).toBe("CLOSED");
    expect(recon.matchedCount).toBe(1);
    expect(recon.varianceCount).toBe(0);
  });

  it("matches every fee line on a multi-class disbursement (not just the first)", async () => {
    const accountId = `acc_recon_multi_${Date.now()}`;
    const clientId = `cli_recon_multi_${Date.now()}`;
    await setupAccountAndClient(accountId, clientId);

    const acc = await getOrCreateDisbursementAccount({ accountId, clientId });
    await postLedgerEntry({
      accountId,
      disbursementAccountId: acc.id,
      type: "ADVANCE_DEPOSIT",
      amount: 5000,
      description: "Deposit",
      idempotencyKey: `dep-recon-multi-${Date.now()}`,
    });

    const disb = await createOrUpdateEstimatedDisbursement({
      accountId,
      clientId,
      entryNumber: "444-2222222-2",
      dutyAmount: 1000,
      taxAmount: 0,
      feeAmount: 60,
      feeLines: [
        { accountingClassCode: "501", estimatedAmount: 25 },
        { accountingClassCode: "499", estimatedAmount: 35 },
      ],
    });
    await authorizeDisbursement({ accountId, disbursementId: disb.id });
    await markDisbursementPaid({
      accountId,
      disbursementId: disb.id,
      paidAt: new Date(),
      actualAmount: 1060,
      feeBreakdown: [
        { accountingClassCode: "501", actualAmount: 25 },
        { accountingClassCode: "499", actualAmount: 35 },
      ],
      idempotencyKey: `recon-multi-paid-${disb.id}`,
    });

    const statement = await prisma.statementRecord.create({
      data: {
        accountId,
        statementType: "daily",
        statementNumber: `STMT-MULTI-${Date.now()}`,
        totalFee: new Prisma.Decimal(60),
        totalAmount: new Prisma.Decimal(60),
        statementFeeLines: {
          create: [
            { accountingClassCode: "501", amount: new Prisma.Decimal(25), sequence: 1 },
            { accountingClassCode: "499", amount: new Prisma.Decimal(35), sequence: 2 },
          ],
        },
      },
    });

    const recon = await runStatementReconciliation({ accountId, statementRecordId: statement.id });

    // Before the fix the second class code fell through to MISSING_IN_QUBERE.
    expect(recon.matchedCount).toBe(2);
    expect(recon.varianceCount).toBe(0);
    expect(recon.unmatchedCount).toBe(0);
    expect(recon.status).toBe("CLOSED");
  });
});
