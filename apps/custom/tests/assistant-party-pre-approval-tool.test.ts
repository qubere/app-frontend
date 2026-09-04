import { describe, it, expect, vi, beforeEach } from "vitest";

// Ask Qubere tool get_party_pre_approval_status: must be grounded only in
// persisted PartyScreeningApproval evidence and the SAME checkPreApprovalGate
// function real screening uses -- never a separate/simplified re-implementation
// that could disagree with what screening would actually do.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    party: { findFirst: vi.fn() },
    partyScreeningApproval: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const checkPreApprovalGate = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/preApproval", () => ({ checkPreApprovalGate }));

const { getToolByName } = await import("@/modules/assistant/tools");
const tool = getToolByName("get_party_pre_approval_status");

const ctx = { accountId: "acct_1", userId: "user_1", roleIds: [], roleNames: [], permissions: [] } as any;

function approvalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "approval_1",
    status: "PRE_APPROVED",
    approvedAt: new Date("2026-08-01T00:00:00Z"),
    expiresAt: null,
    revokedAt: null,
    reason: "Trusted long-standing customer",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("get_party_pre_approval_status", () => {
  it("is registered with a permission gate, not open to every caller", () => {
    expect(tool).toBeDefined();
    expect(tool?.access?.permission).toBe("compliance.restrictedParty.read");
  });

  it("returns an error rather than any status when the party does not belong to this account", async () => {
    dbMock.party.findFirst.mockResolvedValue(null);

    const res = await tool!.execute(ctx, { partyId: "party_other_tenant" });

    expect(res).toHaveProperty("error");
    expect(dbMock.party.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "party_other_tenant", accountId: "acct_1" } })
    );
    expect(checkPreApprovalGate).not.toHaveBeenCalled();
  });

  it("grounds validity in the exact same gate real screening uses, not a separate computation", async () => {
    dbMock.party.findFirst.mockResolvedValue({ id: "party_1" });
    checkPreApprovalGate.mockResolvedValue({ applied: true, reason: "Valid pre-approval found.", approvalId: "approval_1" });
    dbMock.partyScreeningApproval.findMany.mockResolvedValue([approvalRow()]);

    const res: any = await tool!.execute(ctx, { partyId: "party_1" });

    expect(checkPreApprovalGate).toHaveBeenCalledWith({
      accountId: "acct_1",
      partyId: "party_1",
      source: "SHIPMENT",
      audit: false,
    });
    expect(res.currentlyValidForReuse).toBe(true);
    expect(res.validityReason).toBe("Valid pre-approval found.");
  });

  it("reports why reuse is not currently valid, grounded in the gate's own reason", async () => {
    dbMock.party.findFirst.mockResolvedValue({ id: "party_1" });
    checkPreApprovalGate.mockResolvedValue({ applied: false, reason: "Pre-approval has expired." });
    dbMock.partyScreeningApproval.findMany.mockResolvedValue([approvalRow({ status: "PRE_APPROVED" })]);

    const res: any = await tool!.execute(ctx, { partyId: "party_1" });

    expect(res.currentlyValidForReuse).toBe(false);
    expect(res.validityReason).toBe("Pre-approval has expired.");
  });

  it("reports full approval history from persisted rows only, scoped to this account and party", async () => {
    dbMock.party.findFirst.mockResolvedValue({ id: "party_1" });
    checkPreApprovalGate.mockResolvedValue({ applied: false, reason: "No active pre-approval exists for this party." });
    dbMock.partyScreeningApproval.findMany.mockResolvedValue([
      approvalRow({ id: "approval_2", status: "REVOKED", revokedAt: new Date("2026-08-10T00:00:00Z") }),
      approvalRow({ id: "approval_1" }),
    ]);

    const res: any = await tool!.execute(ctx, { partyId: "party_1" });

    expect(dbMock.partyScreeningApproval.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { partyId: "party_1", accountId: "acct_1" } })
    );
    expect(res.approvals).toHaveLength(2);
    expect(res.approvals[0]).toMatchObject({ approvalId: "approval_2", status: "REVOKED" });
    expect(res.approvals[1]).toMatchObject({ approvalId: "approval_1", status: "PRE_APPROVED" });
  });

  it("returns an error for a malformed/missing partyId rather than guessing", async () => {
    const res: any = await tool!.execute(ctx, {});
    expect(res).toHaveProperty("error");
    expect(dbMock.party.findFirst).not.toHaveBeenCalled();
  });
});
