import { describe, it, expect, vi, beforeEach } from "vitest";

// Restricted / Denied-Party Screening: shipmentScreening.ts
// Covers: no shipment parties -> SKIPPED (never CLEAR), worst-of-outcomes
// aggregation across parties/passes, suppressed matches excluded from
// `hits`, red-flag hits collected independently, and errors/skips surfaced
// per party.

const getShipmentPartiesForScreening = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/restrictedPartyRepository", () => ({
  getShipmentPartiesForScreening,
}));

const runRestrictedPartyScreening = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/restrictedPartyScreening", () => ({
  runRestrictedPartyScreening,
}));

const persistScreeningRun = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/persistResult", () => ({
  persistScreeningRun,
}));

const checkPreApprovalGate = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/preApproval", () => ({
  checkPreApprovalGate,
}));

const recordComplianceExecution = vi.fn();
vi.mock("@/modules/compliance/executionHistory", () => ({
  recordComplianceExecution: (...args: unknown[]) => recordComplianceExecution(...args),
}));

const recordUsageEvent = vi.fn();
vi.mock("@/lib/billing/telemetry", () => ({
  recordUsageEvent: (...args: unknown[]) => recordUsageEvent(...args),
}));

const { runRestrictedPartyScreeningForShipment } = await import(
  "@/modules/agents/compliance/restrictedParty/shipmentScreening"
);

function shipmentParty(overrides: Record<string, unknown> = {}) {
  return {
    shipmentPartyId: "sp_1",
    role: "Consignee",
    legalEntityId: "le_1",
    partyId: "party_1",
    name: "Acme Trading Co",
    address: null,
    city: null,
    country: "US",
    contactName: null,
    ...overrides,
  };
}

function pass(overrides: Record<string, unknown> = {}) {
  return {
    passType: "PARTY_NAME",
    status: "CLEAR",
    matches: [],
    redFlagHits: [],
    errorCode: null,
    errorMessage: null,
    ...overrides,
  };
}

function match(overrides: Record<string, unknown> = {}) {
  return {
    matchedName: "Acme Trading Co",
    sourceList: "SDN",
    nameScore: 100,
    matchMethod: "EXACT",
    tier: "HIT",
    suppressedByApprovedParty: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  persistScreeningRun.mockResolvedValue([]);
  checkPreApprovalGate.mockResolvedValue({ applied: false, reason: "No active pre-approval exists for this party." });
  recordComplianceExecution.mockResolvedValue(undefined);
  recordUsageEvent.mockResolvedValue({ status: "RECORDED" });
});

describe("runRestrictedPartyScreeningForShipment: billing usage metering", () => {
  it("records an RPS_SCREENING_COMPLETED usage event per screened party with the correlation-scoped idempotency key", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([shipmentParty()]);
    runRestrictedPartyScreening.mockResolvedValue({ correlationId: "corr_1", passes: [pass({ status: "CLEAR" })] });

    await runRestrictedPartyScreeningForShipment("acct_1", "ship_1");

    expect(recordUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct_1",
        eventCode: "RPS_SCREENING_COMPLETED",
        shipmentId: "ship_1",
        quantity: 1,
        unit: "party",
        idempotencyKey: "billing:rps-shipment:corr_1",
      })
    );
  });

  it("still returns the normal screening result when recordUsageEvent rejects (billing must never affect screening outcomes)", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([shipmentParty()]);
    runRestrictedPartyScreening.mockResolvedValue({ correlationId: "corr_1", passes: [pass({ status: "CLEAR" })] });
    recordUsageEvent.mockRejectedValue(new Error("billing unavailable"));

    const result = await runRestrictedPartyScreeningForShipment("acct_1", "ship_1");

    expect(result.status).toBe("CLEAR");
    expect(result.partiesScreened).toBe(1);
  });
});

describe("runRestrictedPartyScreeningForShipment: no shipment parties never resolves to CLEAR", () => {
  it("reports SKIPPED when the shipment has no parties to screen", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([]);
    const result = await runRestrictedPartyScreeningForShipment("acct_1", "ship_1");
    expect(result.status).toBe("SKIPPED");
    expect(result.partiesScreened).toBe(0);
    expect(result.skipped).toContainEqual({ role: "ALL", reason: "No shipment parties are available to screen." });
    expect(runRestrictedPartyScreening).not.toHaveBeenCalled();
  });
});

describe("runRestrictedPartyScreeningForShipment: aggregation across parties", () => {
  it("reports CLEAR when every party clears", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([shipmentParty()]);
    runRestrictedPartyScreening.mockResolvedValue({ correlationId: "corr_1", passes: [pass({ status: "CLEAR" })] });

    const result = await runRestrictedPartyScreeningForShipment("acct_1", "ship_1");
    expect(result.status).toBe("CLEAR");
    expect(result.hits).toHaveLength(0);
    expect(result.partiesScreened).toBe(1);
  });

  it("rolls up to the worst status across multiple parties", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([
      shipmentParty({ shipmentPartyId: "sp_1", role: "Consignee", name: "Clean Party" }),
      shipmentParty({ shipmentPartyId: "sp_2", role: "Shipper", name: "Bad Actor Corp" }),
    ]);
    runRestrictedPartyScreening
      .mockResolvedValueOnce({ correlationId: "corr_1", passes: [pass({ status: "CLEAR" })] })
      .mockResolvedValueOnce({
        correlationId: "corr_2",
        passes: [pass({ status: "HIT", matches: [match()] })],
      });

    const result = await runRestrictedPartyScreeningForShipment("acct_1", "ship_1");
    expect(result.status).toBe("HIT");
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]).toMatchObject({ role: "Shipper", tier: "HIT", sourceList: "SDN" });
  });

  it("excludes suppressed matches from hits but still reflects them in the resulting status", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([shipmentParty()]);
    runRestrictedPartyScreening.mockResolvedValue({
      correlationId: "corr_1",
      passes: [pass({ status: "CLEAR", matches: [match({ suppressedByApprovedParty: true })] })],
    });

    const result = await runRestrictedPartyScreeningForShipment("acct_1", "ship_1");
    expect(result.hits).toHaveLength(0);
    expect(result.status).toBe("CLEAR");
  });

  it("collects red-flag hits independently of denial-order matches", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([shipmentParty()]);
    runRestrictedPartyScreening.mockResolvedValue({
      correlationId: "corr_1",
      passes: [
        pass({
          status: "REVIEW_REQUIRED",
          matches: [],
          redFlagHits: [{ keywordRuleId: "rule_1", matchedWord: "front company" }],
        }),
      ],
    });

    const result = await runRestrictedPartyScreeningForShipment("acct_1", "ship_1");
    expect(result.hits).toHaveLength(0);
    expect(result.redFlagHits).toHaveLength(1);
    expect(result.redFlagHits[0]).toMatchObject({ matchedWord: "front company", role: "Consignee" });
  });

  it("surfaces per-party skip and error entries", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([shipmentParty()]);
    runRestrictedPartyScreening.mockResolvedValue({
      correlationId: "corr_1",
      passes: [pass({ status: "SKIPPED" }), ],
    });

    const skippedResult = await runRestrictedPartyScreeningForShipment("acct_1", "ship_1");
    expect(skippedResult.status).toBe("SKIPPED");
    expect(skippedResult.skipped).toContainEqual({
      role: "Consignee",
      reason: "No restricted-party reference data is loaded.",
    });

    runRestrictedPartyScreening.mockResolvedValue({
      correlationId: "corr_2",
      passes: [pass({ status: "ERROR", errorCode: "REPOSITORY_ERROR", errorMessage: "db down" })],
    });
    const erroredResult = await runRestrictedPartyScreeningForShipment("acct_1", "ship_1");
    expect(erroredResult.status).toBe("ERROR");
    expect(erroredResult.errors).toContainEqual({ role: "Consignee", code: "REPOSITORY_ERROR", message: "db down" });
  });

  it("persists every party's screening run", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([
      shipmentParty({ shipmentPartyId: "sp_1" }),
      shipmentParty({ shipmentPartyId: "sp_2" }),
    ]);
    runRestrictedPartyScreening.mockResolvedValue({ correlationId: "corr_1", passes: [pass()] });

    await runRestrictedPartyScreeningForShipment("acct_1", "ship_1");
    expect(persistScreeningRun).toHaveBeenCalledTimes(2);
  });
});

describe("runRestrictedPartyScreeningForShipment: party-level pre-approval reuse", () => {
  it("skips the local matcher for a party with a valid pre-approval and records the reuse", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([shipmentParty()]);
    checkPreApprovalGate.mockResolvedValue({ applied: true, reason: "Valid pre-approval found.", approvalId: "approval_1" });

    const result = await runRestrictedPartyScreeningForShipment("acct_1", "ship_1");

    expect(runRestrictedPartyScreening).not.toHaveBeenCalled();
    expect(persistScreeningRun).not.toHaveBeenCalled();
    expect(result.preApprovedReuses).toHaveLength(1);
    expect(result.preApprovedReuses[0]).toMatchObject({
      role: "Consignee",
      partyId: "party_1",
      approvalId: "approval_1",
      screeningDisposition: "PRE_APPROVED",
      executionMode: "PRE_APPROVED_REUSE",
      localMatcherExecuted: false,
    });
  });

  it("still runs the matcher for parties without a valid pre-approval, even when another party on the same shipment has one", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([
      shipmentParty({ shipmentPartyId: "sp_1", role: "Consignee", partyId: "party_1" }),
      shipmentParty({ shipmentPartyId: "sp_2", role: "Shipper", partyId: "party_2", name: "Other Corp" }),
    ]);
    checkPreApprovalGate.mockImplementation(async ({ partyId }: { partyId: string }) =>
      partyId === "party_1"
        ? { applied: true, reason: "Valid pre-approval found.", approvalId: "approval_1" }
        : { applied: false, reason: "No active pre-approval exists for this party." }
    );
    runRestrictedPartyScreening.mockResolvedValue({ correlationId: "corr_2", passes: [pass({ status: "CLEAR" })] });

    const result = await runRestrictedPartyScreeningForShipment("acct_1", "ship_1");

    expect(runRestrictedPartyScreening).toHaveBeenCalledTimes(1);
    expect(persistScreeningRun).toHaveBeenCalledTimes(1);
    expect(result.preApprovedReuses).toHaveLength(1);
    expect(result.preApprovedReuses[0]).toMatchObject({ role: "Consignee", partyId: "party_1" });
  });

  it("passes forceRescreen through to the gate so a forced rescreen always runs the local matcher", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([shipmentParty()]);
    checkPreApprovalGate.mockResolvedValue({ applied: false, reason: "forceRescreen requested; pre-approval bypassed." });
    runRestrictedPartyScreening.mockResolvedValue({ correlationId: "corr_1", passes: [pass({ status: "CLEAR" })] });

    const result = await runRestrictedPartyScreeningForShipment("acct_1", "ship_1", { forceRescreen: true });

    expect(checkPreApprovalGate).toHaveBeenCalledWith(expect.objectContaining({ forceRescreen: true }));
    expect(runRestrictedPartyScreening).toHaveBeenCalledTimes(1);
    expect(result.preApprovedReuses).toHaveLength(0);
  });

  it("never populates preApprovedReuses for the no-parties SKIPPED path", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([]);
    const result = await runRestrictedPartyScreeningForShipment("acct_1", "ship_1");
    expect(result.preApprovedReuses).toEqual([]);
  });
});
