import { describe, it, expect, vi, beforeEach } from "vitest";

// Two independent guarantees required by the Party-level Pre-Approval design:
//
// 1. Independence from RestrictedPartyDisposition: a candidate-level
//    FALSE_POSITIVE disposition on one match must never be read as, or
//    substitute for, a party-level pre-approval, and vice versa -- the gate
//    only ever queries PartyScreeningApproval, never RestrictedPartyDisposition.
//
// 2. Tenant isolation: an approval granted under one account must never
//    apply to an identical party in a different account, even with the same
//    partyId/version/identity-hash, because the lookup itself is always
//    scoped by accountId.

const partyScreeningApprovalFindFirst = vi.fn();
const partyFindFirst = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    partyScreeningApproval: { findFirst: partyScreeningApprovalFindFirst },
    party: { findFirst: partyFindFirst },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  AuditAction: {
    PARTY_SCREENING_PRE_APPROVAL_REUSED: "PARTY_SCREENING_PRE_APPROVAL_REUSED",
    PARTY_SCREENING_PRE_APPROVAL_CHECK_INVALID: "PARTY_SCREENING_PRE_APPROVAL_CHECK_INVALID",
    PARTY_SCREENING_PRE_APPROVAL_BYPASSED_FORCE_RESCREEN: "PARTY_SCREENING_PRE_APPROVAL_BYPASSED_FORCE_RESCREEN",
  },
}));

const computeIdentityHash = vi.fn();
const loadCurrentIdentity = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/partyIdentity", () => ({
  computeIdentityHash: (...args: unknown[]) => computeIdentityHash(...args),
  loadCurrentIdentity: (...args: unknown[]) => loadCurrentIdentity(...args),
}));

const hasNewerPublishedReferenceData = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/restrictedPartyRepository", () => ({
  getLatestReferenceDataPublishedAt: vi.fn(),
  hasNewerPublishedReferenceData: (...args: unknown[]) => hasNewerPublishedReferenceData(...args),
}));

const { checkPreApprovalGate } = await import("@/modules/agents/compliance/restrictedParty/preApproval");

beforeEach(() => {
  vi.clearAllMocks();
  computeIdentityHash.mockReturnValue("hash-current");
  loadCurrentIdentity.mockResolvedValue({ name: "Acme Trading Co" });
  hasNewerPublishedReferenceData.mockResolvedValue(false);
  partyFindFirst.mockResolvedValue({ currentVersion: 3 });
});

describe("Pre-approval is independent of RestrictedPartyDisposition", () => {
  it("never queries RestrictedPartyDisposition -- reuse-eligibility is decided from PartyScreeningApproval alone", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue({
      id: "approval_1",
      accountId: "acct_1",
      partyId: "party_1",
      status: "PRE_APPROVED",
      partyVersion: 3,
      screeningInputHash: "hash-current",
      revokedAt: null,
      expiresAt: null,
      referenceDataAsOf: null,
    });

    const result = await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "SHIPMENT" });

    expect(result.applied).toBe(true);
    expect(partyScreeningApprovalFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: "acct_1", partyId: "party_1", status: "PRE_APPROVED" } })
    );
    // The query touches only PartyScreeningApproval -- a FALSE_POSITIVE
    // disposition on some candidate match is not, and cannot be, part of
    // this decision.
    const whereClause = JSON.stringify(partyScreeningApprovalFindFirst.mock.calls[0][0]);
    expect(whereClause).not.toContain("FALSE_POSITIVE");
    expect(whereClause).not.toContain("Disposition");
  });

  it("a party with zero pre-approvals still reports not-applied even though it may hold FALSE_POSITIVE dispositions elsewhere", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue(null);
    const result = await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "SHIPMENT" });
    expect(result.applied).toBe(false);
    expect(result.reason).toContain("No active pre-approval exists");
  });
});

describe("Tenant isolation: an approval never applies across accounts", () => {
  it("scopes the approval lookup by accountId, so an identical party/version/hash in another account can't match", async () => {
    // acct_2 has no PartyScreeningApproval row for this partyId (the row
    // belongs to acct_1) -- the mock reflects that findFirst is scoped by
    // accountId and would return null for a mismatched account.
    partyScreeningApprovalFindFirst.mockImplementation(async ({ where }: any) =>
      where.accountId === "acct_1"
        ? {
            id: "approval_1",
            accountId: "acct_1",
            partyId: "party_1",
            status: "PRE_APPROVED",
            partyVersion: 3,
            screeningInputHash: "hash-current",
            revokedAt: null,
            expiresAt: null,
            referenceDataAsOf: null,
          }
        : null
    );

    const ownAccount = await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "SHIPMENT" });
    expect(ownAccount.applied).toBe(true);

    const otherAccount = await checkPreApprovalGate({ accountId: "acct_2", partyId: "party_1", source: "SHIPMENT" });
    expect(otherAccount.applied).toBe(false);
    expect(partyScreeningApprovalFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: "acct_2", partyId: "party_1", status: "PRE_APPROVED" } })
    );
  });

  it("also scopes the Party currentVersion check by accountId, never trusting a bare partyId across tenants", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue({
      id: "approval_1",
      accountId: "acct_1",
      partyId: "party_1",
      status: "PRE_APPROVED",
      partyVersion: 3,
      screeningInputHash: "hash-current",
      revokedAt: null,
      expiresAt: null,
      referenceDataAsOf: null,
    });
    partyFindFirst.mockResolvedValue(null);

    const result = await checkPreApprovalGate({ accountId: "acct_2", partyId: "party_1", source: "SHIPMENT" });

    expect(result.applied).toBe(false);
    expect(partyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "party_1", accountId: "acct_2" } })
    );
  });
});
