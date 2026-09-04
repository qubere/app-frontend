import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    client: { findFirst: vi.fn() },
    legalEntity: { create: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: (args: { req: Request; ctx: { accountId: string; userId: string } }) => unknown) =>
    (req: Request) => handler({ req, ctx: { accountId: "broker-1", userId: "user-1" } }),
}));

const resolvePartyForCompany = vi.fn();
vi.mock("@/modules/party/partyResolutionService", () => ({
  resolvePartyForCompany: (...args: unknown[]) => resolvePartyForCompany(...args),
}));

const { POST } = await import("../src/app/api/legal-entities/route");

function request(body: unknown) {
  return new Request("http://custom/api/legal-entities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.client.findFirst.mockResolvedValue({ id: "client-1" });
  mocks.db.legalEntity.create.mockResolvedValue({ id: "party-1", legalName: "Northwind Supplier GmbH" });
  resolvePartyForCompany.mockResolvedValue({ outcome: "CREATED", partyId: "party-master-1", party: { id: "party-master-1" } });
});

describe("legal entity/importer boundary", () => {
  it("rejects CBP identity fields outside the importer workflow", async () => {
    const response = await POST(request({
      clientId: "client-1",
      legalName: "Northwind Foods LLC",
      cbpImporterNumber: "12-345678900",
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "IMPORTER_WORKFLOW_REQUIRED", href: "/app/importers" },
    });
    expect(mocks.db.legalEntity.create).not.toHaveBeenCalled();
  });

  it("creates a trade party without a customs profile", async () => {
    const response = await POST(request({
      clientId: "client-1",
      legalName: "Northwind Supplier GmbH",
      country: "DE",
    }));

    expect(response.status).toBe(201);
    expect(mocks.db.legalEntity.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({ customsProfiles: expect.anything() }),
      include: { client: true, importerOfRecord: true },
    });
  });

  it("resolves and links a Party for the new trade party (#320 Phase 1)", async () => {
    await POST(request({ clientId: "client-1", legalName: "Northwind Supplier GmbH", country: "DE" }));

    expect(resolvePartyForCompany).toHaveBeenCalledWith(
      { accountId: "broker-1", userId: "user-1", requestId: null },
      expect.objectContaining({ legalName: "Northwind Supplier GmbH", country: "DE" })
    );
    expect(mocks.db.legalEntity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ partyId: "party-master-1" }),
      include: { client: true, importerOfRecord: true },
    });
  });

  it("defaults the resolution country to US, matching the row it writes, when none is supplied", async () => {
    await POST(request({ legalName: "No Country Co" }));
    const [, resolveInput] = resolvePartyForCompany.mock.calls[0]!;
    expect(resolveInput.country).toBe("US");
  });

  it("never rejects the whole workflow when party resolution finds only candidates or fails", async () => {
    resolvePartyForCompany.mockResolvedValue({ outcome: "CANDIDATES", status: "AMBIGUOUS", candidates: [] });
    const first = await POST(request({ legalName: "Ambiguous Co", country: "US" }));
    expect(first.status).toBe(201);
    expect(mocks.db.legalEntity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ partyId: null }),
      include: { client: true, importerOfRecord: true },
    });

    resolvePartyForCompany.mockRejectedValue(new Error("screening down"));
    const second = await POST(request({ legalName: "Failing Co", country: "US" }));
    expect(second.status).toBe(201);
  });

  it("never resolves a party for a request the CBP-workflow guard already rejected", async () => {
    await POST(request({ clientId: "client-1", legalName: "Northwind Foods LLC", cbpImporterNumber: "12-345678900" }));
    expect(resolvePartyForCompany).not.toHaveBeenCalled();
  });
});
