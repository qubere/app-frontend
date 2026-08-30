import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = vi.hoisted(() => ({
  billingException: { findFirst: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({
  db: dbMock,
  isDataMode: (m: unknown) => m === "DEMO" || m === "SANDBOX" || m === "PRODUCTION",
  withDataModeContext: (_m: unknown, fn: () => unknown) => fn(),
  withAccountIdContext: (_a: unknown, fn: () => unknown) => fn(),
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(), AuditAction: {} }));

const { disposeBillingException } = await import("@/lib/billing/disposeBillingException");
const { createAuditLog } = await import("@/lib/audit");

const ctx = { accountId: "acc-1", userId: "u-1", dataMode: "PRODUCTION" as const };

beforeEach(() => {
  dbMock.billingException.findFirst.mockReset();
  dbMock.billingException.updateMany.mockReset();
  (createAuditLog as ReturnType<typeof vi.fn>).mockReset();
});

describe("disposeBillingException", () => {
  it("requires a non-empty reason", async () => {
    await expect(disposeBillingException(ctx, "e1", "  ", "RESOLVED")).rejects.toThrow(/reason is required/i);
    expect(dbMock.billingException.findFirst).not.toHaveBeenCalled();
  });

  it("scopes the lookup to the caller's account", async () => {
    dbMock.billingException.findFirst.mockResolvedValue({ id: "e1", type: "RATE_CARD_GAP", status: "OPEN" });
    dbMock.billingException.updateMany.mockResolvedValue({ count: 1 });

    await disposeBillingException(ctx, "e1", "fixed the mapping", "RESOLVED");

    expect(dbMock.billingException.findFirst.mock.calls[0][0].where).toEqual({ id: "e1", accountId: "acc-1" });
    expect(dbMock.billingException.updateMany.mock.calls[0][0].where).toEqual({
      id: "e1",
      accountId: "acc-1",
      status: "OPEN",
    });
    expect(dbMock.billingException.updateMany.mock.calls[0][0].data).toMatchObject({
      status: "RESOLVED",
      resolutionNote: "fixed the mapping",
    });
  });

  it("rejects a finding that is not found or belongs to another account", async () => {
    dbMock.billingException.findFirst.mockResolvedValue(null);
    await expect(disposeBillingException(ctx, "other", "x", "WAIVED")).rejects.toThrow(/not found/i);
    expect(dbMock.billingException.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an already-closed exception", async () => {
    dbMock.billingException.findFirst.mockResolvedValue({ id: "e1", type: "T", status: "RESOLVED" });
    await expect(disposeBillingException(ctx, "e1", "x", "RESOLVED")).rejects.toThrow(/only open/i);
  });

  it("treats a 0-row update as a concurrent-edit conflict", async () => {
    dbMock.billingException.findFirst.mockResolvedValue({ id: "e1", type: "T", status: "OPEN" });
    dbMock.billingException.updateMany.mockResolvedValue({ count: 0 });
    await expect(disposeBillingException(ctx, "e1", "x", "WAIVED")).rejects.toThrow(/already been?|another user/i);
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("audits a successful waive", async () => {
    dbMock.billingException.findFirst.mockResolvedValue({ id: "e1", type: "ZERO_RATED", status: "OPEN" });
    dbMock.billingException.updateMany.mockResolvedValue({ count: 1 });

    const res = await disposeBillingException(ctx, "e1", "customer goodwill", "WAIVED");

    expect(res).toEqual({ success: true });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acc-1",
        action: "billing.exception.waive",
        entity: "BillingException",
        entityId: "e1",
      })
    );
  });
});
