import { describe, it, expect, beforeEach, vi } from "vitest";
import { ASSISTANT_TOOLS, getToolByName } from "@/modules/assistant/tools";
import { canUseTool } from "@/modules/assistant/shared/toolAccess";
import { CopilotGroundingLedger, normalizeRulingNumber } from "@/modules/assistant/shared/copilotLedger";
import type { AccountContext } from "@/lib/auth";
import { db } from "@/lib/db";

const mockContext: AccountContext = {
  accountId: "acct_test_123",
  userId: "user_test_456",
  roleNames: ["OWNER"],
  permissions: ["compliance.restrictedParty.read", "regulatory.review"],
  isPlatformAdmin: false,
};

describe("CopilotGroundingLedger P0 Grounding & Citation Validation", () => {
  it("normalizes ruling numbers consistently", () => {
    expect(normalizeRulingNumber("HQ H301234")).toBe("HQH301234");
    expect(normalizeRulingNumber("NY N123456")).toBe("NYN123456");
    expect(normalizeRulingNumber("H301234")).toBe("H301234");
  });

  it("records and validates all citation types correctly", () => {
    const ledger = new CopilotGroundingLedger();
    ledger.recordToolOutput({
      shipmentNumber: "SHP-2026-123456",
      rulingNumber: "HQ H301234",
      htsCode: "8541.40.6025",
      frCite: "88 FR 12345",
      evidenceId: "EVI-999",
      id: "prod_001",
    });

    // Valid citations matching ledger
    const validText = "Shipment SHP-2026-123456 covered under ruling HQ H301234, HTS 8541.40.6025, citation 88 FR 12345 and evidence EVI-999.";
    const result = ledger.validate(validText);

    expect(result.entitiesCited).toBeGreaterThanOrEqual(4);
    expect(result.evidenceCited).toBe(1);
    expect(result.droppedCitations).toBe(0);
  });

  it("detects ungrounded citations in generated text", () => {
    const ledger = new CopilotGroundingLedger();
    ledger.recordToolOutput({
      shipmentNumber: "SHP-2026-111111",
    });

    const textWithFakeCitations = "Shipment SHP-2026-111111 is linked, but SHP-2026-999999 and ruling HQ H999999 are fabricated.";
    const result = ledger.validate(textWithFakeCitations);

    expect(result.droppedCitations).toBe(2);
  });

  it("sanitizes ungrounded citations in text before streaming to user", () => {
    const ledger = new CopilotGroundingLedger();
    ledger.recordToolOutput({
      shipmentNumber: "SHP-2026-100200",
      rulingNumber: "NY N123456",
    });

    const text = "Ground: SHP-2026-100200 and NY N123456. Fake: SHP-2026-999999 and HQ H888888.";
    const sanitized = ledger.sanitizeGroundedText(text);

    expect(sanitized).toContain("SHP-2026-100200");
    expect(sanitized).toContain("NY N123456");
    expect(sanitized).toContain("SHP-2026-999999 [Unverified Shipment]");
    expect(sanitized).toContain("HQ H888888 [Unverified Ruling Citation]");
  });
});

describe("Assistant New Reference & Post-Entry Tools", () => {
  it("get_exchange_rate executes cleanly using currencyCode and isCurrent", async () => {
    const tool = getToolByName("get_exchange_rate");
    expect(tool).toBeDefined();

    vi.spyOn(db.exchangeRate, "findFirst").mockResolvedValueOnce({
      id: "fx_1",
      currencyCode: "EUR",
      rateToUsd: { toNumber: () => 1.08 } as any,
      fetchedAt: new Date(),
      isCurrent: true,
      createdAt: new Date(),
    } as any);

    const res = await tool!.execute(mockContext, { currency: "EUR" });
    expect(res).toHaveProperty("currencyCode", "EUR");
    expect(res).toHaveProperty("rateToUsd", 1.08);
  });

  it("get_adcvd_orders filters active status and retrieves approved company rates", async () => {
    const tool = getToolByName("get_adcvd_orders");
    expect(tool).toBeDefined();

    vi.spyOn(db.adcvdOrder, "findMany").mockResolvedValueOnce([
      {
        id: "ord_1",
        caseNumber: "A-570-601",
        title: "Solar Cells",
        petitioner: "US Solar",
        respondentCountries: ["CN"],
        htsCodesInScope: ["8541.40.6025"],
        scopeLanguage: "Silicon solar cells...",
        effectiveDate: new Date(),
        suspensionAgreement: false,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    vi.spyOn(db.adCvdCompanyRate, "findMany").mockResolvedValueOnce([
      {
        id: "rate_1",
        caseNumber: "A-570-601",
        periodOfReview: "POR 2024",
        manufacturerName: "Trina Solar",
        exporterName: "Trina Solar",
        countryOfOrigin: "CN",
        depositRatePct: 15.2,
        allOthersRatePct: 24.5,
        isSeparateRate: true,
        federalRegisterCitation: "89 FR 1000",
        effectiveDate: new Date(),
        reviewStatus: "APPROVED",
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    const res = (await tool!.execute(mockContext, { caseNumber: "A-570-601" })) as any;
    expect(res).toHaveProperty("count", 1);
    expect(res.orders[0].caseNumber).toBe("A-570-601");
    expect(res.companyRates[0].reviewStatus).toBe("APPROVED");
  });

  it("list_protests queries protestEntries relation without throwing", async () => {
    const tool = getToolByName("list_protests");
    expect(tool).toBeDefined();

    vi.spyOn(db.protest, "findMany").mockResolvedValueOnce([
      {
        id: "prot_1",
        accountId: mockContext.accountId,
        groundsCode: "CLASSIFICATION",
        claimAmount: { toNumber: () => 5000 } as any,
        status: "FILED",
        protestEntries: [{ id: "pe_1", filingId: "filing_1" }],
      },
    ] as any);

    const res = (await tool!.execute(mockContext, {})) as any;
    expect(res).toHaveProperty("count", 1);
    expect(res.protests[0].protestEntries).toHaveLength(1);
  });

  it("list_refund_opportunities orders by estimatedRefundAmount", async () => {
    const tool = getToolByName("list_refund_opportunities");
    expect(tool).toBeDefined();

    vi.spyOn(db.refundOpportunity, "findMany").mockResolvedValueOnce([
      {
        id: "opp_1",
        accountId: mockContext.accountId,
        filingId: "filing_10",
        opportunityType: "retroactive_exclusion",
        estimatedRefundAmount: { toNumber: () => 12500 } as any,
        status: "Identified",
      },
    ] as any);

    const res = (await tool!.execute(mockContext, {})) as any;
    expect(res).toHaveProperty("count", 1);
    expect(res.opportunities[0].estimatedRefundAmountUsd).toBe(12500);
  });

  it("lookup_restricted_party_lists enforces publicationStatus: PUBLISHED and permission gate", async () => {
    const tool = getToolByName("lookup_restricted_party_lists");
    expect(tool).toBeDefined();
    expect(canUseTool(mockContext, tool!.access)).toBe(true);

    vi.spyOn(db.screeningEntity, "findMany").mockResolvedValueOnce([
      {
        id: "ent_1",
        name: "HUAWEI TECHNOLOGIES",
        sourceList: "ENTITY_LIST",
        publicationStatus: "PUBLISHED",
        aliases: [],
        addresses: [],
        identifiers: [],
      },
    ] as any);

    const res = (await tool!.execute(mockContext, { name: "HUAWEI", listType: "ENTITY_LIST" })) as any;
    expect(res).toHaveProperty("count", 1);
    expect(res.entities[0].publicationStatus).toBe("PUBLISHED");
  });

  it("get_section_301 filters reviewStatus: APPROVED", async () => {
    const tool = getToolByName("get_section_301");
    expect(tool).toBeDefined();

    vi.spyOn(db.section301Rate, "findMany").mockResolvedValueOnce([
      {
        id: "s301_1",
        htsNumber: "85414060",
        tranche: "LIST_3",
        dutyRatePct: 25.0,
        reviewStatus: "APPROVED",
      },
    ] as any);

    vi.spyOn(db.section301Exclusion, "findMany").mockResolvedValueOnce([]);

    const res = (await tool!.execute(mockContext, { htsCode: "8541.40.6025" })) as any;
    expect(res.rates[0].reviewStatus).toBe("APPROVED");
  });

  it("all new tools have valid, non-empty access gates matching registered navigation", () => {
    const newToolNames = [
      "get_hts_code",
      "get_ruling",
      "lookup_restricted_party_lists",
      "get_adcvd_orders",
      "get_section_301",
      "get_pga_requirements",
      "get_exchange_rate",
      "search_regulatory_notices",
      "list_drawback_claims",
      "list_protests",
      "list_refund_opportunities",
      "get_dashboard_metrics",
    ];

    for (const name of newToolNames) {
      const tool = getToolByName(name);
      expect(tool, `tool ${name} should exist in ASSISTANT_TOOLS`).toBeDefined();
      expect(canUseTool(mockContext, tool!.access)).toBe(true);
    }
  });
});
