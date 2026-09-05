import { beforeEach, describe, expect, it, vi } from "vitest";

// #331 Phase 3: Ambiguous-match review lane (#341)
// Tests proposal recording, tenant-scoped listing, confirmation/creation/rejection
// decisions, and evidence provenance writing.

const mocks = vi.hoisted(() => ({
  db: {
    pendingMatchProposal: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    partyEvidence: { create: vi.fn() },
    productEvidence: { create: vi.fn() },
    party: { create: vi.fn(), findUnique: vi.fn() },
    product: { create: vi.fn(), findUnique: vi.fn() },
    legalEntity: { findFirst: vi.fn(), create: vi.fn() },
    shipmentParty: { findFirst: vi.fn(), create: vi.fn() },
    shipmentLineItem: { updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/exceptions/createException", () => ({ createExceptionItem: vi.fn() }));

const {
  recordPendingMatchProposal,
  listPendingMatchProposals,
  resolveMatchProposal,
} = await import("../src/modules/matching/ambiguousMatchService");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Ambiguous Match Review Lane (#331 Phase 3 / #341)", () => {
  it("records a pending match proposal when a candidate match occurs", async () => {
    mocks.db.pendingMatchProposal.create.mockResolvedValue({
      id: "prop-1",
      accountId: "acct-1",
      domain: "PARTY",
      status: "PENDING",
    });

    await recordPendingMatchProposal({
      accountId: "acct-1",
      domain: "PARTY",
      matchStatus: "POSSIBLE_MATCH",
      targetEntityType: "SHIPMENT_PARTY",
      targetEntityId: "shipment-1",
      targetRole: "IMPORTER_OF_RECORD",
      inputPayload: { legalName: "Acme Corp", country: "US" },
      candidatesJson: [{ partyId: "party-cand-1", rule: "NAME_AND_BRAND" }],
    });

    expect(mocks.db.pendingMatchProposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acct-1",
          domain: "PARTY",
          matchStatus: "POSSIBLE_MATCH",
          targetEntityType: "SHIPMENT_PARTY",
          targetEntityId: "shipment-1",
          targetRole: "IMPORTER_OF_RECORD",
          status: "PENDING",
        }),
      })
    );
  });

  it("lists pending proposals with tenant scoping", async () => {
    mocks.db.pendingMatchProposal.findMany.mockResolvedValue([
      { id: "prop-1", domain: "PARTY", status: "PENDING" },
    ]);
    mocks.db.pendingMatchProposal.count.mockResolvedValue(1);

    const result = await listPendingMatchProposals(
      { accountId: "acct-1" },
      { domain: "PARTY", status: "PENDING" }
    );

    expect(result.total).toBe(1);
    expect(result.rows.length).toBe(1);
    expect(mocks.db.pendingMatchProposal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: "acct-1",
          domain: "PARTY",
          status: "PENDING",
        }),
      })
    );
  });

  it("confirms a party proposal, attaches party, and writes evidence provenance", async () => {
    mocks.db.pendingMatchProposal.findFirst.mockResolvedValue({
      id: "prop-1",
      accountId: "acct-1",
      domain: "PARTY",
      status: "PENDING",
      targetEntityType: "SHIPMENT_PARTY",
      targetEntityId: "shipment-1",
      targetRole: "IMPORTER_OF_RECORD",
      sourceDocumentId: "doc-1",
      inputPayload: { legalName: "Acme Corp", country: "US" },
    });
    mocks.db.legalEntity.findFirst.mockResolvedValue({ id: "le-1" });
    mocks.db.shipmentParty.findFirst.mockResolvedValue(null);
    mocks.db.pendingMatchProposal.update.mockResolvedValue({
      id: "prop-1",
      status: "CONFIRMED",
    });

    await resolveMatchProposal(
      { accountId: "acct-1", userId: "usr-1" },
      { proposalId: "prop-1", action: "CONFIRM", selectedPartyId: "party-selected-1" }
    );

    // Verify PartyEvidence was created
    expect(mocks.db.partyEvidence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acct-1",
          partyId: "party-selected-1",
          sourceType: "USER",
          sourceDocumentId: "doc-1",
        }),
      })
    );

    // Verify proposal status updated to CONFIRMED
    expect(mocks.db.pendingMatchProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prop-1" },
        data: expect.objectContaining({
          status: "CONFIRMED",
          resolvedPartyId: "party-selected-1",
          resolvedByUserId: "usr-1",
        }),
      })
    );
  });

  it("confirms a product proposal, updates line item productId, and writes evidence provenance", async () => {
    mocks.db.pendingMatchProposal.findFirst.mockResolvedValue({
      id: "prop-prod-1",
      accountId: "acct-1",
      domain: "PRODUCT",
      status: "PENDING",
      targetEntityType: "SHIPMENT_LINE_ITEM",
      targetEntityId: "line-item-1",
      sourceDocumentId: "doc-2",
      inputPayload: { partNumber: "SKU-99", description: "Gadget" },
    });
    mocks.db.pendingMatchProposal.update.mockResolvedValue({
      id: "prop-prod-1",
      status: "CONFIRMED",
    });

    await resolveMatchProposal(
      { accountId: "acct-1", userId: "usr-1" },
      { proposalId: "prop-prod-1", action: "CONFIRM", selectedProductId: "prod-selected-1" }
    );

    // Verify ProductEvidence was created
    expect(mocks.db.productEvidence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acct-1",
          productId: "prod-selected-1",
          sourceType: "USER",
          sourceDocumentId: "doc-2",
        }),
      })
    );

    // Verify ShipmentLineItem was updated with EXACT_MATCH
    expect(mocks.db.shipmentLineItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "line-item-1", accountId: "acct-1" },
        data: expect.objectContaining({
          productId: "prod-selected-1",
          productMatchStatus: "EXACT_MATCH",
        }),
      })
    );

    expect(mocks.db.pendingMatchProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prop-prod-1" },
        data: expect.objectContaining({
          status: "CONFIRMED",
          resolvedProductId: "prod-selected-1",
        }),
      })
    );
  });
});
