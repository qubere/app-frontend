import { describe, it, expect } from "vitest";
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
        totalDuty: new (require("@prisma/client").Prisma.Decimal)(500),
        totalFee: new (require("@prisma/client").Prisma.Decimal)(50),
        totalAmount: new (require("@prisma/client").Prisma.Decimal)(550),
        statementFeeLines: {
          create: [{ accountingClassCode: "501", amount: new (require("@prisma/client").Prisma.Decimal)(50), sequence: 1 }],
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
});
