import { db as prisma } from "@qubere/db";
import { Prisma } from "@prisma/client";

export interface CreateAccountInput {
  accountId: string;
  clientId: string;
  importerId?: string | null;
  currency?: string;
  minimumBalance?: number;
  targetBalance?: number;
  autoRequestReplenishment?: boolean;
  autoAuthorizeUnder?: number | null;
}

export async function getOrCreateDisbursementAccount(input: CreateAccountInput) {
  const { accountId, clientId, importerId = null, currency = "USD", minimumBalance = 0, targetBalance = 0, autoRequestReplenishment = false, autoAuthorizeUnder = null } = input;

  if (minimumBalance < 0) throw new Error("minimumBalance must be >= 0");
  if (targetBalance < minimumBalance) throw new Error("targetBalance must be >= minimumBalance");
  if (autoAuthorizeUnder !== null && autoAuthorizeUnder !== undefined && autoAuthorizeUnder < 0) {
    throw new Error("autoAuthorizeUnder must be >= 0");
  }

  // The clientId (and importerId) arrive from request bodies — confirm they
  // belong to this tenant before creating an account that references them.
  const client = await prisma.client.findFirst({ where: { id: clientId, accountId }, select: { id: true } });
  if (!client) throw new Error(`Client ${clientId} not found`);
  if (importerId) {
    const importer = await prisma.importerOfRecord.findFirst({ where: { id: importerId, accountId }, select: { id: true } });
    if (!importer) throw new Error(`ImporterOfRecord ${importerId} not found`);
  }

  const existing = await prisma.dutyDisbursementAccount.findFirst({
    where: {
      accountId,
      clientId,
      importerId: importerId || null,
    },
  });

  if (existing) return existing;

  // Try creation
  try {
    return await prisma.dutyDisbursementAccount.create({
      data: {
        accountId,
        clientId,
        importerId: importerId || null,
        currency,
        minimumBalance: new Prisma.Decimal(minimumBalance),
        targetBalance: new Prisma.Decimal(targetBalance),
        autoRequestReplenishment,
        autoAuthorizeUnder: autoAuthorizeUnder !== null && autoAuthorizeUnder !== undefined ? new Prisma.Decimal(autoAuthorizeUnder) : null,
        currentBalance: new Prisma.Decimal(0),
        status: "ACTIVE",
      },
    });
  } catch (err: any) {
    // If unique constraint collision occurs with null/empty importerId
    const fallback = await prisma.dutyDisbursementAccount.findFirst({
      where: { accountId, clientId, importerId: importerId || null },
    });
    if (fallback) return fallback;
    throw err;
  }
}

export async function getDisbursementAccount(accountId: string, id: string) {
  const account = await prisma.dutyDisbursementAccount.findFirst({
    where: { id, accountId },
    include: {
      client: true,
      importer: true,
    },
  });
  if (!account) throw new Error(`DutyDisbursementAccount ${id} not found`);
  return account;
}

export async function listDisbursementAccounts(
  accountId: string,
  filters: {
    clientId?: string;
    importerId?: string;
    status?: string;
    belowMinimum?: boolean;
    negative?: boolean;
  } = {}
) {
  const where: Prisma.DutyDisbursementAccountWhereInput = { accountId };

  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.importerId) where.importerId = filters.importerId;
  if (filters.status) where.status = filters.status as any;

  const accounts = await prisma.dutyDisbursementAccount.findMany({
    where,
    include: {
      client: true,
      importer: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return accounts.filter((acc) => {
    const cur = Number(acc.currentBalance);
    const min = Number(acc.minimumBalance);
    if (filters.belowMinimum && cur >= min) return false;
    if (filters.negative && cur >= 0) return false;
    return true;
  });
}

export async function updateDisbursementAccount(
  accountId: string,
  id: string,
  updates: {
    minimumBalance?: number;
    targetBalance?: number;
    autoRequestReplenishment?: boolean;
    autoAuthorizeUnder?: number | null;
    status?: "ACTIVE" | "SUSPENDED" | "CLOSED";
  }
) {
  const existing = await getDisbursementAccount(accountId, id);

  if (updates.status === "CLOSED") {
    if (Number(existing.currentBalance) !== 0) {
      throw new Error("Cannot close account with non-zero balance");
    }
    const openDisbursements = await prisma.dutyDisbursement.count({
      where: {
        disbursementAccountId: id,
        status: { in: ["ESTIMATED", "AUTHORIZED", "SCHEDULED", "PAID_TO_CBP"] },
      },
    });
    if (openDisbursements > 0) {
      throw new Error("Cannot close account with open disbursements");
    }
  }

  const min = updates.minimumBalance !== undefined ? updates.minimumBalance : Number(existing.minimumBalance);
  const target = updates.targetBalance !== undefined ? updates.targetBalance : Number(existing.targetBalance);

  if (min < 0) throw new Error("minimumBalance must be >= 0");
  if (target < min) throw new Error("targetBalance must be >= minimumBalance");

  return prisma.dutyDisbursementAccount.update({
    where: { id },
    data: {
      minimumBalance: updates.minimumBalance !== undefined ? new Prisma.Decimal(updates.minimumBalance) : undefined,
      targetBalance: updates.targetBalance !== undefined ? new Prisma.Decimal(updates.targetBalance) : undefined,
      autoRequestReplenishment: updates.autoRequestReplenishment,
      autoAuthorizeUnder:
        updates.autoAuthorizeUnder !== undefined
          ? updates.autoAuthorizeUnder === null
            ? null
            : new Prisma.Decimal(updates.autoAuthorizeUnder)
          : undefined,
      status: updates.status,
    },
  });
}

export async function calculateDaysOfCoverAndExposure(accountId: string, disbursementAccountId: string) {
  const account = await getDisbursementAccount(accountId, disbursementAccountId);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Trailing 30 day disbursements
  const paidEntries = await prisma.fundsLedgerEntry.aggregate({
    where: {
      disbursementAccountId,
      type: { in: ["DUTY_DISBURSEMENT", "FEE_DISBURSEMENT", "TAX_DISBURSEMENT"] },
      effectiveAt: { gte: thirtyDaysAgo },
    },
    _sum: { amount: true },
  });

  const sum30Days = Math.abs(Number(paidEntries._sum.amount || 0));
  const avgDailyDisbursement = sum30Days / 30;

  const currentBalance = Number(account.currentBalance);
  const daysOfCover = avgDailyDisbursement > 0 ? currentBalance / avgDailyDisbursement : currentBalance > 0 ? 999 : 0;

  // Open exposure = total fronted in PAID_TO_CBP / BILLED_TO_CLIENT not yet SETTLED
  const openDisbursements = await prisma.dutyDisbursement.aggregate({
    where: {
      disbursementAccountId,
      status: { in: ["PAID_TO_CBP", "BILLED_TO_CLIENT"] },
    },
    _sum: { actualAmount: true },
  });

  const exposure = Number(openDisbursements._sum.actualAmount || 0);

  return {
    currentBalance,
    minimumBalance: Number(account.minimumBalance),
    targetBalance: Number(account.targetBalance),
    daysOfCover: Math.round(daysOfCover * 10) / 10,
    dailyBurnRate: Math.round(avgDailyDisbursement * 100) / 100,
    openExposure: Math.round(exposure * 100) / 100,
  };
}

export async function assertAccountDrift(accountId: string, disbursementAccountId: string) {
  const account = await getDisbursementAccount(accountId, disbursementAccountId);
  const entries = await prisma.fundsLedgerEntry.findMany({
    where: { disbursementAccountId },
    select: { amount: true },
  });

  const calculatedSum = entries.reduce((acc, curr) => acc.add(curr.amount), new Prisma.Decimal(0));
  const currentBalance = new Prisma.Decimal(account.currentBalance);

  const diff = calculatedSum.sub(currentBalance).abs();
  const isDrifted = diff.gte(new Prisma.Decimal("0.001"));

  return {
    isDrifted,
    currentBalance: currentBalance.toNumber(),
    calculatedSum: calculatedSum.toNumber(),
    difference: diff.toNumber(),
  };
}
