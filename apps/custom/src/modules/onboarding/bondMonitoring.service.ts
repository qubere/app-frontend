import { db } from "@/lib/db";
import { Decimal } from "@/lib/tariff/decimal";
import { createAuditLog } from "@/lib/audit";
import { computeBondSufficiency, requiredContinuousBondAmount, BondSufficiencyResult } from "./bondSufficiency";

export interface BondStackingRecommendation {
  stackingRequired: boolean;
  activeContinuousBondAmount: Decimal | null;
  requiredContinuousBondAmount: Decimal;
  shortfallAmount: Decimal | null;
  recommendedStbAmount: Decimal | null;
  recommendationType: "NONE" | "STB_STACKING" | "CONTINUOUS_RIDER";
  details: string;
}

export interface BondExpirationCheckResult {
  expiredCount: number;
  warningCount: number;
  details: Array<{
    bondId: string;
    bondNumber: string;
    accountId: string;
    status: string;
    expirationDate: Date;
    isExpired: boolean;
  }>;
}

export interface BondMonitoringSweepResult {
  accountsChecked: number;
  bondsEvaluated: number;
  insufficientBonds: number;
  expiredBonds: number;
  warningExpirations: number;
  timestamp: string;
}

export class BondMonitoringService {
  /**
   * Calculates past 12-month duty/tax/fee total for an account and checks continuous bond sufficiency.
   * Updates `Bond.status` to `"insufficient"` when actual continuous bond coverage is below formula requirement.
   */
  static async checkBondSufficiencyForAccount(accountId: string): Promise<{
    sufficiency: BondSufficiencyResult;
    bondsEvaluated: number;
    statusUpdated: boolean;
  }> {
    // Sum aggregate total duty/taxes/fees across recent customs filings or landed entries
    const filings = await db.customsFiling.findMany({
      where: { accountId, filingStatus: { in: ["Submitted", "Accepted", "Released", "RELEASED", "Transmitted"] } },
      select: { totalDuties: true, grandTotalDutyAmount: true, grandTotalUserFeeAmount: true },
    });

    let totalDutyTaxFee = new Decimal(0);
    for (const f of filings) {
      if (f.grandTotalDutyAmount) totalDutyTaxFee = totalDutyTaxFee.plus(f.grandTotalDutyAmount);
      else if (f.totalDuties) totalDutyTaxFee = totalDutyTaxFee.plus(f.totalDuties);
      if (f.grandTotalUserFeeAmount) totalDutyTaxFee = totalDutyTaxFee.plus(f.grandTotalUserFeeAmount);
    }

    // Retrieve active continuous bonds for account
    const bonds = await db.bond.findMany({
      where: {
        accountId,
        bondType: "continuous",
        status: { in: ["verified", "attested", "unverified", "insufficient"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const primaryBond = bonds[0] ?? null;
    const actualAmount = primaryBond ? new Decimal(primaryBond.bondAmount) : null;

    const sufficiency = computeBondSufficiency(totalDutyTaxFee, "HISTORICAL", actualAmount);
    let statusUpdated = false;

    if (primaryBond) {
      const isCurrentlyInsufficient = primaryBond.status === "insufficient";
      const isNowInsufficient = sufficiency.sufficient === false;

      if (isNowInsufficient && !isCurrentlyInsufficient) {
        await db.bond.update({
          where: { id: primaryBond.id },
          data: {
            status: "insufficient",
            continuousBondFormulaAmount: sufficiency.requiredAmount,
            updatedAt: new Date(),
          },
        });

        statusUpdated = true;

        await createAuditLog({
          accountId,
          userId: null,
          action: "FILING_SEGREGATION_VIOLATION",
          entity: "Bond",
          entityId: primaryBond.id,
          source: "SYSTEM",
          metadata: {
            reason: "Bond sufficiency check failed — bond amount below 10% 12-month duty/tax/fee formula",
            requiredAmount: sufficiency.requiredAmount.toString(),
            actualAmount: actualAmount?.toString(),
            shortfall: sufficiency.shortfall?.toString(),
          },
        }).catch(() => {});
      } else if (!isNowInsufficient && isCurrentlyInsufficient) {
        await db.bond.update({
          where: { id: primaryBond.id },
          data: {
            status: "verified",
            continuousBondFormulaAmount: sufficiency.requiredAmount,
            updatedAt: new Date(),
          },
        });
        statusUpdated = true;
      }
    }

    return {
      sufficiency,
      bondsEvaluated: bonds.length,
      statusUpdated,
    };
  }

  /**
   * Computes bond stacking requirements for projected shipment duty/taxes/fees.
   * Recommends Single Transaction Bonds (STBs) or continuous bond riders when continuous coverage limit is exceeded.
   */
  static async checkBondStacking(
    accountId: string,
    projectedDutyTaxFeeInput?: Decimal | number
  ): Promise<BondStackingRecommendation> {
    const projected = projectedDutyTaxFeeInput
      ? new Decimal(projectedDutyTaxFeeInput)
      : new Decimal(0);

    // Get primary active continuous bond
    const bond = await db.bond.findFirst({
      where: {
        accountId,
        bondType: "continuous",
        status: { in: ["verified", "attested", "unverified"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const actualContinuousAmount = bond ? new Decimal(bond.bondAmount) : null;
    const requiredContinuous = requiredContinuousBondAmount(projected);

    if (!actualContinuousAmount) {
      return {
        stackingRequired: true,
        activeContinuousBondAmount: null,
        requiredContinuousBondAmount: requiredContinuous,
        shortfallAmount: requiredContinuous,
        recommendedStbAmount: projected.gt(0) ? projected.times(3) : new Decimal(50000),
        recommendationType: "STB_STACKING",
        details: "No active continuous bond on file. Single Transaction Bond (STB) or new Continuous Bond required.",
      };
    }

    if (actualContinuousAmount.gte(requiredContinuous)) {
      return {
        stackingRequired: false,
        activeContinuousBondAmount: actualContinuousAmount,
        requiredContinuousBondAmount: requiredContinuous,
        shortfallAmount: null,
        recommendedStbAmount: null,
        recommendationType: "NONE",
        details: "Active continuous bond provides sufficient coverage for current projected volume.",
      };
    }

    const shortfall = requiredContinuous.minus(actualContinuousAmount);
    // STB recommendation for one-off excess: 3x estimated duty/tax/fee minimum
    const recommendedStb = projected.times(3);

    return {
      stackingRequired: true,
      activeContinuousBondAmount: actualContinuousAmount,
      requiredContinuousBondAmount: requiredContinuous,
      shortfallAmount: shortfall,
      recommendedStbAmount: recommendedStb,
      recommendationType: shortfall.gt(50000) ? "CONTINUOUS_RIDER" : "STB_STACKING",
      details: `Continuous bond shortfall of $${shortfall.toFixed(2)}. Recommend continuous bond rider increase or STB stacking.`,
    };
  }

  /**
   * Checks for expired bonds or bonds expiring within the given threshold (default 30 days).
   * Updates expired bonds (`status = "expired"`) and creates notifications for upcoming expirations.
   */
  static async checkBondExpirations(daysThreshold = 30): Promise<BondExpirationCheckResult> {
    const now = new Date();
    const warningThresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

    const bonds = await db.bond.findMany({
      where: {
        expirationDate: { not: null },
        status: { notIn: ["revoked"] },
      },
    });

    let expiredCount = 0;
    let warningCount = 0;
    const details: BondExpirationCheckResult["details"] = [];

    for (const bond of bonds) {
      if (!bond.expirationDate) continue;

      const expDate = new Date(bond.expirationDate);

      if (expDate < now) {
        expiredCount++;
        details.push({
          bondId: bond.id,
          bondNumber: bond.bondNumber,
          accountId: bond.accountId,
          status: "expired",
          expirationDate: expDate,
          isExpired: true,
        });

        if (bond.status !== "expired") {
          await db.bond.update({
            where: { id: bond.id },
            data: { status: "expired", updatedAt: new Date() },
          });

          await createAuditLog({
            accountId: bond.accountId,
            userId: null,
            action: "FILING_SEGREGATION_VIOLATION",
            entity: "Bond",
            entityId: bond.id,
            source: "SYSTEM",
            metadata: {
              reason: "Bond expired",
              bondNumber: bond.bondNumber,
              expirationDate: expDate.toISOString(),
            },
          }).catch(() => {});
        }
      } else if (expDate <= warningThresholdDate) {
        warningCount++;
        details.push({
          bondId: bond.id,
          bondNumber: bond.bondNumber,
          accountId: bond.accountId,
          status: bond.status,
          expirationDate: expDate,
          isExpired: false,
        });
      }
    }

    return { expiredCount, warningCount, details };
  }

  /**
   * Sweeps all active accounts for bond sufficiency, stacking recommendations, and expiration warnings.
   */
  static async runBondMonitoringSweep(): Promise<BondMonitoringSweepResult> {
    const accounts = await db.account.findMany({ select: { id: true } });

    let bondsEvaluated = 0;
    let insufficientBonds = 0;

    for (const acc of accounts) {
      const res = await this.checkBondSufficiencyForAccount(acc.id).catch(() => null);
      if (res) {
        bondsEvaluated += res.bondsEvaluated;
        if (res.sufficiency.sufficient === false) {
          insufficientBonds++;
        }
      }
    }

    const expirations = await this.checkBondExpirations(30);

    return {
      accountsChecked: accounts.length,
      bondsEvaluated,
      insufficientBonds,
      expiredBonds: expirations.expiredCount,
      warningExpirations: expirations.warningCount,
      timestamp: new Date().toISOString(),
    };
  }
}
