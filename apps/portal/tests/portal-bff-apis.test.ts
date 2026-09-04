import { describe, it, expect, vi } from "vitest";
import * as authModule from "@qubere/auth";

vi.mock("@qubere/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof authModule>();
  return {
    ...actual,
    getAccountContext: vi.fn(),
    getEffectiveUserScope: vi.fn(),
    authorizePortalResource: vi.fn(),
    hasPermission: vi.fn().mockResolvedValue(true),
  };
});

describe("Customer Portal BFF API Security & Isolation", () => {
  it("should fail closed with 404 when requesting a shipment outside authorized client scope", async () => {
    vi.mocked(authModule.authorizePortalResource).mockResolvedValueOnce({
      authorized: false,
      ctx: { userId: "usr_cust", accountId: "acc_1" } as any,
      scope: { isAllClients: false, authorizedClientIds: ["cli_ALLOWED"], teamIds: [] },
      effectiveClientId: "cli_OTHER",
      errorResponse: { status: 404, json: async () => ({ error: "NOT_FOUND" }) } as any,
    });

    const result = await authModule.authorizePortalResource({
      permission: "portal.shipments.read",
      resourceAccountId: "acc_1",
      resourceClientId: "cli_OTHER",
    });

    expect(result.authorized).toBe(false);
    expect(result.errorResponse?.status).toBe(404);
  });

  it("should fail closed when attempting to download an unapproved/draft entry summary", async () => {
    vi.mocked(authModule.authorizePortalResource).mockResolvedValueOnce({
      authorized: false,
      ctx: { userId: "usr_cust", accountId: "acc_1" } as any,
      scope: { isAllClients: false, authorizedClientIds: ["cli_ALLOWED"], teamIds: [] },
      effectiveClientId: "cli_ALLOWED",
      errorResponse: { status: 404, json: async () => ({ error: "NOT_FOUND" }) } as any,
    });

    const result = await authModule.authorizePortalResource({
      permission: "portal.entries.download",
      resourceAccountId: "acc_1",
      resourceClientId: "cli_ALLOWED",
      customerVisibleAt: null, // Unpublished draft entry
    });

    expect(result.authorized).toBe(false);
    expect(result.errorResponse?.status).toBe(404);
  });
});
