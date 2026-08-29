import { describe, it, expect, vi, beforeEach } from "vitest";

// PRE_APPROVED_PARTY_IMPORT processing branch: each BatchRecord just calls
// the same createPreApproval() the one-at-a-time API uses -- never RPS/
// License/Embargo/Classification. All of processing.ts's other canonical
// service imports are stubbed since they're irrelevant to this batchType and
// must not be invoked by it.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    complianceBatch: { findUnique: vi.fn() },
    batchRecord: { update: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const createPreApproval = vi.fn();
class PartyNotFoundForApprovalError extends Error {}
class PartyHasNoActiveIdentityForApprovalError extends Error {}
vi.mock("@/modules/agents/compliance/restrictedParty/preApproval", () => ({
  createPreApproval: (...args: unknown[]) => createPreApproval(...args),
  PartyNotFoundForApprovalError,
  PartyHasNoActiveIdentityForApprovalError,
}));

vi.mock("@/modules/agents/compliance/restrictedParty/restrictedPartyScreening", () => ({
  runRestrictedPartyScreening: vi.fn(),
}));
vi.mock("@/modules/agents/compliance/restrictedParty/persistResult", () => ({ persistScreeningRun: vi.fn() }));
vi.mock("@/modules/licenses/determinationService", () => ({ runLicenseDetermination: vi.fn() }));
vi.mock("@/modules/agents/compliance/embargo/embargoRepository", () => ({ getAccountEmbargoConfig: vi.fn() }));
vi.mock("@/modules/agents/compliance/embargo/doEmbargoCheck", () => ({ doEmbargoCheck: vi.fn() }));
vi.mock("@/modules/classification/classification.service", () => ({
  ClassificationService: { classifyProduct: vi.fn() },
}));
vi.mock("@/modules/compliance/executionHistory", () => ({ recordComplianceExecution: vi.fn() }));
vi.mock("@/lib/billing/telemetry", () => ({ recordUsageEvent: vi.fn() }));

const { processBatchRecord } = await import("@/modules/complianceBatch/processing");

function palRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec_1",
    batchId: "batch_1",
    correlationId: "corr_1",
    normalizedInput: { partyId: "party_1", reason: "Reviewed", expiresAt: null },
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.complianceBatch.findUnique.mockResolvedValue({ batchType: "PRE_APPROVED_PARTY_IMPORT", createdByUserId: "user_1" });
  dbMock.batchRecord.update.mockResolvedValue({});
});

describe("processBatchRecord: PRE_APPROVED_PARTY_IMPORT branch", () => {
  it("calls createPreApproval with the row's fields and marks the record PASSED", async () => {
    createPreApproval.mockResolvedValue({ id: "approval_1" });

    await processBatchRecord("acct_1", palRecord());

    expect(createPreApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct_1",
        partyId: "party_1",
        approvedByUserId: "user_1",
        reason: "Reviewed",
        expiresAt: null,
        requestId: "corr_1",
      })
    );
    expect(dbMock.batchRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rec_1" },
        data: expect.objectContaining({ processingStatus: "COMPLETED", complianceStatus: "PASSED" }),
      })
    );
  });

  it("marks the record FAILED (not ERROR) when the party doesn't exist for this account", async () => {
    createPreApproval.mockRejectedValue(new PartyNotFoundForApprovalError("Party not found"));

    await processBatchRecord("acct_1", palRecord());

    expect(dbMock.batchRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rec_1" },
        data: expect.objectContaining({ processingStatus: "COMPLETED", complianceStatus: "FAILED" }),
      })
    );
  });

  it("marks the record ERROR on an unexpected exception", async () => {
    createPreApproval.mockRejectedValue(new Error("db exploded"));

    await processBatchRecord("acct_1", palRecord());

    expect(dbMock.batchRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rec_1" },
        data: expect.objectContaining({ processingStatus: "ERROR", complianceStatus: "ERROR" }),
      })
    );
  });

  it("falls back to 'system' as approvedByUserId when the batch has no createdByUserId", async () => {
    dbMock.complianceBatch.findUnique.mockResolvedValue({ batchType: "PRE_APPROVED_PARTY_IMPORT", createdByUserId: null });
    createPreApproval.mockResolvedValue({ id: "approval_1" });

    await processBatchRecord("acct_1", palRecord());

    expect(createPreApproval).toHaveBeenCalledWith(expect.objectContaining({ approvedByUserId: "system" }));
  });
});
