import { beforeEach, describe, expect, it, vi } from "vitest";

// GET /api/importers/[id]'s "Also known as" wiring (#320 spec §3.5). The
// summary math itself is covered by also-known-as.test.ts; this only checks
// that the route fetches the right shape and attaches `party` to the
// response the way the spec's API table (§4) describes.

const mocks = vi.hoisted(() => ({
  db: { importerOfRecord: { findFirst: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: (args: { ctx: { accountId: string }; params: { id: string }; requestId: string }) => unknown) =>
    () => handler({ ctx: { accountId: "broker-1" }, params: { id: "importer-1" }, requestId: "req-1" }),
}));

const { GET } = await import("../src/app/api/importers/[id]/route");

const baseImporter = {
  id: "importer-1",
  registrationStatus: "pending_5106",
  bond: null,
  powersOfAttorney: [],
  onboardingEntities: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/importers/[id] -- also known as", () => {
  it("returns party: null when the legal entity has no party link yet", async () => {
    mocks.db.importerOfRecord.findFirst.mockResolvedValue({ ...baseImporter, legalEntity: { id: "legal-1", party: null } });

    const response = await GET(new Request("http://custom/api/importers/importer-1"));
    const body = await response.json();

    expect(body.importer.party).toBeNull();
  });

  it("returns party: null when the importer has no legal entity at all", async () => {
    mocks.db.importerOfRecord.findFirst.mockResolvedValue({ ...baseImporter, legalEntity: null });

    const response = await GET(new Request("http://custom/api/importers/importer-1"));
    const body = await response.json();

    expect(body.importer.party).toBeNull();
  });

  it("surfaces roles and the also-known-as summary for a bridged, multi-role party", async () => {
    mocks.db.importerOfRecord.findFirst.mockResolvedValue({
      ...baseImporter,
      legalEntity: {
        id: "legal-1",
        party: {
          id: "party-1",
          roles: [
            { roleType: "IMPORTER", status: "ACTIVE" },
            { roleType: "SUPPLIER", status: "ACTIVE" },
          ],
          legalEntities: [
            { id: "legal-1", _count: { productParties: 0, shipmentParties: 3 } },
            { id: "legal-2", _count: { productParties: 6, shipmentParties: 0 } },
          ],
        },
      },
    });

    const response = await GET(new Request("http://custom/api/importers/importer-1"));
    const body = await response.json();

    expect(body.importer.party).toEqual({
      id: "party-1",
      roles: [
        { roleType: "IMPORTER", status: "ACTIVE" },
        { roleType: "SUPPLIER", status: "ACTIVE" },
      ],
      alsoKnownAs: {
        otherRoles: ["SUPPLIER"],
        linkedLegalEntityCount: 1,
        productPartyCount: 6,
        shipmentPartyCount: 3,
      },
    });
  });

  it("404s for an importer outside this account without ever touching party data", async () => {
    mocks.db.importerOfRecord.findFirst.mockResolvedValue(null);

    const response = await GET(new Request("http://custom/api/importers/importer-1"));
    expect(response.status).toBe(404);
  });
});
