import { describe, it, expect, vi, beforeEach } from "vitest";

// Restricted / Denied-Party Screening: preApproval.ts
// Covers: fail-closed behavior on any unmet condition or lookup error,
// forceRescreen always bypassing the gate (and being audited), the full
// validity chain (revoked / expired / version mismatch / identity-hash
// mismatch / reference-data staleness), and that a lookup exception never
// resolves to an implicit PRE_APPROVED result.

const partyScreeningApprovalFindFirst = vi.fn();
const partyScreeningApprovalCreate = vi.fn();
const partyScreeningApprovalUpdate = vi.fn();
const partyFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    partyScreeningApproval: {
      findFirst: partyScreeningApprovalFindFirst,
      create: partyScreeningApprovalCreate,
      update: partyScreeningApprovalUpdate,
    },
    party: { findFirst: partyFindFirst },
  },
}));

const createAuditLog = vi.fn();
vi.mock("@/lib/audit", () => ({
  createAuditLog: (...args: unknown[]) => createAuditLog(...args),
  AuditAction: {
    PARTY_SCREENING_PRE_APPROVAL_CREATED: "PARTY_SCREENING_PRE_APPROVAL_CREATED",
    PARTY_SCREENING_PRE_APPROVAL_REVOKED: "PARTY_SCREENING_PRE_APPROVAL_REVOKED",
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

const getLatestReferenceDataPublishedAt = vi.fn();
const hasNewerPublishedReferenceData = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/restrictedPartyRepository", () => ({
  getLatestReferenceDataPublishedAt: (...args: unknown[]) => getLatestReferenceDataPublishedAt(...args),
  hasNewerPublishedReferenceData: (...args: unknown[]) => hasNewerPublishedReferenceData(...args),
}));

const {
  checkPreApprovalGate,
  createPreApproval,
  revokePreApproval,
  PartyNotFoundForApprovalError,
  PartyHasNoActiveIdentityForApprovalError,
  PreApprovalNotFoundError,
} = await import("@/modules/agents/compliance/restrictedParty/preApproval");

function approvalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "approval_1",
    accountId: "acct_1",
    partyId: "party_1",
    status: "PRE_APPROVED",
    partyVersion: 3,
    screeningInputHash: "hash-current",
    revokedAt: null,
    expiresAt: null,
    referenceDataAsOf: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  computeIdentityHash.mockReturnValue("hash-current");
  loadCurrentIdentity.mockResolvedValue({ name: "Acme Trading Co" });
  hasNewerPublishedReferenceData.mockResolvedValue(false);
  partyFindFirst.mockResolvedValue({ currentVersion: 3 });
});

describe("checkPreApprovalGate: forceRescreen always bypasses", () => {
  it("never applies pre-approval when forceRescreen is true, and audits the bypass", async () => {
    const result = await checkPreApprovalGate({
      accountId: "acct_1",
      partyId: "party_1",
      source: "SHIPMENT",
      forceRescreen: true,
    });
    expect(result.applied).toBe(false);
    expect(partyScreeningApprovalFindFirst).not.toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PARTY_SCREENING_PRE_APPROVAL_BYPASSED_FORCE_RESCREEN", entityId: "party_1" })
    );
  });
});

describe("checkPreApprovalGate: eligibility and existence preconditions", () => {
  it("does not apply when there is no partyId", async () => {
    const result = await checkPreApprovalGate({ accountId: "acct_1", partyId: null, source: "SHIPMENT" });
    expect(result.applied).toBe(false);
    expect(partyScreeningApprovalFindFirst).not.toHaveBeenCalled();
  });

  it("does not apply for a source that is not reuse-eligible (e.g. PARTY_MASTER)", async () => {
    const result = await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "PARTY_MASTER" });
    expect(result.applied).toBe(false);
    expect(partyScreeningApprovalFindFirst).not.toHaveBeenCalled();
  });

  it("does not apply when no active pre-approval exists", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue(null);
    const result = await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "SHIPMENT" });
    expect(result.applied).toBe(false);
  });
});

describe("checkPreApprovalGate: validity chain", () => {
  it("does not apply when the approval has been revoked", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue(approvalRow({ revokedAt: new Date() }));
    const result = await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "SHIPMENT" });
    expect(result.applied).toBe(false);
  });

  it("does not apply when the approval has expired", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue(approvalRow({ expiresAt: new Date("2000-01-01T00:00:00Z") }));
    const result = await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "SHIPMENT" });
    expect(result.applied).toBe(false);
  });

  it("does not apply when the party's currentVersion no longer matches the approved snapshot", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue(approvalRow({ partyVersion: 1 }));
    partyFindFirst.mockResolvedValue({ currentVersion: 2 });
    const result = await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "SHIPMENT" });
    expect(result.applied).toBe(false);
  });

  it("does not apply when the identity hash no longer matches (party edited since approval)", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue(approvalRow());
    computeIdentityHash.mockReturnValue("hash-changed");
    const result = await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "SHIPMENT" });
    expect(result.applied).toBe(false);
  });

  it("does not apply when the party has no active identity to compare", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue(approvalRow());
    loadCurrentIdentity.mockResolvedValue(null);
    const result = await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "SHIPMENT" });
    expect(result.applied).toBe(false);
  });

  it("does not apply when a relevant watchlist has published newer data since approval", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue(approvalRow());
    hasNewerPublishedReferenceData.mockResolvedValue(true);
    const result = await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "SHIPMENT" });
    expect(result.applied).toBe(false);
  });

  it("applies when every condition holds, and audits the reuse", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue(approvalRow());
    const result = await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "SHIPMENT" });
    expect(result.applied).toBe(true);
    expect(result.approvalId).toBe("approval_1");
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PARTY_SCREENING_PRE_APPROVAL_REUSED", entityId: "party_1" })
    );
  });
});

describe("checkPreApprovalGate: audit:false for read-only status checks", () => {
  it("does not write an audit log for a successful check when audit is false, but still reports approvalId", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue(approvalRow());
    const result = await checkPreApprovalGate({
      accountId: "acct_1",
      partyId: "party_1",
      source: "SHIPMENT",
      audit: false,
    });
    expect(result.applied).toBe(true);
    expect(result.approvalId).toBe("approval_1");
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("does not write an audit log for a failed lookup when audit is false", async () => {
    partyScreeningApprovalFindFirst.mockRejectedValue(new Error("db down"));
    const result = await checkPreApprovalGate({
      accountId: "acct_1",
      partyId: "party_1",
      source: "SHIPMENT",
      audit: false,
    });
    expect(result.applied).toBe(false);
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("still audits real reuse and forceRescreen bypass by default (audit omitted)", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue(approvalRow());
    await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "SHIPMENT" });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PARTY_SCREENING_PRE_APPROVAL_REUSED" })
    );
  });

  it("reports approvalId even when the approval is invalid/stale, so callers can label which one", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue(approvalRow({ expiresAt: new Date("2000-01-01T00:00:00Z") }));
    const result = await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "SHIPMENT" });
    expect(result.applied).toBe(false);
    expect(result.approvalId).toBe("approval_1");
  });
});

describe("checkPreApprovalGate: fail-closed on lookup error", () => {
  it("never resolves to applied=true when the approval lookup throws, and audits the failure", async () => {
    partyScreeningApprovalFindFirst.mockRejectedValue(new Error("db down"));
    const result = await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "SHIPMENT" });
    expect(result.applied).toBe(false);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PARTY_SCREENING_PRE_APPROVAL_CHECK_INVALID", entityId: "party_1" })
    );
  });

  it("still fails closed even when the audit-logging call for the failure itself throws", async () => {
    partyScreeningApprovalFindFirst.mockRejectedValue(new Error("db down"));
    createAuditLog.mockRejectedValueOnce(new Error("audit unavailable"));
    const result = await checkPreApprovalGate({ accountId: "acct_1", partyId: "party_1", source: "SHIPMENT" });
    expect(result.applied).toBe(false);
  });
});

describe("createPreApproval", () => {
  it("throws when the party is not found for this account", async () => {
    partyFindFirst.mockResolvedValue(null);
    await expect(
      createPreApproval({ accountId: "acct_1", partyId: "party_1", approvedByUserId: "user_1" })
    ).rejects.toThrow(PartyNotFoundForApprovalError);
    expect(partyScreeningApprovalCreate).not.toHaveBeenCalled();
  });

  it("throws when the party has no active identity to approve", async () => {
    loadCurrentIdentity.mockResolvedValue(null);
    await expect(
      createPreApproval({ accountId: "acct_1", partyId: "party_1", approvedByUserId: "user_1" })
    ).rejects.toThrow(PartyHasNoActiveIdentityForApprovalError);
  });

  it("snapshots the current partyVersion, identity hash, and reference-data watermark, and audits creation", async () => {
    partyFindFirst.mockResolvedValue({ id: "party_1", currentVersion: 5 });
    computeIdentityHash.mockReturnValue("hash-snapshot");
    const watermark = new Date("2026-01-01T00:00:00Z");
    getLatestReferenceDataPublishedAt.mockResolvedValue(watermark);
    partyScreeningApprovalCreate.mockResolvedValue({ id: "approval_new" });

    await createPreApproval({ accountId: "acct_1", partyId: "party_1", approvedByUserId: "user_1", reason: "Trusted long-standing customer" });

    expect(partyScreeningApprovalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: "acct_1",
        partyId: "party_1",
        status: "PRE_APPROVED",
        partyVersion: 5,
        screeningInputHash: "hash-snapshot",
        approvedByUserId: "user_1",
        reason: "Trusted long-standing customer",
        referenceDataAsOf: watermark,
      }),
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PARTY_SCREENING_PRE_APPROVAL_CREATED", entityId: "party_1" })
    );
  });
});

describe("revokePreApproval", () => {
  it("throws when the approval is not found for this account", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue(null);
    await expect(
      revokePreApproval({ accountId: "acct_1", approvalId: "approval_1", revokedByUserId: "user_1" })
    ).rejects.toThrow(PreApprovalNotFoundError);
  });

  it("is idempotent -- revoking an already-revoked approval does not re-audit or re-update", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue(approvalRow({ status: "REVOKED" }));
    const result = await revokePreApproval({ accountId: "acct_1", approvalId: "approval_1", revokedByUserId: "user_1" });
    expect(result.status).toBe("REVOKED");
    expect(partyScreeningApprovalUpdate).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("transitions PRE_APPROVED -> REVOKED and audits the revocation", async () => {
    partyScreeningApprovalFindFirst.mockResolvedValue(approvalRow());
    partyScreeningApprovalUpdate.mockResolvedValue(approvalRow({ status: "REVOKED" }));

    await revokePreApproval({ accountId: "acct_1", approvalId: "approval_1", revokedByUserId: "user_1", reason: "Party re-flagged" });

    expect(partyScreeningApprovalUpdate).toHaveBeenCalledWith({
      where: { id: "approval_1" },
      data: expect.objectContaining({ status: "REVOKED", revokedByUserId: "user_1", reason: "Party re-flagged" }),
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PARTY_SCREENING_PRE_APPROVAL_REVOKED", entityId: "party_1" })
    );
  });
});
