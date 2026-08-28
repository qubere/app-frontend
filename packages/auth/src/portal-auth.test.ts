import { describe, it, expect, vi } from "vitest";
import { authorizePortalResource } from "./portal-auth";
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
});
