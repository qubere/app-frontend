import { describe, it, expect } from "vitest";
import {
  calculateIsfFilingDeadline,
  validateIsfTransaction,
  type Isf10Plus2Elements,
} from "@/modules/isf/isfTransactionService";
import { calculate1592PenaltyExposure } from "@/modules/postEntry/priorDisclosureCalculator";
import { calculateCbpReconciliationDeadline } from "@/modules/reconciliation/cbpReconciliationService";
import {
  calculatePmsPaymentDeadline,
  calculateDailyStatementDeadline,
  paymentDeadlineFor,
} from "@/modules/payments/achDutyPaymentService";

describe("ISF 10+2 deadline + validation", () => {
  it("puts the filing deadline exactly 24h before lading", () => {
    const r = calculateIsfFilingDeadline("2026-06-10T12:00:00.000Z", "2026-06-08T00:00:00.000Z");
    expect(r.isfFilingDeadline).toBe("2026-06-09T12:00:00.000Z");
    expect(r.isLate).toBe(false);
    expect(r.hoursUntilDeadline).toBeCloseTo(36, 0);
    expect(r.potentialLiquidatedDamagesPenalty).toBe(0);
  });

  it("flags a late filing with a $5,000 exposure", () => {
    const r = calculateIsfFilingDeadline("2026-06-10T12:00:00.000Z", "2026-06-10T00:00:00.000Z");
    expect(r.isLate).toBe(true);
    expect(r.potentialLiquidatedDamagesPenalty).toBe(5000);
  });

  it("requires all 8 importer elements and a bond", () => {
    const complete: Isf10Plus2Elements = {
      sellerNameAddress: "s",
      buyerNameAddress: "b",
      importerOfRecordNumber: "12-3456789",
      consigneeNumber: "12-3456789",
      manufacturerNameAddress: "m",
      shipToPartyNameAddress: "w",
      countryOfOrigin: "CN",
      commodityHtsNumber: "8471.30.0100",
    };
    expect(validateIsfTransaction(complete, true).valid).toBe(true);
    expect(validateIsfTransaction(complete, false).valid).toBe(false);
    const missing = validateIsfTransaction({ sellerNameAddress: "s" }, true);
    expect(missing.valid).toBe(false);
    expect(missing.missingElements).toContain("commodityHtsNumber");
  });
});

describe("19 U.S.C. §1592 penalty exposure", () => {
  it("caps a negligence penalty at interest with a valid disclosure", () => {
    const r = calculate1592PenaltyExposure({
      actualDutyLoss: 100_000,
      enteredValue: 2_000_000,
      culpability: "NEGLIGENCE",
      interestRatePct: 5,
      yearsElapsed: 2,
    });
    // Statutory max: lesser of 2x loss (200k) or 20% value (400k) => 200k
    expect(r.statutoryMaxPenaltyWithoutDisclosure).toBe(200_000);
    // Penalty with disclosure: interest only = 100k * 5% * 2 = 10k
    expect(r.estimatedPenaltyWithDisclosure).toBe(10_000);
    expect(r.disclosedTenderAmount).toBe(110_000);
    expect(r.savingsFromDisclosure).toBe(190_000);
  });

  it("uses domestic value for fraud and 100% of the loss as the mitigated penalty", () => {
    const r = calculate1592PenaltyExposure({
      actualDutyLoss: 50_000,
      enteredValue: 750_000,
      culpability: "FRAUD",
    });
    expect(r.statutoryMaxPenaltyWithoutDisclosure).toBe(750_000);
    expect(r.estimatedPenaltyWithDisclosure).toBe(50_000);
    expect(r.disclosedTenderAmount).toBe(100_000);
  });

  it("caps gross negligence at the lesser of 4x loss or 40% of value", () => {
    const r = calculate1592PenaltyExposure({
      actualDutyLoss: 100_000,
      enteredValue: 500_000,
      culpability: "GROSS_NEGLIGENCE",
    });
    // min(400k, 200k) => 200k
    expect(r.statutoryMaxPenaltyWithoutDisclosure).toBe(200_000);
  });
});

describe("CBP reconciliation deadline", () => {
  it("is 21 months from the underlying entry date", () => {
    const d = calculateCbpReconciliationDeadline("2026-01-15T00:00:00.000Z");
    expect(d.getUTCFullYear()).toBe(2027);
    expect(d.getUTCMonth()).toBe(9); // October (0-indexed)
    expect(d.getUTCDate()).toBe(15);
  });
});

describe("duty statement payment deadlines", () => {
  it("PMS deadline is the 15th working day of the following month", () => {
    // Entry month 2026-03 -> following month April 2026.
    // April 2026: 1st is Wed. Working days: Apr 1,2,3 (3), 6-10 (8), 13-17 (13),
    // 20,21 (15) -> April 21, 2026.
    const d = calculatePmsPaymentDeadline("2026-03");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(3); // April
    expect(d.getUTCDate()).toBe(21);
    expect([1, 2, 3, 4, 5]).toContain(d.getUTCDay());
  });

  it("rolls December entries into the next year", () => {
    const d = calculatePmsPaymentDeadline("2026-12");
    expect(d.getUTCFullYear()).toBe(2027);
    expect(d.getUTCMonth()).toBe(0); // January
  });

  it("daily statement deadline is the next business day", () => {
    // 2026-06-12 is a Friday -> next business day is Monday 2026-06-15.
    const d = calculateDailyStatementDeadline("2026-06-12T00:00:00.000Z");
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCDay()).toBe(1);
  });

  it("paymentDeadlineFor dispatches on statement type", () => {
    const pms = paymentDeadlineFor("PERIODIC_MONTHLY", "2026-03-31T00:00:00.000Z");
    const daily = paymentDeadlineFor("DAILY", "2026-06-12T00:00:00.000Z");
    expect(pms.getUTCMonth()).toBe(3);
    expect(daily.getUTCDate()).toBe(15);
  });
});
