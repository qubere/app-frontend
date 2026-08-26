import { describe, it, expect, vi, beforeEach } from "vitest";

// complianceAuditAgent.ts: RULE-RESTRICTED-PARTY-02 presents already-computed
// preApprovedReuses evidence from the shared RPS shipment-screening result.
// The agent must never compute or infer pre-approval itself, and the finding
// must never claim "no current watchlist match exists" for a party whose
// local matcher was skipped via reuse.

const runRestrictedPartyScreeningForShipment = vi.fn();

vi.mock("@/modules/agents/compliance/restrictedParty/shipmentScreening", () => ({
  runRestrictedPartyScreeningForShipment,
}));
vi.mock("@/modules/agents/compliance/embargo/countryEmbargoScreening", () => ({
  runCountryEmbargoScreening: vi.fn().mockRejectedValue(new Error("not under test")),
}));
vi.mock("@/modules/agents/compliance/embargo/embargoRepository", () => ({
  getAccountEmbargoConfig: vi.fn().mockResolvedValue({
    embargoScreeningEnabled: false,
    privateEmbargoEnabled: false,
    serverScreeningEnabled: false,
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

function reuse(overrides: Record<string, unknown> = {}) {
  return {
    role: "Consignee",
    partyName: "Acme Trading Co",
    partyId: "party_1",
    approvalId: "approval_1",
    screeningDisposition: "PRE_APPROVED",
    executionMode: "PRE_APPROVED_REUSE",
    localMatcherExecuted: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ComplianceAuditAgent RULE-RESTRICTED-PARTY-02: pre-approved reuse presentation", () => {
  it("adds one informational (passed=true) finding per reused party, naming the approval reused", async () => {
    runRestrictedPartyScreeningForShipment.mockResolvedValue({
      status: "CLEAR",
      hits: [],
      redFlagHits: [],
      errors: [],
      skipped: [],
      partiesScreened: 1,
      preApprovedReuses: [reuse()],
    });

    const res = await ComplianceAuditAgent.execute(baseInput());

    const finding = res.auditResults.find((r) => r.ruleId === "RULE-RESTRICTED-PARTY-02");
    expect(finding).toBeDefined();
    expect(finding?.passed).toBe(true);
    expect(finding?.severity).toBe("LOW");
    expect(finding?.category).toBe("RESTRICTED_PARTY");
    expect(finding?.details).toContain("approval_1");
    expect(finding?.details).toContain("Acme Trading Co");
  });

  it("never claims a fresh watchlist check ran or that no current match exists for a reused party", async () => {
    runRestrictedPartyScreeningForShipment.mockResolvedValue({
      status: "CLEAR",
      hits: [],
      redFlagHits: [],
      errors: [],
      skipped: [],
      partiesScreened: 1,
      preApprovedReuses: [reuse()],
    });

    const res = await ComplianceAuditAgent.execute(baseInput());

    const finding = res.auditResults.find((r) => r.ruleId === "RULE-RESTRICTED-PARTY-02");
    // The finding must explicitly disclaim a fresh-match assertion, not assert one.
    expect(finding?.details).toMatch(/does not assert that no current watchlist match exists/i);
    expect(finding?.details?.toLowerCase()).toContain("not re-screened");
    expect(finding?.details?.toLowerCase()).not.toContain("cleared the watchlist");
  });

  it("adds no finding at all when no party was reused (nothing to disclose)", async () => {
    runRestrictedPartyScreeningForShipment.mockResolvedValue({
      status: "CLEAR",
      hits: [],
      redFlagHits: [],
      errors: [],
      skipped: [],
      partiesScreened: 1,
      preApprovedReuses: [],
    });

    const res = await ComplianceAuditAgent.execute(baseInput());

    expect(res.auditResults.some((r) => r.ruleId === "RULE-RESTRICTED-PARTY-02")).toBe(false);
  });

  it("adds one finding per reused party when multiple parties on the shipment were reused", async () => {
    runRestrictedPartyScreeningForShipment.mockResolvedValue({
      status: "CLEAR",
      hits: [],
      redFlagHits: [],
      errors: [],
      skipped: [],
      partiesScreened: 2,
      preApprovedReuses: [
        reuse({ role: "Consignee", partyId: "party_1", approvalId: "approval_1" }),
        reuse({ role: "Shipper", partyId: "party_2", approvalId: "approval_2", partyName: "Other Corp" }),
      ],
    });

    const res = await ComplianceAuditAgent.execute(baseInput());

    expect(res.auditResults.filter((r) => r.ruleId === "RULE-RESTRICTED-PARTY-02")).toHaveLength(2);
  });
});
