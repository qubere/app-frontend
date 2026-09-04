import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    party: { findMany: vi.fn(), count: vi.fn() },
    product: { findMany: vi.fn(), count: vi.fn() },
    shipmentDocument: { findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));

const { unifiedSearch } = await import("../src/modules/search/unifiedSearchService");

describe("Unified Search Service (#342 Phase 4)", () => {
  const accountId = "acc_test_unified_search";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.party.findMany.mockResolvedValue([]);
    mocks.db.party.count.mockResolvedValue(0);
    mocks.db.product.findMany.mockResolvedValue([]);
    mocks.db.product.count.mockResolvedValue(0);
    mocks.db.shipmentDocument.findMany.mockResolvedValue([]);
    mocks.db.shipmentDocument.count.mockResolvedValue(0);
  });

  it("returns empty result for empty or whitespace query", async () => {
    const res = await unifiedSearch({ accountId, query: "   " });
    expect(res.results).toEqual([]);
    expect(res.total).toBe(0);
  });

  it("searches and returns federated Party and Product records with kind discriminants", async () => {
    const mockParty = {
      id: "party_123",
      internalPartyCode: "PRT-GLOBEX-100",
      status: "ACTIVE",
      reviewStatus: "APPROVED",
      updatedAt: new Date("2026-09-04T12:00:00Z"),
      names: [{ rawName: "Globex Logistics International", isPrimary: true, nameType: "LEGAL" }],
      identifiers: [],
      evidence: [{ sourceDocumentId: "doc-party", sourceDocument: { fileName: "supplier.pdf" } }],
    };

    const mockProduct = {
      id: "prod_456",
      productName: "Globex High Capacity Router",
      internalSku: "SKU-GLOBEX-900",
      status: "ACTIVE",
      reviewStatus: "APPROVED",
      updatedAt: new Date("2026-09-04T13:00:00Z"),
      brand: null,
      model: null,
      commercialDescription: null,
      customsDescription: null,
      identifiers: [],
      classifications: [],
      evidence: [{ sourceDocumentId: "doc-product", sourceDocument: { fileName: "catalog.pdf" } }],
    };

    mocks.db.party.findMany.mockResolvedValue([mockParty]);
    mocks.db.party.count.mockResolvedValue(1);
    mocks.db.product.findMany.mockResolvedValue([mockProduct]);
    mocks.db.product.count.mockResolvedValue(1);

    const res = await unifiedSearch({ accountId, query: "Globex" });
    expect(res.total).toBe(2);
    expect(res.results.length).toBe(2);

    const partyResult = res.results.find((r) => r.kind === "party");
    const productResult = res.results.find((r) => r.kind === "product");

    expect(partyResult).toBeDefined();
    expect(partyResult?.id).toBe("party_123");
    expect(partyResult?.title).toBe("Globex Logistics International");
    expect(partyResult?.matchReason).toBe("Party name");
    expect(partyResult?.sourceLabel).toBe("supplier.pdf");
    expect(partyResult?.href).toBe("/app/parties/party_123?tab=evidence");

    expect(productResult).toBeDefined();
    expect(productResult?.id).toBe("prod_456");
    expect(productResult?.title).toBe("Globex High Capacity Router");
    expect(productResult?.matchReason).toBe("Product name");
    expect(productResult?.sourceLabel).toBe("catalog.pdf");
    expect(productResult?.href).toBe("/app/products/prod_456?tab=evidence");
  });

  it("returns parsed document matches with the exact extracted field and source", async () => {
    mocks.db.shipmentDocument.findMany.mockResolvedValue([{
      id: "doc_123",
      fileName: "commercial-invoice.pdf",
      docType: "Commercial Invoice",
      status: "Received",
      uploadedByName: "Alex",
      uploadedByEmail: "alex@example.com",
      updatedAt: new Date("2026-09-04T14:00:00Z"),
      shipment: { shipmentNumber: "SHP-100" },
      extractionFields: [{ fieldName: "exporter.name", value: "BASF SE" }],
    }]);
    mocks.db.shipmentDocument.count.mockResolvedValue(1);

    const res = await unifiedSearch({ accountId, query: "basf" });

    expect(res.total).toBe(1);
    expect(res.results[0]).toMatchObject({
      id: "doc_123",
      kind: "document",
      matchReason: "exporter.name: BASF SE",
      sourceLabel: "commercial-invoice.pdf",
      sourceDocumentId: "doc_123",
      href: "/api/documents/proxy?documentId=doc_123",
    });
  });

  it("enforces tenant account isolation in database query", async () => {
    mocks.db.party.findMany.mockResolvedValue([]);
    mocks.db.party.count.mockResolvedValue(0);
    mocks.db.product.findMany.mockResolvedValue([]);
    mocks.db.product.count.mockResolvedValue(0);

    await unifiedSearch({ accountId, query: "Globex" });

    expect(mocks.db.party.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId }),
      })
    );
    expect(mocks.db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId }),
      })
    );
    expect(mocks.db.shipmentDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId }),
      })
    );
  });
});
