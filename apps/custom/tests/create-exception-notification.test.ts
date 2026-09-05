import { describe, it, expect, vi, beforeEach } from "vitest";

// §39: an ExceptionItem's owner should hear about it as soon as it's routed,
// not only later on manual reassignment or SLA breach. createExceptionItem
// already auto-routes assignedToUserId via initializeExceptionWorkItem --
// this exercises the notify() call that follows that routing.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    exceptionItem: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const deliverWebhookEvent = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/webhooks/deliver", () => ({
  deliverWebhookEvent: (...args: unknown[]) => deliverWebhookEvent(...args),
}));

const initializeExceptionWorkItem = vi.fn().mockResolvedValue(undefined);
vi.mock("@/modules/work/workItemLifecycle", () => ({
  initializeExceptionWorkItem: (...args: unknown[]) => initializeExceptionWorkItem(...args),
}));

const notify = vi.fn().mockResolvedValue({ created: true });
vi.mock("@/modules/notifications/notify", () => ({
  notify: (...args: unknown[]) => notify(...args),
}));

const { createExceptionItem } = await import("@/lib/exceptions/createException");

beforeEach(() => {
  vi.clearAllMocks();
  deliverWebhookEvent.mockResolvedValue(undefined);
  initializeExceptionWorkItem.mockResolvedValue(undefined);
  notify.mockResolvedValue({ created: true });
});

describe("createExceptionItem: creation-time notification", () => {
  it("notifies the auto-routed owner right after creation", async () => {
    dbMock.exceptionItem.findFirst.mockResolvedValue(null);
    dbMock.exceptionItem.create.mockResolvedValue({
      id: "exc_1",
      accountId: "acct_1",
      shipmentId: "ship_1",
      filingId: null,
      documentId: null,
      category: "CONFLICT",
      type: "data_mismatch",
      severity: "High",
      code: null,
      description: "Weight mismatch",
    });
    dbMock.exceptionItem.findUnique.mockResolvedValue({ assignedToUserId: "user_1" });

    await createExceptionItem({
      accountId: "acct_1",
      shipmentId: "ship_1",
      category: "CONFLICT",
      type: "data_mismatch",
      severity: "High",
      description: "Weight mismatch",
    } as any);

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acct_1",
        userId: "user_1",
        type: "EXCEPTION_CREATED",
        entityType: "ExceptionItem",
        entityId: "exc_1",
        dedupe: true,
      })
    );
  });

  it("does not notify when no owner has been routed yet", async () => {
    dbMock.exceptionItem.findFirst.mockResolvedValue(null);
    dbMock.exceptionItem.create.mockResolvedValue({
      id: "exc_2",
      accountId: "acct_1",
      shipmentId: null,
      filingId: null,
      documentId: null,
      category: "SYSTEM",
      type: "unassigned_intake",
      severity: "Low",
      code: null,
      description: "Unrouted intake",
    });
    dbMock.exceptionItem.findUnique.mockResolvedValue({ assignedToUserId: null });

    await createExceptionItem({
      accountId: "acct_1",
      category: "SYSTEM",
      type: "unassigned_intake",
      severity: "Low",
      description: "Unrouted intake",
    } as any);

    expect(notify).not.toHaveBeenCalled();
  });

  it("returns the existing open exception without re-notifying (idempotent dedupe path)", async () => {
    const existing = {
      id: "exc_existing",
      accountId: "acct_1",
      shipmentId: "ship_1",
      status: "Open",
    };
    dbMock.exceptionItem.findFirst.mockResolvedValue(existing);

    const result = await createExceptionItem({
      accountId: "acct_1",
      shipmentId: "ship_1",
      category: "CONFLICT",
      type: "data_mismatch",
      severity: "High",
      description: "Weight mismatch",
    } as any);

    expect(result).toBe(existing);
    expect(dbMock.exceptionItem.create).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});
