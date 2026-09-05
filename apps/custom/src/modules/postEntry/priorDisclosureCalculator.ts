import { db } from "@/lib/db";

export type CbpCulpabilityLevel = "NEGLIGENCE" | "GROSS_NEGLIGENCE" | "FRAUD";

export interface PenaltyExposureInput {
  actualDutyLoss: number;
  enteredValue: number;
  culpability: CbpCulpabilityLevel;
  hasPriorDisclosure: boolean;
  interestRatePct?: number; // Default 5%
  yearsElapsed?: number; // Default 1 year
}

export interface PenaltyExposureResult {
  culpability: CbpCulpabilityLevel;
  statutoryMaxPenaltyWithoutDisclosure: number;
  disclosedTenderAmount: number;
  estimatedPenaltyWithDisclosure: number;
  savingsFromDisclosure: number;
}

/**
 * Calculates 19 U.S.C. §1592 penalty exposure and prior disclosure mitigation savings.
 */
export function calculate1592PenaltyExposure(input: PenaltyExposureInput): PenaltyExposureResult {
  const { actualDutyLoss, enteredValue, culpability, interestRatePct = 5, yearsElapsed = 1 } = input;
  const interestAmount = actualDutyLoss * (interestRatePct / 100) * yearsElapsed;

  let statutoryMax = 0;
  let penaltyWithDisclosure = 0;

  switch (culpability) {
    case "FRAUD":
      statutoryMax = enteredValue; // Up to 100% domestic value of merchandise
      penaltyWithDisclosure = actualDutyLoss * 1.0; // 100% of actual loss of duties
      break;
    case "GROSS_NEGLIGENCE":
      statutoryMax = Math.min(actualDutyLoss * 4, enteredValue * 0.4);
      penaltyWithDisclosure = interestAmount; // Interest only on actual duty loss
      break;
    case "NEGLIGENCE":
      statutoryMax = Math.min(actualDutyLoss * 2, enteredValue * 0.2);
      penaltyWithDisclosure = interestAmount; // Interest only on actual duty loss
      break;
  }

  const disclosedTender = actualDutyLoss + (culpability === "FRAUD" ? penaltyWithDisclosure : interestAmount);
  const savings = Math.max(0, statutoryMax - penaltyWithDisclosure);

  return {
    culpability,
    statutoryMaxPenaltyWithoutDisclosure: Math.round(statutoryMax * 100) / 100,
    disclosedTenderAmount: Math.round(disclosedTender * 100) / 100,
    estimatedPenaltyWithDisclosure: Math.round(penaltyWithDisclosure * 100) / 100,
    savingsFromDisclosure: Math.round(savings * 100) / 100,
  };
}

/**
 * Records a prior disclosure entry for post-entry compliance tracking.
 */
export async function recordPriorDisclosureEntry(input: {
  accountId: string;
  filingId?: string | null;
  entryNumber?: string | null;
  description: string;
  culpability: CbpCulpabilityLevel;
  actualDutyLoss: number;
  enteredValue: number;
  tenderAmount: number;
  createdByUserId: string;
}) {
  const exposure = calculate1592PenaltyExposure({
    actualDutyLoss: input.actualDutyLoss,
    enteredValue: input.enteredValue,
    culpability: input.culpability,
    hasPriorDisclosure: true,
  });

  return {
    accountId: input.accountId,
    filingId: input.filingId,
    entryNumber: input.entryNumber,
    description: input.description,
    exposure,
    recordedAt: new Date().toISOString(),
  };
}
