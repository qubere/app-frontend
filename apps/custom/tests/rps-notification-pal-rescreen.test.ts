import { describe, it, expect, vi, beforeEach } from "vitest";

// PAL (pre-approved-party) re-screen detection: a screened party that was
// previously PRE_APPROVED but now yields a fresh HIT/REVIEW_REQUIRED must be
// reported to persistScreeningRun with notificationTypeOverride:
// "PAL_RESCREEN_HIT", not the default RPS_HIT/RPS_REVIEW_REQUIRED or
// PARTY_RESCREEN_HIT. Two independent call sites compute this:
//   - shipmentScreening.ts: !gate.applied && Boolean(gate.approvalId)
//   - partyScreeningLifecycle.ts (rescreenParty): an independent
//     partyScreeningApproval.findFirst({status: "PRE_APPROVED"}) lookup,
//     since checkPreApprovalGate is never called for PARTY_MASTER source.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    partyScreeningApproval: { findFirst: vi.fn() },
    partyScreeningSummary: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const { getShipmentPartiesForScreening } = vi.hoisted(() => ({ getShipmentPartiesForScreening: vi.fn() }));
vi.mock("@/modules/agents/compliance/restrictedParty/restrictedPartyRepository", () => ({
  getShipmentPartiesForScreening,
}));

const { runRestrictedPartyScreening } = vi.hoisted(() => ({ runRestrictedPartyScreening: vi.fn() }));
vi.mock("@/modules/agents/compliance/restrictedParty/restrictedPartyScreening", () => ({
  runRestrictedPartyScreening,
}));

const { persistScreeningRun } = vi.hoisted(() => ({ persistScreeningRun: vi.fn() }));
vi.mock("@/modules/agents/compliance/restrictedParty/persistResult", () => ({ persistScreeningRun }));

const { checkPreApprovalGate } = vi.hoisted(() => ({ checkPreApprovalGate: vi.fn() }));
vi.mock("@/modules/agents/compliance/restrictedParty/preApproval", () => ({ checkPreApprovalGate }));

const { recordComplianceExecution } = vi.hoisted(() => ({ recordComplianceExecution: vi.fn() }));
vi.mock("@/modules/compliance/executionHistory", () => ({ recordComplianceExecution }));

const { loadCurrentIdentity, computeIdentityHash } = vi.hoisted(() => ({
  loadCurrentIdentity: vi.fn(),
  computeIdentityHash: vi.fn(() => "hash_1"),
}));
vi.mock("@/modules/agents/compliance/restrictedParty/partyIdentity", () => ({
  loadCurrentIdentity,
  computeIdentityHash,
}));

const { runRestrictedPartyScreeningForShipment } = await import(
  "@/modules/agents/compliance/restrictedParty/shipmentScreening"
);
const { rescreenParty } = await import("@/modules/agents/compliance/restrictedParty/partyScreeningLifecycle");

function shipmentParty(overrides: Record<string, unknown> = {}) {
  return {
    role: "IMPORTER",
    name: "Acme Trading Co",
    partyId: "party_1",
    shipmentPartyId: "sp_1",
    address: null,
    city: null,
    country: null,
    contactName: null,
    ...overrides,
  };
}

function runResultFixture(status: "HIT" | "REVIEW_REQUIRED" = "HIT") {
  return {
    correlationId: "corr_1",
    passes: [{ passType: "PARTY_NAME", status, matches: [], redFlagHits: [], screeningDurationMs: 1 }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  runRestrictedPartyScreening.mockResolvedValue(runResultFixture());
  persistScreeningRun.mockResolvedValue([{ id: "result_1", status: "HIT", passType: "PARTY_NAME" }]);
  recordComplianceExecution.mockResolvedValue(undefined);
  loadCurrentIdentity.mockResolvedValue({ name: "Acme Trading Co" });
  dbMock.partyScreeningSummary.upsert.mockResolvedValue({});
});

describe("shipmentScreening.ts: PAL re-screen detection via checkPreApprovalGate", () => {
  it("passes notificationTypeOverride: PAL_RESCREEN_HIT when the party was previously PRE_APPROVED (gate not applied, but an approvalId exists)", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([shipmentParty()]);
    checkPreApprovalGate.mockResolvedValue({ applied: false, approvalId: "approval_1" });

    await runRestrictedPartyScreeningForShipment("acct_1", "shipment_1");

    expect(persistScreeningRun).toHaveBeenCalledTimes(1);
    expect(persistScreeningRun.mock.calls[0][2]).toMatchObject({ notificationTypeOverride: "PAL_RESCREEN_HIT" });
  });

  it("passes no override (defaults apply) for an ordinary first-time screen (no prior approval at all)", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([shipmentParty()]);
    checkPreApprovalGate.mockResolvedValue({ applied: false, approvalId: null });

    await runRestrictedPartyScreeningForShipment("acct_1", "shipment_1");

    expect(persistScreeningRun.mock.calls[0][2]).toMatchObject({ notificationTypeOverride: undefined });
  });

  it("skips screening entirely (no persistScreeningRun call) when the pre-approval gate is applied (valid reuse)", async () => {
    getShipmentPartiesForScreening.mockResolvedValue([shipmentParty()]);
    checkPreApprovalGate.mockResolvedValue({ applied: true, approvalId: "approval_1" });

    const result = await runRestrictedPartyScreeningForShipment("acct_1", "shipment_1");

    expect(persistScreeningRun).not.toHaveBeenCalled();
    expect(result.preApprovedReuses).toHaveLength(1);
  });
});

describe("partyScreeningLifecycle.ts (rescreenParty): PAL re-screen via independent partyScreeningApproval lookup", () => {
  it("overrides to PAL_RESCREEN_HIT when an active PartyScreeningApproval (status PRE_APPROVED) exists for this party, even though PARTY_MASTER never reuses via checkPreApprovalGate", async () => {
    dbMock.partyScreeningApproval.findFirst.mockResolvedValue({ id: "approval_1" });

    await rescreenParty("acct_1", "party_1");

    expect(dbMock.partyScreeningApproval.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: "acct_1", partyId: "party_1", status: "PRE_APPROVED" } })
    );
    expect(persistScreeningRun.mock.calls[0][2]).toMatchObject({ notificationTypeOverride: "PAL_RESCREEN_HIT" });
  });

  it("passes no override for a party with no PRE_APPROVED approval on file (ordinary Party Master re-screen exception)", async () => {
    dbMock.partyScreeningApproval.findFirst.mockResolvedValue(null);

    await rescreenParty("acct_1", "party_1");

    expect(persistScreeningRun.mock.calls[0][2]).toMatchObject({ notificationTypeOverride: undefined });
  });
});
