import { db } from "@/lib/db";

export type StatementType = "DAILY" | "PERIODIC_MONTHLY";
export type AchPaymentMethod = "ACH_DEBIT" | "ACH_CREDIT";
export type AchPaymentStatus = "PENDING_ACH" | "SUBMITTED" | "SETTLED" | "FAILED";

export interface AchDutyPaymentInput {
  accountId: string;
  statementNumber: string;
  statementType: StatementType;
  statementDate: string;
  totalDutyAmount: number;
  totalFeeAmount: number;
  totalAmountDue: number;
  paymentMethod: AchPaymentMethod;
  payerRoutingNumber: string;
  payerAccountNumber: string;
  payerName: string;
  filerCode: string;
}

export interface AchDutyPaymentRecord {
  id: string;
  accountId: string;
  statementNumber: string;
  statementType: StatementType;
  totalAmountDue: number;
  paymentMethod: AchPaymentMethod;
  paymentDeadline: string;
  status: AchPaymentStatus;
  achTrackingId: string;
  submittedAt?: string;
}

/**
 * Calculates the Periodic Monthly Statement (PMS) payment deadline (15th working day of the month following entry).
 */
export function calculatePmsPaymentDeadline(statementMonthYear: string): Date {
  const [yearStr, monthStr] = statementMonthYear.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1; // 0-indexed

  // 15th working day of following month
  const targetMonth = (month + 1) % 12;
  const targetYear = month === 11 ? year + 1 : year;

  let workingDays = 0;
  let currentDay = new Date(targetYear, targetMonth, 1);

  while (workingDays < 15) {
    const dayOfWeek = currentDay.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
    if (workingDays < 15) {
      currentDay.setDate(currentDay.getDate() + 1);
    }
  }

  return currentDay;
}

/**
 * Initiates an ACH Debit payment workflow for a CBP Duty Statement.
 */
export async function initiateAchDutyPayment(input: AchDutyPaymentInput): Promise<AchDutyPaymentRecord> {
  const deadline = input.statementType === "PERIODIC_MONTHLY"
    ? calculatePmsPaymentDeadline(input.statementDate.slice(0, 7))
    : new Date(new Date(input.statementDate).getTime() + 10 * 24 * 3600 * 1000); // 10 working days for daily

  const achTrackingId = `ACH-${input.filerCode}-${Date.now().toString(36).toUpperCase()}`;

  const record: AchDutyPaymentRecord = {
    id: `pay-${Date.now()}`,
    accountId: input.accountId,
    statementNumber: input.statementNumber,
    statementType: input.statementType,
    totalAmountDue: input.totalAmountDue,
    paymentMethod: input.paymentMethod,
    paymentDeadline: deadline.toISOString(),
    status: "SUBMITTED",
    achTrackingId,
    submittedAt: new Date().toISOString(),
  };

  return record;
}
