import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    party: { findMany: vi.fn(), count: vi.fn() },
    product: { findMany: vi.fn(), count: vi.fn() },
    shipmentDocument: { findMany: vi.fn(), count: vi.fn() },
    shipment: { findMany: vi.fn(), count: vi.fn() },
    client: { findMany: vi.fn(), count: vi.fn() },
    importerOfRecord: { findMany: vi.fn(), count: vi.fn() },
    accountMembership: { findMany: vi.fn(), count: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
// Never let a unit test depend on network/Gemini reachability -- the
// semantic-suggestions lane only needs *a* vector here, not a real one.
vi.mock("@/modules/memory/memory.retriever", () => ({
  HybridMemoryRetriever: { embedQuery: vi.fn().mockResolvedValue(new Array(768).fill(0.01)) },
}));

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
    mocks.db.shipment.findMany.mockResolvedValue([]);
    mocks.db.shipment.count.mockResolvedValue(0);
    mocks.db.client.findMany.mockResolvedValue([]);
    mocks.db.client.count.mockResolvedValue(0);
    mocks.db.importerOfRecord.findMany.mockResolvedValue([]);
    mocks.db.importerOfRecord.count.mockResolvedValue(0);
    mocks.db.accountMembership.findMany.mockResolvedValue([]);
    mocks.db.accountMembership.count.mockResolvedValue(0);
    mocks.db.$queryRaw.mockResolvedValue([]);
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
    expect(mocks.db.shipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId }) })
    );
    expect(mocks.db.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId }) })
    );
    expect(mocks.db.importerOfRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId }) })
    );
    expect(mocks.db.accountMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId }) })
    );
  });

  it("does not split the result budget evenly across kinds -- a query matching only parties returns up to the full limit of parties", async () => {
    const manyParties = Array.from({ length: 10 }, (_, i) => ({
      id: `party_${i}`,
      internalPartyCode: `PRT-${i}`,
      status: "ACTIVE",
      reviewStatus: "APPROVED",
      updatedAt: new Date(),
      names: [{ rawName: `Acme Corp ${i}`, isPrimary: true, nameType: "LEGAL" }],
      identifiers: [],
      evidence: [],
    }));
    mocks.db.party.findMany.mockResolvedValue(manyParties);
    mocks.db.party.count.mockResolvedValue(10);

    const res = await unifiedSearch({ accountId, query: "Acme", limit: 10 });

    expect(res.results.length).toBe(10);
  });

  it("surfaces shipment and person kinds, and ranks a shipment above other kinds on a query that matches all of them equally", async () => {
    mocks.db.shipment.findMany.mockResolvedValue([
      { id: "shp_1", shipmentNumber: "acme", status: "In Progress", updatedAt: new Date("2026-01-01"), client: { name: "Acme" } },
    ]);
    mocks.db.shipment.count.mockResolvedValue(1);
    mocks.db.client.findMany.mockResolvedValue([
      { id: "cli_1", name: "acme", status: "ACTIVE", updatedAt: new Date("2026-06-01") },
    ]);
    mocks.db.client.count.mockResolvedValue(1);
    mocks.db.accountMembership.findMany.mockResolvedValue([
      { userId: "usr_1", updatedAt: new Date("2026-06-01"), user: { firstName: "Acme", lastName: null, email: "acme@example.com" } },
    ]);
    mocks.db.accountMembership.count.mockResolvedValue(1);

    const res = await unifiedSearch({ accountId, query: "acme" });

    expect(res.results.map((r) => r.kind)).toContain("shipment");
    expect(res.results.map((r) => r.kind)).toContain("person");
    expect(res.results.map((r) => r.kind)).toContain("client");
    // Client has the oldest updatedAt but ties on exact-title match quality,
    // so kind priority (shipment > person > client) must be what orders these.
    expect(res.results[0].kind).toBe("shipment");
  });

  it("returns semantic suggestions from the search index without duplicating exact results", async () => {
    mocks.db.$queryRaw.mockResolvedValue([
      { kind: "hts_node", entityId: "hts_1", title: "8541.40.6025", subtitle: "Solar cells", href: "/app/hts?code=8541.40.6025", similarity: 0.82 },
    ]);

    const res = await unifiedSearch({ accountId, query: "solar panel" });

    expect(res.suggestions).toHaveLength(1);
    expect(res.suggestions[0]).toMatchObject({ kind: "hts_node", entityId: "hts_1" });
  });

  it("skips the semantic suggestions lane when includeSuggestions is false", async () => {
    const res = await unifiedSearch({ accountId, query: "acme", includeSuggestions: false });

    expect(res.suggestions).toEqual([]);
    expect(mocks.db.$queryRaw).not.toHaveBeenCalled();
  });
});
