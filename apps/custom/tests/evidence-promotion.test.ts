import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    productEvidence: { findFirst: vi.fn(), create: vi.fn() },
    partyEvidence: { findFirst: vi.fn(), create: vi.fn() },
    shipmentLineItem: { findFirst: vi.fn(), create: vi.fn() },
    fact: { createMany: vi.fn() },
    party: { findFirst: vi.fn() },
    partyRole: { findFirst: vi.fn() },
  },
  findProductMatches: vi.fn(),
  findPartyMatches: vi.fn(),
  getParty: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/modules/product/productService", () => ({
  findProductMatches: mocks.findProductMatches,
}));
vi.mock("@/modules/party/partyService", () => ({
  findPartyMatches: mocks.findPartyMatches,
  getParty: mocks.getParty,
  PartyNotFoundError: class extends Error {},
}));

const { LineItemReconciler } = await import("../src/modules/shipment/lineItemReconciler");
const { resolvePartyForCompany } = await import("../src/modules/party/partyResolutionService");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Exact Party & Product evidence promotion", () => {
  it("creates a ProductEvidence record when line item reconciler matches an exact product with document context", async () => {
    mocks.findProductMatches.mockResolvedValue({
      status: "EXACT_MATCH",
      candidates: [{ productId: "prod-100" }],
    });
    mocks.db.productEvidence.findFirst.mockResolvedValue(null);
    mocks.db.shipmentLineItem.create.mockResolvedValue({ id: "line-1" });

    await LineItemReconciler.applyDiscoveries({
      shipmentId: "ship-1",
      accountId: "acct-1",
      documentId: "doc-100",
      sourceType: "EXTRACTED",
      items: [
        { lineNumber: 1, partNumber: "SKU-EXACT", description: "Exact Widget", quantity: 5, unitPrice: 10 },
      ],
    });

    expect(mocks.db.productEvidence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: "acct-1",
        productId: "prod-100",
        sourceDocumentId: "doc-100",
      }),
    });
  });

  it("creates a PartyEvidence record when resolvePartyForCompany matches an exact party with sourceDocumentId", async () => {
    mocks.findPartyMatches.mockResolvedValue({
      status: "EXACT_MATCH",
      candidates: [{ partyId: "party-200" }],
    });
    mocks.getParty.mockResolvedValue({ id: "party-200" });
    mocks.db.partyEvidence.findFirst.mockResolvedValue(null);

    const result = await resolvePartyForCompany(
      { accountId: "acct-1", userId: "usr-1" },
      {
        legalName: "Acme Logistics",
        country: "US",
        sourceDocumentId: "doc-200",
        sourceType: "DOCUMENT",
      }
    );

    expect(result.outcome).toBe("EXACT");
    expect(mocks.db.partyEvidence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: "acct-1",
        partyId: "party-200",
        sourceDocumentId: "doc-200",
      }),
    });
  });
});
