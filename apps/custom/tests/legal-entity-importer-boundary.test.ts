import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    client: { findFirst: vi.fn() },
    legalEntity: { create: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: (args: { req: Request; ctx: { accountId: string } }) => unknown) =>
    (req: Request) => handler({ req, ctx: { accountId: "broker-1" } }),
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
});
