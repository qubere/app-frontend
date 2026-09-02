import { describe, it, expect, vi } from "vitest";
import { authorizePortalResource, resolvePortalClientScope } from "./portal-auth";
import * as authModule from "./auth";
import * as scopeModule from "./scope-engine";

vi.mock("./auth", () => ({
  getAccountContext: vi.fn(),
}));

vi.mock("./scope-engine", () => ({
  getEffectiveUserScope: vi.fn(),
}));

describe("authorizePortalResource Engine", () => {
  const mockAccountContext = {
    userId: "usr_123",
    accountId: "acc_456",
    userEmail: "customer@clienta.com",
    roleNames: ["CUSTOMER_USER"],
    permissions: ["portal.shipments.read"],
    isPlatformAdmin: false,
  };

  it("should fail with 401 when no active identity exists", async () => {
    vi.mocked(authModule.getAccountContext).mockResolvedValueOnce(null);

    const result = await authorizePortalResource({
      permission: "portal.shipments.read",
      resourceAccountId: "acc_456",
      resourceClientId: "cli_789",
    });

    expect(result.authorized).toBe(false);
    expect(result.errorResponse?.status).toBe(401);
  });

  it("should fail closed with 404 when accountId mismatches", async () => {
    vi.mocked(authModule.getAccountContext).mockResolvedValueOnce(mockAccountContext as any);

    const result = await authorizePortalResource({
      permission: "portal.shipments.read",
      resourceAccountId: "acc_OTHER",
      resourceClientId: "cli_789",
    });

    expect(result.authorized).toBe(false);
    expect(result.errorResponse?.status).toBe(404);
  });

  it("should fail closed with 404 when resource has null/unresolved clientId", async () => {
    vi.mocked(authModule.getAccountContext).mockResolvedValueOnce(mockAccountContext as any);
    vi.mocked(scopeModule.getEffectiveUserScope).mockResolvedValueOnce({
      isAllClients: false,
      authorizedClientIds: ["cli_789"],
      teamIds: [],
    });

    const result = await authorizePortalResource({
      permission: "portal.shipments.read",
      resourceAccountId: "acc_456",
      resourceClientId: null,
    });

    expect(result.authorized).toBe(false);
    expect(result.errorResponse?.status).toBe(404);
  });

  it("should fail closed with 404 when clientId is outside user's authorizedClientIds", async () => {
    vi.mocked(authModule.getAccountContext).mockResolvedValueOnce(mockAccountContext as any);
    vi.mocked(scopeModule.getEffectiveUserScope).mockResolvedValueOnce({
      isAllClients: false,
      authorizedClientIds: ["cli_ALLOWED"],
      teamIds: [],
    });

    const result = await authorizePortalResource({
      permission: "portal.shipments.read",
      resourceAccountId: "acc_456",
      resourceClientId: "cli_OTHER_CLIENT",
    });

    expect(result.authorized).toBe(false);
    expect(result.errorResponse?.status).toBe(404);
  });

  it("should succeed when accountId matches and clientId is within scope", async () => {
    vi.mocked(authModule.getAccountContext).mockResolvedValueOnce(mockAccountContext as any);
    vi.mocked(scopeModule.getEffectiveUserScope).mockResolvedValueOnce({
      isAllClients: false,
      authorizedClientIds: ["cli_789"],
      teamIds: [],
    });

    const result = await authorizePortalResource({
      permission: "portal.shipments.read",
      resourceAccountId: "acc_456",
      resourceClientId: "cli_789",
      portalVisibility: "CUSTOMER",
    });

    expect(result.authorized).toBe(true);
    expect(result.effectiveClientId).toBe("cli_789");
    expect(result.errorResponse).toBeNull();
  });

  it("should fail closed with 404 when the caller lacks the required permission", async () => {
    vi.mocked(authModule.getAccountContext).mockResolvedValueOnce({
      ...mockAccountContext,
      roleNames: ["CUSTOMER_VIEWER"],
      permissions: ["portal.shipments.read"], // has read, NOT respond
    } as any);

    const result = await authorizePortalResource({
      permission: "portal.requests.respond",
      resourceAccountId: "acc_456",
      resourceClientId: "cli_789",
    });

    expect(result.authorized).toBe(false);
    expect(result.errorResponse?.status).toBe(404);
  });
});

describe("resolvePortalClientScope", () => {
  it("restricts a scoped caller to their assignments when no client is requested", () => {
    const r = resolvePortalClientScope({ isAllClients: false, authorizedClientIds: ["a", "b"] }, undefined);
    expect(r).toEqual({ clientIds: ["a", "b"], forbidden: false });
  });

  it("returns an empty (fail-closed) set for a scoped caller with no assignments", () => {
    const r = resolvePortalClientScope({ isAllClients: false, authorizedClientIds: [] }, undefined);
    expect(r).toEqual({ clientIds: [], forbidden: false });
  });

  it("forbids a caller-supplied clientId outside the caller's scope", () => {
    const r = resolvePortalClientScope({ isAllClients: false, authorizedClientIds: ["a"] }, "b");
    expect(r.forbidden).toBe(true);
    expect(r.clientIds).toEqual([]);
  });

  it("allows a caller-supplied clientId inside the caller's scope", () => {
    const r = resolvePortalClientScope({ isAllClients: false, authorizedClientIds: ["a", "b"] }, "b");
    expect(r).toEqual({ clientIds: ["b"], forbidden: false });
  });

  it("lets an all-clients caller through unrestricted", () => {
    const r = resolvePortalClientScope({ isAllClients: true, authorizedClientIds: [] }, undefined);
    expect(r).toEqual({ clientIds: null, forbidden: false });
  });
});

describe('Entry Proof and setup permissions',()=>{
 it.each(['portal.entries.comment','portal.setup.read'])('rejects cross-workspace %s with the real authorization engine',async permission=>{
  vi.mocked(authModule.getAccountContext).mockResolvedValue({accountId:'a',userId:'u',roleNames:['CUSTOMER_USER'],permissions:[permission]} as any);
  vi.mocked(scopeModule.getEffectiveUserScope).mockResolvedValue({isAllClients:false,authorizedClientIds:['target'],teamIds:[]} as any);
  expect((await authorizePortalResource({permission,resourceAccountId:'amazon-workspace',resourceClientId:'amazon'})).errorResponse?.status).toBe(404);
 });
 it('does not let a viewer submit line questions',async()=>{
  vi.mocked(authModule.getAccountContext).mockResolvedValue({accountId:'a',userId:'u',roleNames:['CUSTOMER_VIEWER'],permissions:['portal.setup.read','portal.entries.read']} as any);
  expect((await authorizePortalResource({permission:'portal.entries.comment',resourceAccountId:'a',resourceClientId:'target',customerVisibleAt:new Date()})).errorResponse?.status).toBe(404);
 });
});
