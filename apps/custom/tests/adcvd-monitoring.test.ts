import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AdcvdMonitoringService } from "../src/modules/adcvd/adcvdMonitoring.service";
import { listPendingRateReviews, reviewRate } from "../src/modules/tradeRate/tradeRateReviewService";
import { db } from "../src/lib/db";

describe("AD/CVD Continuous Case Monitoring & Rate Refresh (#169)", () => {
  const testCaseNumber = "A-570-888-TEST";
  const testManufacturer = "Test Solar Tech Co., Ltd.";
  const testAccountId = "test-adcvd-account-id";

  beforeEach(async () => {
    // Seed test account for audit log foreign keys
    await db.account.upsert({
      where: { id: testAccountId },
      update: {},
      create: {
        id: testAccountId,
        name: "Test Platform Admin Account",
        slug: "test-platform-admin-account-adcvd",
      },
    });

    // Cleanup any prior test records
    await db.adCvdCompanyRate.deleteMany({ where: { caseNumber: testCaseNumber } });
    await db.adcvdOrder.deleteMany({ where: { caseNumber: testCaseNumber } });

    // Seed test AdcvdOrder
    await db.adcvdOrder.create({
      data: {
        caseNumber: testCaseNumber,
        title: "Test Crystalline Silicon Photovoltaic Cells from China",
        petitioner: "Solar World Industries",
        respondentCountries: ["CN"],
        htsCodesInScope: ["8541.40.6025"],
        scopeLanguage: "Test scope description for AD/CVD case A-570-888",
        effectiveDate: new Date("2024-01-01"),
        status: "ACTIVE",
      },
    });
  });

  afterEach(async () => {
    await db.adCvdCompanyRate.deleteMany({ where: { caseNumber: testCaseNumber } });
    await db.adcvdOrder.deleteMany({ where: { caseNumber: testCaseNumber } });
  });

  it("should update AD/CVD case status and maintain history", async () => {
    const syncRes = await AdcvdMonitoringService.syncAdcvdCaseStatuses(
      [
        {
          caseNumber: testCaseNumber,
          status: "REVOKED",
          effectiveDate: new Date("2026-06-01"),
          reason: "Sunset review revocation determination",
          citation: "91 FR 12345",
        },
      ],
      testAccountId
    );

    expect(syncRes.updatedCount).toBe(1);
    expect(syncRes.details[0].oldStatus).toBe("ACTIVE");
    expect(syncRes.details[0].newStatus).toBe("REVOKED");

    const updatedOrder = await db.adcvdOrder.findUnique({
      where: { caseNumber: testCaseNumber },
    });
    expect(updatedOrder?.status).toBe("REVOKED");
  });

  it("should stage updated company rates as PENDING for platform admin review", async () => {
    const stagedRate = await AdcvdMonitoringService.stageAdcvdCompanyRateUpdate(
      {
        caseNumber: testCaseNumber,
        manufacturerName: testManufacturer,
        countryOfOrigin: "CN",
        periodOfReview: "POR 2025",
        depositRatePct: 15.75,
        allOthersRatePct: 23.8,
        isSeparateRate: true,
        federalRegisterCitation: "91 FR 54321",
      },
      testAccountId
    );

    expect(stagedRate.reviewStatus).toBe("PENDING");
    expect(stagedRate.depositRatePct).toBe(15.75);

    // Verify rate appears in pending rate review queue
    const pendingReviews = await listPendingRateReviews();
    const matches = pendingReviews.filter(
      (r) => r.type === "ADCVD_COMPANY_RATE" && r.id === stagedRate.id
    );
    expect(matches.length).toBe(1);
    expect(matches[0].headline).toContain(testCaseNumber);
    expect(matches[0].headline).toContain(testManufacturer);
  });

  it("should allow platform admin to approve staged AD/CVD company rate", async () => {
    const stagedRate = await AdcvdMonitoringService.stageAdcvdCompanyRateUpdate(
      {
        caseNumber: testCaseNumber,
        manufacturerName: testManufacturer,
        countryOfOrigin: "CN",
        periodOfReview: "POR 2025",
        depositRatePct: 12.5,
      },
      testAccountId
    );

    // Simulate platform admin approving rate
    const approved = await reviewRate(
      { accountId: testAccountId, userId: null },
      "ADCVD_COMPANY_RATE",
      stagedRate.id,
      "APPROVE",
      "Approved after verifying Federal Register notice 91 FR 54321"
    );

    expect(approved.reviewStatus).toBe("APPROVED");
    expect(approved.approvedAt).not.toBeNull();
  });

  it("should run full monitoring sweep successfully", async () => {
    const sweepRes = await AdcvdMonitoringService.runAdcvdMonitoringSweep();

    expect(sweepRes.ordersChecked).toBeGreaterThan(0);
    expect(sweepRes.timestamp).toBeDefined();
  });
});
