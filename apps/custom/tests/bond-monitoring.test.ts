import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BondMonitoringService } from "../src/modules/onboarding/bondMonitoring.service";
import { requiredContinuousBondAmount } from "../src/modules/onboarding/bondSufficiency";
import { db } from "../src/lib/db";
import { Decimal } from "../src/lib/tariff/decimal";

describe("Bond Sufficiency & Expiration Monitoring (#174)", () => {
  const testAccountId = "test-account-bond-monitoring";
  let testBondId: string;

  beforeEach(async () => {
    // Create test account with required slug field
    await db.account.upsert({
      where: { id: testAccountId },
      update: {},
      create: {
        id: testAccountId,
        name: "Test Import/Export Corp",
        slug: "test-import-export-corp-bond-monitoring",
      },
    });

    // Clean up existing bonds & filings for test account
    await db.customsFiling.deleteMany({ where: { accountId: testAccountId } });
    await db.bond.deleteMany({ where: { accountId: testAccountId } });

    // Seed continuous bond of $50,000
    const bond = await db.bond.create({
      data: {
        accountId: testAccountId,
        bondType: "continuous",
        suretyName: "Great American Insurance Company",
        suretyCode: "084",
        bondNumber: "BOND-TEST-174-001",
        bondAmount: new Decimal(50000),
        status: "verified",
        effectiveDate: new Date("2024-01-01"),
      },
    });
    testBondId = bond.id;
  });

  afterEach(async () => {
    await db.customsFiling.deleteMany({ where: { accountId: testAccountId } });
    await db.bond.deleteMany({ where: { accountId: testAccountId } });
  });

  it("should compute continuous bond formula accurately per 19 CFR 113", () => {
    // Formula rule: 10% of prior 12-month duty/tax/fees, rounded UP to next $10k (< $100k) or next $100k (>= $100k), min $50k.
    expect(requiredContinuousBondAmount(new Decimal(200000)).toString()).toBe("50000"); // 10% = 20k -> min 50k
    expect(requiredContinuousBondAmount(new Decimal(750000)).toString()).toBe("80000"); // 10% = 75k -> ceil 10k = 80k
    expect(requiredContinuousBondAmount(new Decimal(1500000)).toString()).toBe("200000"); // 10% = 150k -> ceil 100k = 200k
  });

  it("should detect continuous bond shortfall and update status to insufficient", async () => {
    const entryNum = `TEST-800K-${Date.now()}`;
    // Seed a CustomsFiling with $800,000 in duties (requires $80,000 bond, actual bond is $50,000)
    await db.customsFiling.create({
      data: {
        accountId: testAccountId,
        entryNumber: entryNum,
        filingType: "ENTRY_SUMMARY",
        filingStatus: "RELEASED",
        entryType: "01",
        country: "US",
        grandTotalDutyAmount: new Decimal(800000),
        updatedAt: new Date(),
      },
    });

    const res = await BondMonitoringService.checkBondSufficiencyForAccount(testAccountId);

    expect(res.sufficiency.sufficient).toBe(false);
    expect(res.sufficiency.requiredAmount.toString()).toBe("80000");
    expect(res.sufficiency.shortfall?.toString()).toBe("30000");
    expect(res.statusUpdated).toBe(true);

    const updatedBond = await db.bond.findUnique({ where: { id: testBondId } });
    expect(updatedBond?.status).toBe("insufficient");
  });

  it("should recommend STB stacking or continuous bond rider based on liability", async () => {
    // Projected duty liability of $300,000 (10% = 30k -> min 50k bond required, actual = 50k)
    const noStacking = await BondMonitoringService.checkBondStacking(testAccountId, 300000);
    expect(noStacking.stackingRequired).toBe(false);

    // Projected duty liability of $1,500,000 (requires $200,000 continuous bond, actual = 50k, shortfall = 150k)
    const stackingReq = await BondMonitoringService.checkBondStacking(testAccountId, 1500000);
    expect(stackingReq.stackingRequired).toBe(true);
    expect(stackingReq.shortfallAmount?.toString()).toBe("150000");
    expect(stackingReq.recommendationType).toBe("CONTINUOUS_RIDER");
  });

  it("should sweep expired bonds and update bond status to expired", async () => {
    // Create an expired bond
    const expiredBond = await db.bond.create({
      data: {
        accountId: testAccountId,
        bondType: "single_transaction",
        suretyName: "Hartford Fire Insurance",
        suretyCode: "042",
        bondNumber: `BOND-EXPIRED-TEST-${Date.now()}`,
        bondAmount: new Decimal(25000),
        status: "verified",
        effectiveDate: new Date("2024-01-01"),
        expirationDate: new Date("2025-01-01"), // past date
      },
    });

    const expRes = await BondMonitoringService.checkBondExpirations(30);

    expect(expRes.expiredCount).toBeGreaterThan(0);
    const match = expRes.details.find((b) => b.bondId === expiredBond.id);
    expect(match).toBeDefined();
    expect(match?.status).toBe("expired");

    const rechecked = await db.bond.findUnique({ where: { id: expiredBond.id } });
    expect(rechecked?.status).toBe("expired");

    await db.bond.delete({ where: { id: expiredBond.id } });
  });

  it("should run full bond monitoring sweep across all accounts", async () => {
    const sweep = await BondMonitoringService.runBondMonitoringSweep();

    expect(sweep.accountsChecked).toBeGreaterThan(0);
    expect(sweep.timestamp).toBeDefined();
  });
});
