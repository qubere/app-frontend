import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type StatementType = "DAILY" | "PERIODIC_MONTHLY";
export type AchPaymentMethod = "ACH_DEBIT" | "ACH_CREDIT";
export type AchPaymentStatus =
  | "PENDING"
  | "SCHEDULED"
  | "SUBMITTED"
  | "SETTLED"
  | "FAILED"
  | "CANCELLED";

/**
 * Calculates the Periodic Monthly Statement (PMS) payment deadline: the 15th
 * working day of the month following the month of entry (Mon–Fri, no federal
 * holiday calendar).
 */
export function calculatePmsPaymentDeadline(statementMonthYear: string): Date {
  const [yearStr, monthStr] = statementMonthYear.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1; // 0-indexed

  const targetMonth = (month + 1) % 12;
  const targetYear = month === 11 ? year + 1 : year;

  let workingDays = 0;
  const cursor = new Date(Date.UTC(targetYear, targetMonth, 1));

  while (workingDays < 15) {
    const dayOfWeek = cursor.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
    if (workingDays < 15) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return cursor;
}

/** Daily statements are due the next business day after the statement date. */
export function calculateDailyStatementDeadline(statementDate: string | Date): Date {
  const d = new Date(statementDate);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

export function paymentDeadlineFor(statementType: StatementType, statementDate: string): Date {
  return statementType === "PERIODIC_MONTHLY"
    ? calculatePmsPaymentDeadline(statementDate.slice(0, 7))
    : calculateDailyStatementDeadline(statementDate);
}

function lastFour(accountNumber?: string | null): string | null {
  if (!accountNumber) return null;
  const digits = accountNumber.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export interface CreateDutyPaymentInput {
  accountId: string;
  statementRecordId?: string | null;
  statementNumber: string;
  statementType: StatementType;
  statementDate: string;
  filerCode?: string | null;
  totalDutyAmount: number;
  totalFeeAmount: number;
  totalAmountDue: number;
  paymentMethod?: AchPaymentMethod;
  /** Full payer account number — never stored; only the last four are kept. */
  payerAccountNumber?: string | null;
  createdByUserId?: string | null;
}

/**
 * Creates a duty-payment instruction for a CBP statement in PENDING state.
 * This records the obligation and its deadline; it does not move funds.
 */
export async function createDutyPaymentInstruction(input: CreateDutyPaymentInput) {
  const deadline = paymentDeadlineFor(input.statementType, input.statementDate);
  const achTrackingId = `ACH-${input.filerCode ?? "NA"}-${input.statementNumber}-${Date.now().toString(36).toUpperCase()}`;

  return db.dutyPaymentInstruction.create({
    data: {
      accountId: input.accountId,
      statementRecordId: input.statementRecordId ?? null,
      statementNumber: input.statementNumber,
      statementType: input.statementType,
      statementDate: new Date(input.statementDate),
      filerCode: input.filerCode ?? null,
      totalDutyAmount: new Prisma.Decimal(input.totalDutyAmount),
      totalFeeAmount: new Prisma.Decimal(input.totalFeeAmount),
      totalAmountDue: new Prisma.Decimal(input.totalAmountDue),
      paymentMethod: input.paymentMethod ?? "ACH_DEBIT",
      payerAccountLast4: lastFour(input.payerAccountNumber),
      paymentDeadline: deadline,
      status: "PENDING",
      achTrackingId,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
}

const PAYMENT_TRANSITIONS: Record<AchPaymentStatus, AchPaymentStatus[]> = {
  PENDING: ["SCHEDULED", "SUBMITTED", "CANCELLED"],
  SCHEDULED: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["SETTLED", "FAILED"],
  SETTLED: [],
  FAILED: ["PENDING"],
  CANCELLED: [],
};

/**
 * Advances a payment instruction through its lifecycle. Records the timestamp
 * for the target state (scheduledAt / submittedAt / settledAt) and the failure
 * reason on FAILED.
 */
export async function updateDutyPaymentStatus(
  accountId: string,
  id: string,
  nextStatus: AchPaymentStatus,
  detail?: { scheduledAt?: string; failureReason?: string }
) {
  const existing = await db.dutyPaymentInstruction.findFirst({ where: { id, accountId } });
  if (!existing) return { ok: false as const, reason: "NOT_FOUND" as const };

  const allowed = PAYMENT_TRANSITIONS[existing.status as AchPaymentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    return { ok: false as const, reason: "INVALID_TRANSITION" as const, from: existing.status };
  }

  const now = new Date();
  const updated = await db.dutyPaymentInstruction.update({
    where: { id },
    data: {
      status: nextStatus,
      ...(nextStatus === "SCHEDULED"
        ? { scheduledAt: detail?.scheduledAt ? new Date(detail.scheduledAt) : now }
        : {}),
      ...(nextStatus === "SUBMITTED" ? { submittedAt: now } : {}),
      ...(nextStatus === "SETTLED" ? { settledAt: now } : {}),
      ...(nextStatus === "FAILED" ? { failureReason: detail?.failureReason ?? "Unspecified ACH failure" } : {}),
    },
  });
  return { ok: true as const, payment: updated };
}

export async function listDutyPaymentInstructions(accountId: string, status?: string) {
  return db.dutyPaymentInstruction.findMany({
    where: { accountId, ...(status ? { status } : {}) },
    orderBy: { paymentDeadline: "asc" },
    take: 200,
  });
}

export async function getDutyPaymentInstruction(accountId: string, id: string) {
  return db.dutyPaymentInstruction.findFirst({ where: { id, accountId } });
}
