import { beforeEach, describe, expect, it, vi } from "vitest";

// #331 Phase 1: getParty/getProduct now resolve PartyEvidence/ProductEvidence's
// sourceDocument relation (fileName + shipment), so the Evidence tab can link to the
// real document and shipment instead of showing the literal string "A document in
// this account". This only checks that the Prisma query actually asks for that
// relation -- the rendering itself is plain JSX, exercised visually in step 10.

const mocks = vi.hoisted(() => ({
  db: { party: { findFirst: vi.fn() }, product: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ db: mocks.db }));

const { getParty } = await import("../src/modules/party/partyService");
const { getProduct } = await import("../src/modules/product/productService");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.party.findFirst.mockResolvedValue({ id: "party-1" });
  mocks.db.product.findFirst.mockResolvedValue({ id: "product-1" });
});

describe("evidence lineage (#331 Phase 1)", () => {
  it("getParty resolves each evidence row's source document and shipment", async () => {
    await getParty({ accountId: "acct-1", userId: "user-1" }, "party-1");

    const call = mocks.db.party.findFirst.mock.calls[0]![0];
    expect(call.include.evidence.include.sourceDocument.select).toEqual(
      expect.objectContaining({
        fileName: true,
        shipmentId: true,
        shipment: { select: { id: true, shipmentNumber: true } },
      })
    );
  });

  it("getProduct resolves each evidence row's source document and shipment", async () => {
    await getProduct({ accountId: "acct-1", userId: "user-1" }, "product-1");

    const call = mocks.db.product.findFirst.mock.calls[0]![0];
    expect(call.include.evidence.include.sourceDocument.select).toEqual(
      expect.objectContaining({
        fileName: true,
        shipmentId: true,
        shipment: { select: { id: true, shipmentNumber: true } },
      })
    );
  });
});
