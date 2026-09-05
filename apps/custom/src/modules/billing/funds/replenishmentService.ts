import { db as prisma } from "@qubere/db";
import { Prisma } from "@prisma/client";
import { postLedgerEntry } from "./ledgerService";

export async function evaluateAndCreateReplenishmentRequests(accountId: string) {
  const accounts = await prisma.dutyDisbursementAccount.findMany({
    where: {
      accountId,
      autoRequestReplenishment: true,
      status: "ACTIVE",
    },
  });

  const createdRequests: any[] = [];

  for (const account of accounts) {
    const cur = Number(account.currentBalance);
    const min = Number(account.minimumBalance);
    const target = Number(account.targetBalance);

    if (cur < min) {
      // Check for deduplicated open request
      const existingOpen = await prisma.replenishmentRequest.findFirst({
        where: {
          disbursementAccountId: account.id,
          state: { in: ["REQUESTED", "NOTIFIED"] },
        },
      });

      if (!existingOpen) {
        const requiredAmount = target - cur;
        if (requiredAmount > 0) {
          const req = await prisma.replenishmentRequest.create({
            data: {
              accountId,
              disbursementAccountId: account.id,
              amount: new Prisma.Decimal(requiredAmount),
              currency: account.currency,
              state: "REQUESTED",
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
              note: `Auto-generated replenishment request: balance ($${cur.toFixed(2)}) below minimum ($${min.toFixed(2)}).`,
            },
          });
          createdRequests.push(req);
        }
      }
    }
  }

  return createdRequests;
}

export async function satisfyReplenishmentRequest(input: {
  accountId: string;
  requestId: string;
  depositId?: string | null;
  depositAmount: number;
  createdById?: string | null;
  idempotencyKey?: string;
}) {
  const { accountId, requestId, depositId = null, depositAmount, createdById = null } = input;

  const request = await prisma.replenishmentRequest.findFirst({
    where: { id: requestId, accountId },
    include: { disbursementAccount: true },
  });

  if (!request) {
    throw new Error(`ReplenishmentRequest ${requestId} not found`);
  }

  if (request.state === "SATISFIED" || request.state === "CANCELLED") {
    throw new Error(`Cannot satisfy replenishment request in state ${request.state}`);
  }

  const reqAmount = Number(request.amount);
  if (depositAmount < reqAmount * 0.95) {
    throw new Error(
      `Deposit amount ($${depositAmount.toFixed(2)}) is less than the 95% threshold of request amount ($${reqAmount.toFixed(2)})`
    );
  }

  const idempotencyKey = input.idempotencyKey || `replenish-satisfy-${requestId}-${Date.now()}`;

  // Record deposit ledger entry if depositId was provided or create REPLENISHMENT_RECEIPT
  let entry;
  if (!depositId) {
    entry = await postLedgerEntry({
      accountId,
      disbursementAccountId: request.disbursementAccountId,
      type: "REPLENISHMENT_RECEIPT",
      amount: depositAmount,
      description: `Replenishment deposit satisfying request ${requestId}`,
      effectiveAt: new Date(),
      replenishmentRequestId: requestId,
      createdById,
      idempotencyKey,
    });
  }

  return prisma.replenishmentRequest.update({
    where: { id: requestId },
    data: {
      state: "SATISFIED",
      satisfiedByDepositId: depositId || entry?.id || null,
      satisfiedAt: new Date(),
    },
  });
}

export async function checkOverdueReplenishmentRequests(accountId: string) {
  const now = new Date();
  const overdueList = await prisma.replenishmentRequest.findMany({
    where: {
      accountId,
      state: { in: ["REQUESTED", "NOTIFIED"] },
      dueDate: { lt: now },
    },
    include: { disbursementAccount: true },
  });

  const updated: any[] = [];

  for (const req of overdueList) {
    const res = await prisma.replenishmentRequest.update({
      where: { id: req.id },
      data: { state: "OVERDUE" },
    });

    await prisma.billingException.create({
      data: {
        accountId,
        type: "REPLENISHMENT_OVERDUE",
        severity: "HIGH",
        status: "OPEN",
        description: `Replenishment request of $${Number(req.amount).toFixed(2)} is overdue since ${req.dueDate?.toISOString()}.`,
        clientId: req.disbursementAccount.clientId,
      },
    });

    updated.push(res);
  }

  return updated;
}
