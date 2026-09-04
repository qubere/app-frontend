import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ctx: {
    accountId: "broker-1",
    userId: "user-1",
    isAllClients: false,
    authorizedClientIds: ["client-allowed"],
  },
  db: {
    importerOfRecord: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: (args: unknown) => unknown) => (req: Request) =>
    handler({ req, ctx: mocks.ctx, requestId: "request-1" }),
}));

const { GET } = await import("../src/app/api/importers/route");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ctx.isAllClients = false;
  mocks.ctx.authorizedClientIds = ["client-allowed"];
  mocks.db.importerOfRecord.findMany.mockResolvedValue([]);
});

describe("GET /api/importers client scope", () => {
  it("filters the registry to the caller's authorized clients", async () => {
    const response = await GET(new Request("http://custom/api/importers"));

    expect(response.status).toBe(200);
    expect(mocks.db.importerOfRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        accountId: "broker-1",
        clientId: { in: ["client-allowed"] },
      }),
    }));
  });

  it("rejects an explicit client outside the caller's scope", async () => {
    const response = await GET(new Request("http://custom/api/importers?client=client-other"));

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
    expect(mocks.db.importerOfRecord.findMany).not.toHaveBeenCalled();
  });
});
