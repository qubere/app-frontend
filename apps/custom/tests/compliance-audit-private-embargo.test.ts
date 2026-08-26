import { describe, it, expect, vi, beforeEach } from "vitest";

// complianceAuditAgent.ts: PRIVATE_EMBARGO hits must be mapped to a distinct
// category/ruleName/details from public COUNTRY_EMBARGO hits, and must never
// be presented as a government sanction. Sibling screening modules are
// mocked to reject (caught internally as "did not run") so this test
// isolates the country-embargo hit-mapping branch.

const runCountryEmbargoScreening = vi.fn();

vi.mock("@/modules/agents/compliance/embargo/countryEmbargoScreening", () => ({ runCountryEmbargoScreening }));
vi.mock("@/modules/agents/compliance/embargo/embargoRepository", () => ({
  getAccountEmbargoConfig: vi.fn().mockResolvedValue({
    embargoScreeningEnabled: true,
    privateEmbargoEnabled: true,
    serverScreeningEnabled: true,
    genericExportLdEnabled: false,
    audited: false,
    emailAlertEnabled: false,
    generalAuditLogEnabled: false,
  }),
}));
vi.mock("@/modules/agents/compliance/forcedLabor/forcedLaborScreening", () => ({
  runForcedLaborScreening: vi.fn().mockRejectedValue(new Error("not under test")),
}));
vi.mock("@/modules/agents/compliance/endUse/endUseScreening", () => ({
  runEndUseScreening: vi.fn().mockRejectedValue(new Error("not under test")),
}));
vi.mock("@/modules/agents/compliance/endUser/endUserScreening", () => ({
  runEndUserScreening: vi.fn().mockRejectedValue(new Error("not under test")),
}));
vi.mock("@/modules/agents/compliance/antiBoycott/antiBoycottScreening", () => ({
  runAntiBoycottScreening: vi.fn().mockRejectedValue(new Error("not under test")),
}));
vi.mock("@/modules/agents/compliance/militaryEndUse/militaryEndUseScreening", () => ({
  runMilitaryEndUseScreening: vi.fn().mockRejectedValue(new Error("not under test")),
}));
vi.mock("@/modules/agents/compliance/restrictedParty/shipmentScreening", () => ({
  runRestrictedPartyScreeningForShipment: vi.fn().mockRejectedValue(new Error("not under test")),
}));
vi.mock("@/lib/db", () => ({
  db: {
    agentDecision: { create: vi.fn().mockResolvedValue({ id: "dec_1" }) },
    embargoRule: { findMany: vi.fn().mockResolvedValue([]) },
    tradeBenchmark: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(), AuditAction: {} }));
vi.mock("@/lib/ai/aiMeter", () => ({ meterGeminiCall: vi.fn() }));
vi.mock("@/lib/ai/aiModel", () => ({ aiModel: "test-model" }));
vi.mock("@/lib/ai/promptVersion", () => ({ hashPromptVersion: vi.fn(() => "v1") }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {},
  Type: {},
  Schema: {},
}));

const { ComplianceAuditAgent } = await import("@/modules/agents/complianceAuditAgent");

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    accountId: "acct_1",
    userId: "user_1",
    shipmentId: "ship_1",
    lineItems: [{ lineNumber: 1, htsCode: "8481.80.5090", countryOfOrigin: "CN" }],
    shipFromCountry: "CN",
    destinationCountry: "IR",
    ...overrides,
  };
}

function countryHit(overrides: Record<string, unknown> = {}) {
  return {
    screeningLevel: "TRANSACTION",
    type: "D",
    complianceCountry: "CN",
    country: "IR",
    matcher: "GENERIC",
    ruleId: "cc_1",
    lineItemId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ComplianceAuditAgent private embargo hit mapping", () => {
  it("labels a PRIVATE matcher hit as PRIVATE_EMBARGO with a private-rule ruleId and non-sanction wording", async () => {
    runCountryEmbargoScreening.mockResolvedValue({
      status: "COMPLETED",
      hits: [countryHit({ matcher: "PRIVATE", ruleId: "rule_1" })],
      skippedChecks: [],
      errors: [],
    });

    const res = await ComplianceAuditAgent.execute(baseInput());

    const privateFinding = res.auditResults.find((r) => r.category === "PRIVATE_EMBARGO");
    expect(privateFinding).toBeDefined();
    expect(privateFinding?.ruleId).toBe("RULE-PRIVATE-EMBARGO-rule_1");
    expect(privateFinding?.ruleName).toBe("Private Embargo Screening");
    expect(privateFinding?.details).toContain("not a government sanction");
    expect(res.auditResults.some((r) => r.category === "COUNTRY_EMBARGO")).toBe(false);
  });

  it("labels a non-PRIVATE matcher hit as COUNTRY_EMBARGO without private wording", async () => {
    runCountryEmbargoScreening.mockResolvedValue({
      status: "COMPLETED",
      hits: [countryHit({ matcher: "GENERIC", ruleId: "cc_1" })],
      skippedChecks: [],
      errors: [],
    });

    const res = await ComplianceAuditAgent.execute(baseInput());

    const publicFinding = res.auditResults.find((r) => r.category === "COUNTRY_EMBARGO");
    expect(publicFinding).toBeDefined();
    expect(publicFinding?.ruleId).toBe("RULE-COUNTRY-EMBARGO-cc_1");
    expect(publicFinding?.ruleName).toBe("Country Embargo Screening");
    expect(publicFinding?.details).not.toContain("private");
    expect(res.auditResults.some((r) => r.category === "PRIVATE_EMBARGO")).toBe(false);
  });

  it("labels both categories distinctly when a private and a public hit occur together", async () => {
    runCountryEmbargoScreening.mockResolvedValue({
      status: "COMPLETED",
      hits: [
        countryHit({ matcher: "PRIVATE", ruleId: "rule_1", country: "IR" }),
        countryHit({ matcher: "STANDARD", ruleId: "cc_2", country: "KP" }),
      ],
      skippedChecks: [],
      errors: [],
    });

    const res = await ComplianceAuditAgent.execute(baseInput());

    expect(res.auditResults.filter((r) => r.category === "PRIVATE_EMBARGO")).toHaveLength(1);
    expect(res.auditResults.filter((r) => r.category === "COUNTRY_EMBARGO")).toHaveLength(1);
  });
});
