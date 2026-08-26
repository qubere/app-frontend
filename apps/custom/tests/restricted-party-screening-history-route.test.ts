import { describe, it, expect, vi, beforeEach } from "vitest";

// GET .../restricted-party-screening-history route.
// Covers: tenant isolation, and that the current PRE_APPROVED approval's
// live validity is computed via the read-only (audit: false) gate check --
// merely viewing the party page must never itself be recorded as a reuse.

const { dbMock } = vi.hoisted(() => {
  return {
    dbMock: {
      party: { findFirst: vi.fn() },
      partyScreeningSummary: { findUnique: vi.fn() },
      restrictedPartyScreeningResult: { findMany: vi.fn() },
      partyScreeningApproval: { findMany: vi.fn() },
    },
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: any, options: any) => {
    (withAuthenticatedRouteOptions as any[]).push(options);
    return async (req: any, context: any) =>
      handler({ req, ctx: { accountId: "acct_1", userId: "user_1" }, requestId: "req_1", params: context ? await context.params : {} });
  },
}));
const withAuthenticatedRouteOptions: Array<{ permission?: string }> = [];

const checkPreApprovalGate = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/preApproval", () => ({ checkPreApprovalGate }));

const { GET } = await import(
  "@/app/api/v1/parties/[partyId]/restricted-party-screening-history/route"
);

function req() {
  return {} as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.partyScreeningSummary.findUnique.mockResolvedValue(null);
  dbMock.restrictedPartyScreeningResult.findMany.mockResolvedValue([]);
});

describe("GET .../restricted-party-screening-history", () => {
  it("returns 404 for a party belonging to another account", async () => {
    dbMock.party.findFirst.mockResolvedValue(null);
    const response = await GET(req(), { params: Promise.resolve({ partyId: "party_other_tenant" }) });
    expect(response.status).toBe(404);
    expect(dbMock.party.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "party_other_tenant", accountId: "acct_1" } })
    );
  });

  it("checks pre-approval validity read-only (audit: false), never recording the page view as a reuse", async () => {
    dbMock.party.findFirst.mockResolvedValue({ id: "party_1" });
    dbMock.partyScreeningApproval.findMany.mockResolvedValue([]);
    checkPreApprovalGate.mockResolvedValue({ applied: false, reason: "No active pre-approval exists for this party." });

    await GET(req(), { params: Promise.resolve({ partyId: "party_1" }) });

    expect(checkPreApprovalGate).toHaveBeenCalledWith({
      accountId: "acct_1",
      partyId: "party_1",
      source: "SHIPMENT",
      audit: false,
    });
  });

  it("attaches the live verdict only to the approval row the gate actually evaluated", async () => {
    dbMock.party.findFirst.mockResolvedValue({ id: "party_1" });
    dbMock.partyScreeningApproval.findMany.mockResolvedValue([
      { id: "approval_current", status: "PRE_APPROVED", approvedAt: "2026-06-01" },
      { id: "approval_old_revoked", status: "REVOKED", approvedAt: "2025-01-01" },
    ]);
    checkPreApprovalGate.mockResolvedValue({
      applied: false,
      reason: "Party identity has changed since pre-approval was granted (identity-hash mismatch).",
      approvalId: "approval_current",
    });

    const response = await GET(req(), { params: Promise.resolve({ partyId: "party_1" }) });
    const body = await response.json();

    const current = body.preApprovals.find((a: any) => a.id === "approval_current");
    const old = body.preApprovals.find((a: any) => a.id === "approval_old_revoked");
    expect(current.currentlyValidForReuse).toBe(false);
    expect(current.validityReason).toBe(
      "Party identity has changed since pre-approval was granted (identity-hash mismatch)."
    );
    expect(old.currentlyValidForReuse).toBeUndefined();
  });
});
