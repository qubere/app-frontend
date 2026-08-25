import { beforeEach, describe, expect, it, vi } from "vitest";

// A quarantined InboundEmail has no accountId by definition (see
// quarantineReview.ts) -- filtering the list query by ctx.accountId for a
// non-platform-admin therefore always returned zero rows while still
// running the query, silently making the Docs "Quarantine" tab look
// empty for every tenant. This pins the fix: non-admins get an empty
// result without a wasted (and namespace-confusing) query, and platform
// admins still see the full cross-tenant queue.

const { ctxMock, listQuarantinedInboundEmailsMock, accountFindManyMock } = vi.hoisted(() => ({
  ctxMock: {
    accountId: "acct_a",
    accountName: "Acme Broker",
    accountType: "BROKER",
    userId: "user_1",
    isPlatformAdmin: false,
  },
  listQuarantinedInboundEmailsMock: vi.fn(async () => [{ id: "qe_1" }, { id: "qe_2" }]),
  accountFindManyMock: vi.fn(async () => [{ id: "acct_a", name: "Acme Broker", type: "BROKER" }]),
}));

vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: (args: unknown) => unknown) => (req: Request) =>
    handler({ req, ctx: ctxMock, requestId: "req_test" }),
}));

vi.mock("@/modules/inbound/quarantineReview", () => ({
  listQuarantinedInboundEmails: listQuarantinedInboundEmailsMock,
}));

vi.mock("@/lib/db", () => ({
  db: { account: { findMany: accountFindManyMock } },
}));

const { GET } = await import("@/app/api/documents/quarantine/route");

beforeEach(() => {
  vi.clearAllMocks();
  ctxMock.isPlatformAdmin = false;
});

describe("GET /api/documents/quarantine", () => {
  it("returns an empty queue for a non-platform-admin without querying quarantined emails", async () => {
    const res = await GET(new Request("http://test/api/documents/quarantine"), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(body.items).toEqual([]);
    expect(body.canRouteAcrossAccounts).toBe(false);
    expect(listQuarantinedInboundEmailsMock).not.toHaveBeenCalled();
  });

  it("returns the full cross-tenant queue for a platform admin", async () => {
    ctxMock.isPlatformAdmin = true;

    const res = await GET(new Request("http://test/api/documents/quarantine"), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(body.items).toEqual([{ id: "qe_1" }, { id: "qe_2" }]);
    expect(body.canRouteAcrossAccounts).toBe(true);
    expect(listQuarantinedInboundEmailsMock).toHaveBeenCalledWith();
  });
});
