import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type CbpCulpabilityLevel = "NEGLIGENCE" | "GROSS_NEGLIGENCE" | "FRAUD";

export interface PenaltyExposureInput {
  actualDutyLoss: number;
  enteredValue: number;
  culpability: CbpCulpabilityLevel;
  interestRatePct?: number; // Default 5%
  yearsElapsed?: number; // Default 1 year
}

export interface PenaltyExposureResult {
  culpability: CbpCulpabilityLevel;
  interestAmount: number;
  statutoryMaxPenaltyWithoutDisclosure: number;
  disclosedTenderAmount: number;
  estimatedPenaltyWithDisclosure: number;
  savingsFromDisclosure: number;
}

/**
 * Calculates 19 U.S.C. §1592 penalty exposure and the mitigation a valid
 * prior disclosure buys.
 *
 * Statutory maxima (19 U.S.C. §1592(c)):
 *  - Fraud: domestic value of the merchandise.
 *  - Gross negligence: lesser of 4× the loss of duties or 40% of dutiable value.
 *  - Negligence: lesser of 2× the loss of duties or 20% of dutiable value.
 *
 * With a valid prior disclosure (19 U.S.C. §1592(c)(4)) the penalty drops to:
 *  - Fraud: 100% of the actual loss of duties.
 *  - Negligence / gross negligence: interest on the actual loss of duties only.
 * The disclosing party also tenders the actual loss of duties itself.
 */
export function calculate1592PenaltyExposure(input: PenaltyExposureInput): PenaltyExposureResult {
  const { actualDutyLoss, enteredValue, culpability, interestRatePct = 5, yearsElapsed = 1 } = input;
  const interestAmount = actualDutyLoss * (interestRatePct / 100) * yearsElapsed;

  let statutoryMax = 0;
  let penaltyWithDisclosure = 0;

  switch (culpability) {
    case "FRAUD":
      statutoryMax = enteredValue;
      penaltyWithDisclosure = actualDutyLoss;
      break;
    case "GROSS_NEGLIGENCE":
      statutoryMax = Math.min(actualDutyLoss * 4, enteredValue * 0.4);
      penaltyWithDisclosure = interestAmount;
      break;
    case "NEGLIGENCE":
      statutoryMax = Math.min(actualDutyLoss * 2, enteredValue * 0.2);
      penaltyWithDisclosure = interestAmount;
      break;
  }

  const disclosedTender = actualDutyLoss + penaltyWithDisclosure;
  const savings = Math.max(0, statutoryMax - penaltyWithDisclosure);

  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    culpability,
    interestAmount: round(interestAmount),
    statutoryMaxPenaltyWithoutDisclosure: round(statutoryMax),
    disclosedTenderAmount: round(disclosedTender),
    estimatedPenaltyWithDisclosure: round(penaltyWithDisclosure),
    savingsFromDisclosure: round(savings),
  };
}

export interface RecordPriorDisclosureInput {
  accountId: string;
  filingId?: string | null;
  entryNumber?: string | null;
  description: string;
  culpability: CbpCulpabilityLevel;
  actualDutyLoss: number;
  enteredValue: number;
  interestRatePct?: number;
  yearsElapsed?: number;
  createdByUserId?: string | null;
}

/**
 * Persists a prior disclosure with its computed exposure snapshot. Starts in
 * DRAFT; the tender is recorded separately via {@link markPriorDisclosureTendered}.
 */
export async function recordPriorDisclosureEntry(input: RecordPriorDisclosureInput) {
  const exposure = calculate1592PenaltyExposure({
    actualDutyLoss: input.actualDutyLoss,
    enteredValue: input.enteredValue,
    culpability: input.culpability,
    interestRatePct: input.interestRatePct,
    yearsElapsed: input.yearsElapsed,
  });

  return db.priorDisclosure.create({
    data: {
      accountId: input.accountId,
      filingId: input.filingId ?? null,
      entryNumber: input.entryNumber ?? null,
      description: input.description,
      culpability: input.culpability,
      status: "DRAFT",
      actualDutyLoss: new Prisma.Decimal(input.actualDutyLoss),
      enteredValue: new Prisma.Decimal(input.enteredValue),
      interestAmount: new Prisma.Decimal(exposure.interestAmount),
      tenderAmount: new Prisma.Decimal(exposure.disclosedTenderAmount),
      statutoryMaxPenalty: new Prisma.Decimal(exposure.statutoryMaxPenaltyWithoutDisclosure),
      estimatedPenaltyWithDisclosure: new Prisma.Decimal(exposure.estimatedPenaltyWithDisclosure),
      savingsFromDisclosure: new Prisma.Decimal(exposure.savingsFromDisclosure),
      createdByUserId: input.createdByUserId ?? null,
    },
  });
}

const PRIOR_DISCLOSURE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["TENDERED", "CLOSED"],
  TENDERED: ["ACKNOWLEDGED", "CLOSED"],
  ACKNOWLEDGED: ["CLOSED"],
  CLOSED: [],
};

export async function updatePriorDisclosureStatus(
  accountId: string,
  id: string,
  nextStatus: "TENDERED" | "ACKNOWLEDGED" | "CLOSED"
) {
  const existing = await db.priorDisclosure.findFirst({ where: { id, accountId } });
  if (!existing) return { ok: false as const, reason: "NOT_FOUND" as const };

  const allowed = PRIOR_DISCLOSURE_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    return { ok: false as const, reason: "INVALID_TRANSITION" as const, from: existing.status };
  }

  const updated = await db.priorDisclosure.update({
    where: { id },
    data: {
      status: nextStatus,
      ...(nextStatus === "TENDERED" ? { disclosedAt: new Date() } : {}),
    },
  });
  return { ok: true as const, disclosure: updated };
}

export async function listPriorDisclosures(accountId: string, status?: string) {
  return db.priorDisclosure.findMany({
    where: { accountId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getPriorDisclosure(accountId: string, id: string) {
  return db.priorDisclosure.findFirst({ where: { id, accountId } });
}
