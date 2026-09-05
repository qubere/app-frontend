import { describe, it, expect } from "vitest";
import { getOrCreateDisbursementAccount } from "../src/modules/billing/funds/accountService";
import { postLedgerEntry } from "../src/modules/billing/funds/ledgerService";
import {
  createOrUpdateEstimatedDisbursement,
  authorizeDisbursement,
  markDisbursementPaid,
  linkRecoveryCharge,
  failDisbursement,
  cancelDisbursement,
} from "../src/modules/billing/funds/disbursementService";
import { db as prisma } from "@qubere/db";

describe("Duty Disbursement Lifecycle", () => {
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

  it("completes full happy path ESTIMATED -> AUTHORIZED -> PAID_TO_CBP -> BILLED_TO_CLIENT", async () => {
    const accountId = `acc_disb_${Date.now()}`;
    const clientId = `cli_disb_${Date.now()}`;
    await setupAccountAndClient(accountId, clientId);

    const acc = await getOrCreateDisbursementAccount({
      accountId,
      clientId,
      minimumBalance: 1000,
      targetBalance: 5000,
    });

    // Fund account with $10,000
    await postLedgerEntry({
      accountId,
      disbursementAccountId: acc.id,
      type: "ADVANCE_DEPOSIT",
      amount: 10000,
      description: "Fund account",
      idempotencyKey: `fund-${Date.now()}`,
    });

    // 1. Create Estimated Disbursement
    const filingId = `filing_${Date.now()}`;
    const disb = await createOrUpdateEstimatedDisbursement({
      accountId,
      clientId,
      filingId,
      entryNumber: "123-4567890-1",
      dutyAmount: 2500,
      taxAmount: 100,
      feeAmount: 50,
      feeLines: [{ accountingClassCode: "501", estimatedAmount: 50 }],
    });

    expect(disb.status).toBe("ESTIMATED");
    expect(Number(disb.estimatedAmount)).toBe(2650);

    // 2. Authorize
    const authorized = await authorizeDisbursement({
      accountId,
      disbursementId: disb.id,
    });
    expect(authorized.status).toBe("AUTHORIZED");

    // 3. Mark Paid
    const paid = await markDisbursementPaid({
      accountId,
      disbursementId: disb.id,
      paidAt: new Date(),
      actualAmount: 2650,
      dutyAmount: 2500,
      taxAmount: 100,
      feeAmount: 50,
      feeBreakdown: [{ accountingClassCode: "501", actualAmount: 50 }],
      idempotencyKey: `paid-${disb.id}-${Date.now()}`,
    });
    expect(paid.status).toBe("PAID_TO_CBP");

    // Check account balance was updated
    const updatedAcc = await prisma.dutyDisbursementAccount.findUnique({ where: { id: acc.id } });
    expect(Number(updatedAcc?.currentBalance)).toBe(7350); // 10000 - 2650

    // 4. Link Recovery Charge
    // Create dummy shipment and shipment charge
    const shipment = await prisma.shipment.create({
      data: {
        accountId,
        clientId,
        shipmentNumber: `SHP-${Date.now()}`,
        importerName: "Test Importer",
      },
    });

    const charge = await prisma.shipmentCharge.create({
      data: {
        accountId,
        shipmentId: shipment.id,
        description: "Duty disbursed to CBP",
        quantity: 1,
        unitPrice: 2650,
        grossAmount: 2650,
        netAmount: 2650,
      },
    });

    const billed = await linkRecoveryCharge({
      accountId,
      disbursementId: disb.id,
      shipmentChargeId: charge.id,
    });

    expect(billed.status).toBe("BILLED_TO_CLIENT");
    expect(billed.recoveryChargeId).toBe(charge.id);
  });

  it("handles failure reversal after payment to CBP", async () => {
    const accountId = `acc_fail_${Date.now()}`;
    const clientId = `cli_fail_${Date.now()}`;
    await setupAccountAndClient(accountId, clientId);

    const acc = await getOrCreateDisbursementAccount({
      accountId,
      clientId,
    });

    await postLedgerEntry({
      accountId,
      disbursementAccountId: acc.id,
      type: "ADVANCE_DEPOSIT",
      amount: 5000,
      description: "Fund account",
      idempotencyKey: `fund-fail-${Date.now()}`,
    });

    const filingId = `filing_fail_${Date.now()}`;
    const disb = await createOrUpdateEstimatedDisbursement({
      accountId,
      clientId,
      filingId,
      dutyAmount: 1000,
      taxAmount: 0,
      feeAmount: 0,
    });

    await authorizeDisbursement({ accountId, disbursementId: disb.id });
    await markDisbursementPaid({
      accountId,
      disbursementId: disb.id,
      paidAt: new Date(),
      actualAmount: 1000,
      idempotencyKey: `paid-fail-${disb.id}`,
    });

    // Balance is 4000
    const accAfterPaid = await prisma.dutyDisbursementAccount.findUnique({ where: { id: acc.id } });
    expect(Number(accAfterPaid?.currentBalance)).toBe(4000);

    // Fail payment
    const failed = await failDisbursement({
      accountId,
      disbursementId: disb.id,
      reason: "CBP Rejected ACH Debit",
    });

    expect(failed.status).toBe("FAILED");

    // Balance restored to 5000
    const accAfterFail = await prisma.dutyDisbursementAccount.findUnique({ where: { id: acc.id } });
    expect(Number(accAfterFail?.currentBalance)).toBe(5000);
  });
});
