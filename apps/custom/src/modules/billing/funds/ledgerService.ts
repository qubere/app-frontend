import { db as prisma } from "@qubere/db";
import { Prisma } from "@prisma/client";

export type FundsLedgerEntryType =
  | "ADVANCE_DEPOSIT"
  | "DUTY_DISBURSEMENT"
  | "FEE_DISBURSEMENT"
  | "TAX_DISBURSEMENT"
  | "REPLENISHMENT_RECEIPT"
  | "REFUND_TO_CLIENT"
  | "WRITE_OFF"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "ADJUSTMENT"
  | "REVERSAL"
  | "INTEREST_OR_PENALTY";

export interface PostLedgerEntryInput {
  accountId: string;
  disbursementAccountId: string;
  type: FundsLedgerEntryType;
  amount: number | Prisma.Decimal;
  description: string;
  effectiveAt?: Date;
  disbursementId?: string | null;
  depositId?: string | null;
  replenishmentRequestId?: string | null;
  invoiceId?: string | null;
  createdById?: string | null;
  idempotencyKey: string;
  allowNegativeBalanceOverride?: boolean;
}

const POSITIVE_TYPES: Set<FundsLedgerEntryType> = new Set([
  "ADVANCE_DEPOSIT",
  "REPLENISHMENT_RECEIPT",
  "TRANSFER_IN",
]);

const NEGATIVE_TYPES: Set<FundsLedgerEntryType> = new Set([
  "DUTY_DISBURSEMENT",
  "FEE_DISBURSEMENT",
  "TAX_DISBURSEMENT",
  "REFUND_TO_CLIENT",
  "WRITE_OFF",
  "TRANSFER_OUT",
  "INTEREST_OR_PENALTY",
]);

export async function postLedgerEntry(input: PostLedgerEntryInput) {
  const {
    accountId,
    disbursementAccountId,
    type,
    description,
    effectiveAt = new Date(),
    disbursementId = null,
    depositId = null,
    replenishmentRequestId = null,
    invoiceId = null,
    createdById = null,
    idempotencyKey,
    allowNegativeBalanceOverride = false,
  } = input;

  const rawAmount = new Prisma.Decimal(input.amount.toString());
  if (rawAmount.isZero()) {
    throw new Error("Ledger entry amount cannot be zero");
  }

  if (POSITIVE_TYPES.has(type) && rawAmount.isNegative()) {
    throw new Error(`Amount for entry type ${type} must be positive`);
  }
  if (NEGATIVE_TYPES.has(type) && !rawAmount.isNegative()) {
    throw new Error(`Amount for entry type ${type} must be negative`);
  }

  // Idempotency check
  const existingKey = await prisma.fundsLedgerEntry.findFirst({
    where: { accountId, idempotencyKey },
  });
  if (existingKey) {
    return existingKey;
  }

  // Perform inside transaction with row lock
  return prisma.$transaction(async (tx) => {
    // Row lock on account
    const accounts = await tx.$queryRaw<
      Array<{ id: string; currentBalance: Prisma.Decimal; currency: string; status: string }>
    >`SELECT id, "currentBalance", currency, status FROM "DutyDisbursementAccount" WHERE id = ${disbursementAccountId} AND "accountId" = ${accountId} FOR UPDATE`;

    if (!accounts || accounts.length === 0) {
      throw new Error(`DutyDisbursementAccount ${disbursementAccountId} not found`);
    }

    const acc = accounts[0];
    if (acc.status === "SUSPENDED") {
      throw new Error("Account is SUSPENDED. Posting ledger entries is blocked.");
    }
    if (acc.status === "CLOSED") {
      throw new Error("Account is CLOSED.");
    }

    const prevBalance = new Prisma.Decimal(acc.currentBalance);
    const newBalance = prevBalance.add(rawAmount);

    if (newBalance.isNegative() && !allowNegativeBalanceOverride) {
      throw new Error(`Insufficient funds: transaction would leave balance negative (${newBalance.toFixed(2)}) without override permission.`);
    }

    const entry = await tx.fundsLedgerEntry.create({
      data: {
        accountId,
        disbursementAccountId,
        type: type as any,
        amount: rawAmount,
        runningBalance: newBalance,
        currency: acc.currency,
        description,
        effectiveAt,
        disbursementId,
        depositId,
        replenishmentRequestId,
        invoiceId,
        createdById,
        idempotencyKey,
      },
    });

    await tx.dutyDisbursementAccount.update({
      where: { id: disbursementAccountId },
      data: {
        currentBalance: newBalance,
      },
    });

    return entry;
  });
}

export async function reverseLedgerEntry(input: {
  accountId: string;
  entryId: string;
  reason: string;
  createdById?: string | null;
  idempotencyKey: string;
  allowNegativeBalanceOverride?: boolean;
}) {
  const { accountId, entryId, reason, createdById = null, idempotencyKey, allowNegativeBalanceOverride = false } = input;

  const original = await prisma.fundsLedgerEntry.findFirst({
    where: { id: entryId, accountId },
  });

  if (!original) {
    throw new Error(`FundsLedgerEntry ${entryId} not found`);
  }

  if (original.reversesEntryId) {
    throw new Error("Cannot reverse a reversal entry");
  }

  const existingReversal = await prisma.fundsLedgerEntry.findFirst({
    where: { accountId, reversesEntryId: entryId },
  });
  if (existingReversal) {
    throw new Error(`Entry ${entryId} has already been reversed by ${existingReversal.id}`);
  }

  const reversalAmount = original.amount.negated();

  return prisma.$transaction(async (tx) => {
    const accounts = await tx.$queryRaw<
      Array<{ id: string; currentBalance: Prisma.Decimal; currency: string; status: string }>
    >`SELECT id, "currentBalance", currency, status FROM "DutyDisbursementAccount" WHERE id = ${original.disbursementAccountId} AND "accountId" = ${accountId} FOR UPDATE`;

    if (!accounts || accounts.length === 0) {
      throw new Error(`DutyDisbursementAccount ${original.disbursementAccountId} not found`);
    }

    const acc = accounts[0];
    const prevBalance = new Prisma.Decimal(acc.currentBalance);
    const newBalance = prevBalance.add(reversalAmount);

    if (newBalance.isNegative() && !allowNegativeBalanceOverride) {
      throw new Error(`Reversal would leave balance negative (${newBalance.toFixed(2)}) without override permission.`);
    }

    const reversalEntry = await tx.fundsLedgerEntry.create({
      data: {
        accountId,
        disbursementAccountId: original.disbursementAccountId,
        type: "REVERSAL",
        amount: reversalAmount,
        runningBalance: newBalance,
        currency: acc.currency,
        description: `Reversal of entry ${entryId}: ${reason}`,
        effectiveAt: new Date(),
        disbursementId: original.disbursementId,
        depositId: original.depositId,
        replenishmentRequestId: original.replenishmentRequestId,
        invoiceId: original.invoiceId,
        reversesEntryId: original.id,
        createdById,
        idempotencyKey,
      },
    });

    await tx.dutyDisbursementAccount.update({
      where: { id: original.disbursementAccountId },
      data: { currentBalance: newBalance },
    });

    return reversalEntry;
  });
}

export async function getAccountLedger(
  accountId: string,
  disbursementAccountId: string,
  options: {
    limit?: number;
    offset?: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
) {
  const where: Prisma.FundsLedgerEntryWhereInput = {
    accountId,
    disbursementAccountId,
  };

  if (options.type) {
    where.type = options.type as any;
  }
  if (options.startDate || options.endDate) {
    where.effectiveAt = {};
    if (options.startDate) where.effectiveAt.gte = options.startDate;
    if (options.endDate) where.effectiveAt.lte = options.endDate;
  }

  const [total, entries] = await Promise.all([
    prisma.fundsLedgerEntry.count({ where }),
    prisma.fundsLedgerEntry.findMany({
      where,
      orderBy: { effectiveAt: "desc" },
      take: options.limit || 50,
      skip: options.offset || 0,
      include: {
        disbursement: true,
        replenishmentRequest: true,
        invoice: true,
      },
    }),
  ]);

  return { total, entries };
}
