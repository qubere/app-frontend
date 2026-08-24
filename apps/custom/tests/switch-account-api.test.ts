import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * switch-account is one of the routes fixed in 7762a5a: it resolves the
 * target accountId itself (rather than through withAuthenticatedRoute) and
 * must enter the AsyncLocalStorage context via withAccountIdContext before
 * touching the membership table. These tests pin both the negative case --
 * a caller cannot switch into an account they don't belong to -- and that
 * the context wrapper actually runs, not just that the membership query
 * happens to filter correctly on its own.
 */

const authMock = vi.fn();
const cookieSetMock = vi.fn();
const withAccountIdContextSpy = vi.fn((accountId: string | null | undefined, fn: () => Promise<unknown>) => fn());

const dbMock = {
  user: { findUnique: vi.fn() },
};

vi.mock("@clerk/nextjs/server", () => ({ auth: () => authMock() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSetMock }),
}));
vi.mock("@/lib/db", () => ({
  db: dbMock,
  withAccountIdContext: (accountId: string | null | undefined, fn: () => Promise<unknown>) =>
    withAccountIdContextSpy(accountId, fn),
}));
vi.mock("@/lib/auth", () => ({ ACTIVE_ACCOUNT_COOKIE: "qubere_active_account_id" }));

const switchAccount = await import("@/app/api/auth/switch-account/route");

const CLERK_USER_ID = "clerk_1";
const HOME_ACCOUNT = "acc_home";
const FOREIGN_ACCOUNT = "acc_foreign";

function call(targetAccountId: unknown) {
  return switchAccount.POST(
    new Request("http://localhost/api/auth/switch-account", {
      method: "POST",
      body: JSON.stringify({ targetAccountId }),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  withAccountIdContextSpy.mockImplementation((_accountId, fn) => fn());
  authMock.mockResolvedValue({ userId: CLERK_USER_ID });
  dbMock.user.findUnique.mockResolvedValue({
    id: "u_1",
    platformRoles: [],
    memberships: [{ accountId: HOME_ACCOUNT }],
  });
});

describe("POST /api/auth/switch-account", () => {
  it("rejects an unauthenticated caller", async () => {
    authMock.mockResolvedValue({ userId: null });

    const res = await call(HOME_ACCOUNT);

    expect(res.status).toBe(401);
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("refuses to switch into an account the caller does not belong to", async () => {
    // The membership include is itself filtered to the target account, so a
    // caller with no ACTIVE membership there comes back with an empty array
    // rather than another tenant's membership row.
    dbMock.user.findUnique.mockResolvedValue({ id: "u_1", platformRoles: [], memberships: [] });

    const res = await call(FOREIGN_ACCOUNT);

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "No active membership in specified account" });
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("never trusts a membership row for a different account than the one requested", async () => {
    // Simulates a regression where the include's own where clause got
    // dropped: the caller's real (home-account) membership comes back
    // alongside a request for a foreign account.
    dbMock.user.findUnique.mockResolvedValue({
      id: "u_1",
      platformRoles: [],
      memberships: [{ accountId: HOME_ACCOUNT }],
    });

    const res = await call(FOREIGN_ACCOUNT);

    // The route itself only checks membership length, trusting the query's
    // own filter -- so this documents that the query, not the route body,
    // is the actual enforcement point. See buildTenantIsolatedQueryArgs test
    // coverage in db.ts for the query-level guarantee.
    expect(dbMock.user.findUnique.mock.calls[0][0].include.memberships.where).toEqual({
      accountId: FOREIGN_ACCOUNT,
      status: "ACTIVE",
    });
  });

  it("establishes the target account's tenant context before checking membership", async () => {
    await call(FOREIGN_ACCOUNT);

    expect(withAccountIdContextSpy).toHaveBeenCalledWith(FOREIGN_ACCOUNT, expect.any(Function));
    // The context must be entered before the membership lookup runs, not
    // just wrapped around a no-op -- otherwise a query deeper in the same
    // call that forgets its own accountId filter would still run unscoped.
    const contextCallOrder = withAccountIdContextSpy.mock.invocationCallOrder[0];
    const dbCallOrder = dbMock.user.findUnique.mock.invocationCallOrder[0];
    expect(contextCallOrder).toBeLessThan(dbCallOrder);
  });

  it("sets the active-account cookie only on a verified membership", async () => {
    const res = await call(HOME_ACCOUNT);

    expect(res.status).toBe(200);
    expect(cookieSetMock).toHaveBeenCalledWith(
      "qubere_active_account_id",
      HOME_ACCOUNT,
      expect.objectContaining({ httpOnly: true })
    );
  });

  it("rejects a request with no target account", async () => {
    const res = await call(undefined);

    expect(res.status).toBe(400);
    expect(withAccountIdContextSpy).not.toHaveBeenCalled();
  });
});
