import { db as prisma } from "@qubere/db";
import { Prisma } from "@prisma/client";
import { postLedgerEntry, reverseLedgerEntry } from "./ledgerService";
import { getOrCreateDisbursementAccount } from "./accountService";

export interface CreateEstimatedDisbursementInput {
  accountId: string;
  clientId: string;
  importerId?: string | null;
  shipmentId?: string | null;
  filingId?: string | null;
  entryNumber?: string | null;
  dutyAmount: number;
  taxAmount: number;
  feeAmount: number;
  currency?: string;
  feeLines?: { accountingClassCode: string; estimatedAmount: number }[];
}

export async function createOrUpdateEstimatedDisbursement(input: CreateEstimatedDisbursementInput) {
  const {
    accountId,
    clientId,
    importerId = null,
    shipmentId = null,
    filingId = null,
    entryNumber = null,
    dutyAmount,
    taxAmount,
    feeAmount,
    currency = "USD",
    feeLines = [],
  } = input;

  const estimatedTotal = dutyAmount + taxAmount + feeAmount;

  // Find or create the DutyDisbursementAccount (also validates client/importer
  // tenancy).
  const account = await getOrCreateDisbursementAccount({
    accountId,
    clientId,
    importerId: importerId || null,
    currency,
  });

  // If filingId exists, search existing
  if (filingId) {
    const existing = await prisma.dutyDisbursement.findFirst({
      where: { accountId, filingId },
      include: { feeLines: true },
    });

    if (existing) {
      if (existing.status !== "ESTIMATED") {
        return existing; // Frozen after AUTHORIZED
      }
      return prisma.dutyDisbursement.update({
        where: { id: existing.id },
        data: {
          estimatedAmount: new Prisma.Decimal(estimatedTotal),
          dutyAmount: new Prisma.Decimal(dutyAmount),
          taxAmount: new Prisma.Decimal(taxAmount),
          feeAmount: new Prisma.Decimal(feeAmount),
          entryNumber: entryNumber || existing.entryNumber,
          feeLines: {
            deleteMany: {},
            create: feeLines.map((fl) => ({
              accountingClassCode: fl.accountingClassCode,
              estimatedAmount: new Prisma.Decimal(fl.estimatedAmount),
            })),
          },
        },
        include: { feeLines: true },
      });
    }
  }

  return prisma.dutyDisbursement.create({
    data: {
      accountId,
      disbursementAccountId: account.id,
      clientId,
      importerId: importerId || null,
      shipmentId: shipmentId || null,
      filingId: filingId || null,
      entryNumber: entryNumber || null,
      status: "ESTIMATED",
      estimatedAmount: new Prisma.Decimal(estimatedTotal),
      dutyAmount: new Prisma.Decimal(dutyAmount),
      taxAmount: new Prisma.Decimal(taxAmount),
      feeAmount: new Prisma.Decimal(feeAmount),
      currency,
      feeLines: {
        create: feeLines.map((fl) => ({
          accountingClassCode: fl.accountingClassCode,
          estimatedAmount: new Prisma.Decimal(fl.estimatedAmount),
        })),
      },
    },
    include: { feeLines: true },
  });
}

export async function authorizeDisbursement(input: {
  accountId: string;
  disbursementId: string;
  forceHardBlockOverride?: boolean;
}) {
  const { accountId, disbursementId, forceHardBlockOverride = false } = input;

  const disbursement = await prisma.dutyDisbursement.findFirst({
    where: { id: disbursementId, accountId },
    include: { disbursementAccount: true },
  });

  if (!disbursement) {
    throw new Error(`DutyDisbursement ${disbursementId} not found`);
  }

  if (disbursement.status !== "ESTIMATED") {
    throw new Error(`Cannot authorize disbursement in status ${disbursement.status}. Expected ESTIMATED.`);
  }

  const account = disbursement.disbursementAccount;
  if (account.status === "SUSPENDED") {
    throw new Error("Cannot authorize disbursement on a SUSPENDED account.");
  }

  // Funds check: currentBalance - openAuthorized >= estimatedAmount
  const openAuthorizedAgg = await prisma.dutyDisbursement.aggregate({
    where: {
      disbursementAccountId: account.id,
      status: { in: ["AUTHORIZED", "SCHEDULED"] },
    },
    _sum: { estimatedAmount: true },
  });

  const openAuthorized = Number(openAuthorizedAgg._sum.estimatedAmount || 0);
  const currentBal = Number(account.currentBalance);
  const estimatedReq = Number(disbursement.estimatedAmount);

  const available = currentBal - openAuthorized;
  const isShortfall = available < estimatedReq;

  // Check setup for hard block
  const setup = await prisma.dutyPaymentSetup.findFirst({
    where: { accountId, clientId: disbursement.clientId, importerId: disbursement.importerId || null },
  });

  const isHardBlock = setup?.mode === "BROKER_DISBURSES" && setup?.recoveryMode === "HARD_BLOCK";

  if (isShortfall && isHardBlock && !forceHardBlockOverride) {
    throw new Error(
      `Funds check failed: available advance balance ($${available.toFixed(2)}) is less than estimated requirement ($${estimatedReq.toFixed(2)}).`
    );
  }

  // If shortfall, raise a BillingException
  if (isShortfall) {
    await prisma.billingException.create({
      data: {
        accountId,
        type: "DUTY_ADVANCE_SHORTFALL",
        severity: "HIGH",
        status: "OPEN",
        description: `Duty advance shortfall on client ${disbursement.clientId}: requirement $${estimatedReq.toFixed(2)}, available advance $${available.toFixed(2)}.`,
        clientId: disbursement.clientId,
      },
    });
  }

  return prisma.dutyDisbursement.update({
    where: { id: disbursementId },
    data: { status: "AUTHORIZED" },
  });
}

export async function markDisbursementPaid(input: {
  accountId: string;
  disbursementId: string;
  paidAt: Date;
  cbpPaymentRef?: string | null;
  actualAmount: number;
  dutyAmount?: number;
  taxAmount?: number;
  feeAmount?: number;
  feeBreakdown?: { accountingClassCode: string; actualAmount: number }[];
  paymentMethod?: string;
  createdById?: string | null;
  idempotencyKey: string;
  allowNegativeBalanceOverride?: boolean;
}) {
  const {
    accountId,
    disbursementId,
    paidAt,
    cbpPaymentRef = null,
    actualAmount,
    feeBreakdown = [],
    paymentMethod = "ACH_STATEMENT",
    createdById = null,
    idempotencyKey,
    allowNegativeBalanceOverride = false,
  } = input;

  if (actualAmount <= 0) {
    throw new Error("actualAmount must be > 0 when marking disbursement paid.");
  }

  const disbursement = await prisma.dutyDisbursement.findFirst({
    where: { id: disbursementId, accountId },
    include: { feeLines: true },
  });

  if (!disbursement) {
    throw new Error(`DutyDisbursement ${disbursementId} not found`);
  }

  if (disbursement.status !== "AUTHORIZED" && disbursement.status !== "SCHEDULED") {
    throw new Error(`Cannot mark paid disbursement in status ${disbursement.status}. Expected AUTHORIZED or SCHEDULED.`);
  }

  const dutyAmt = input.dutyAmount !== undefined ? input.dutyAmount : Number(disbursement.dutyAmount || 0);
  const taxAmt = input.taxAmount !== undefined ? input.taxAmount : Number(disbursement.taxAmount || 0);
  const feeLinesSum = feeBreakdown.reduce((sum, f) => sum + f.actualAmount, 0);
  const feeAmt = feeBreakdown.length > 0 ? feeLinesSum : input.feeAmount !== undefined ? input.feeAmount : Number(disbursement.feeAmount || 0);

  const calculatedTotal = dutyAmt + taxAmt + feeAmt;
  if (Math.abs(calculatedTotal - actualAmount) > 0.01) {
    throw new Error(
      `Fee/duty/tax breakdown sum ($${calculatedTotal.toFixed(2)}) does not match actualAmount ($${actualAmount.toFixed(2)}) within $0.01 tolerance.`
    );
  }

  // Post negative ledger entry inside transaction
  await postLedgerEntry({
    accountId,
    disbursementAccountId: disbursement.disbursementAccountId,
    type: "DUTY_DISBURSEMENT",
    amount: -actualAmount,
    description: `Duty disbursement fronted to CBP for entry ${disbursement.entryNumber || disbursement.id}`,
    effectiveAt: paidAt,
    disbursementId,
    createdById,
    idempotencyKey,
    allowNegativeBalanceOverride,
  });

  // Update fee lines
  if (feeBreakdown.length > 0) {
    for (const fb of feeBreakdown) {
      const existingLine = disbursement.feeLines.find((fl) => fl.accountingClassCode === fb.accountingClassCode);
      if (existingLine) {
        await prisma.dutyDisbursementFeeLine.update({
          where: { id: existingLine.id },
          data: { actualAmount: new Prisma.Decimal(fb.actualAmount) },
        });
      } else {
        await prisma.dutyDisbursementFeeLine.create({
          data: {
            disbursementId,
            accountingClassCode: fb.accountingClassCode,
            estimatedAmount: new Prisma.Decimal(fb.actualAmount),
            actualAmount: new Prisma.Decimal(fb.actualAmount),
          },
        });
      }
    }
  }

  return prisma.dutyDisbursement.update({
    where: { id: disbursementId },
    data: {
      status: "PAID_TO_CBP",
      paidAt,
      cbpPaymentRef: cbpPaymentRef || undefined,
      actualAmount: new Prisma.Decimal(actualAmount),
      dutyAmount: new Prisma.Decimal(dutyAmt),
      taxAmount: new Prisma.Decimal(taxAmt),
      feeAmount: new Prisma.Decimal(feeAmt),
      paymentMethod,
    },
  });
}

export async function linkRecoveryCharge(input: {
  accountId: string;
  disbursementId: string;
  shipmentChargeId: string;
}) {
  const { accountId, disbursementId, shipmentChargeId } = input;

  const disbursement = await prisma.dutyDisbursement.findFirst({
    where: { id: disbursementId, accountId },
  });

  if (!disbursement) {
    throw new Error(`DutyDisbursement ${disbursementId} not found`);
  }

  const charge = await prisma.shipmentCharge.findFirst({
    where: { id: shipmentChargeId, accountId },
  });

  if (!charge) {
    throw new Error(`ShipmentCharge ${shipmentChargeId} not found`);
  }

  if (charge.currency !== disbursement.currency) {
    throw new Error(`Currency mismatch between recovery charge (${charge.currency}) and disbursement (${disbursement.currency})`);
  }

  await prisma.shipmentCharge.update({
    where: { id: shipmentChargeId },
    data: { disbursementId },
  });

  return prisma.dutyDisbursement.update({
    where: { id: disbursementId },
    data: {
      recoveryChargeId: shipmentChargeId,
      status: "BILLED_TO_CLIENT",
      billedAt: new Date(),
    },
  });
}

export async function failDisbursement(input: {
  accountId: string;
  disbursementId: string;
  reason: string;
  createdById?: string | null;
  idempotencyKey?: string;
}) {
  const { accountId, disbursementId, reason, createdById = null, idempotencyKey = `fail-${disbursementId}-${Date.now()}` } = input;

  const disbursement = await prisma.dutyDisbursement.findFirst({
    where: { id: disbursementId, accountId },
    include: { ledgerEntries: true },
  });

  if (!disbursement) throw new Error(`DutyDisbursement ${disbursementId} not found`);

  // Reverse any posted disbursement ledger entry
  const paidEntry = disbursement.ledgerEntries.find((e) => e.type === "DUTY_DISBURSEMENT");
  if (paidEntry) {
    await reverseLedgerEntry({
      accountId,
      entryId: paidEntry.id,
      reason: `Disbursement failed: ${reason}`,
      createdById,
      idempotencyKey,
    });
  }

  // Raise BillingException
  await prisma.billingException.create({
    data: {
      accountId,
      type: "DUTY_DISBURSEMENT_FAILED",
      severity: "CRITICAL",
      status: "OPEN",
      description: `CBP disbursement payment failed for entry ${disbursement.entryNumber || disbursementId}: ${reason}`,
      clientId: disbursement.clientId,
    },
  });

  return prisma.dutyDisbursement.update({
    where: { id: disbursementId },
    data: {
      status: "FAILED",
      failureReason: reason,
    },
  });
}

export async function cancelDisbursement(input: {
  accountId: string;
  disbursementId: string;
  reason: string;
}) {
  const { accountId, disbursementId, reason } = input;

  const disbursement = await prisma.dutyDisbursement.findFirst({
    where: { id: disbursementId, accountId },
  });

  if (!disbursement) throw new Error(`DutyDisbursement ${disbursementId} not found`);
  if (disbursement.status === "PAID_TO_CBP" || disbursement.status === "BILLED_TO_CLIENT" || disbursement.status === "SETTLED") {
    throw new Error(`Cannot cancel disbursement in status ${disbursement.status}. Use fail / reversal instead.`);
  }

  return prisma.dutyDisbursement.update({
    where: { id: disbursementId },
    data: {
      status: "CANCELLED",
      failureReason: reason,
    },
  });
}
