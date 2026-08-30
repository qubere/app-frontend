import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  notificationCategory,
  notificationTypeMeta,
  resolveNotificationHref,
} from "@/modules/notifications/notificationRouting";

describe("notificationCategory", () => {
  it("maps known producer types", () => {
    expect(notificationCategory("WORK_ESCALATED")).toBe("OPERATIONS");
    expect(notificationCategory("WORK_ASSIGNED")).toBe("OPERATIONS");
    expect(notificationCategory("EXCEPTION_ASSIGNED")).toBe("OPERATIONS");
    expect(notificationCategory("INBOUND_EMAIL_DOCUMENTS")).toBe("DOCUMENTS");
    expect(notificationCategory("LICENSE_EXPIRING")).toBe("LICENSING");
    expect(notificationCategory("BILLING_LEAKAGE")).toBe("BILLING");
    expect(notificationCategory("REGULATORY_UPDATE")).toBe("REGULATORY");
  });

  it("falls back to SYSTEM for an unknown type", () => {
    expect(notificationCategory("SOMETHING_NEW")).toBe("SYSTEM");
    expect(notificationTypeMeta("SOMETHING_NEW").label).toBe("Update");
  });
});

describe("resolveNotificationHref", () => {
  it("routes by entity, deep-linking to the item", () => {
    expect(resolveNotificationHref({ type: "WORK_ASSIGNED", entityType: "AgentDecision", entityId: "d1" })).toBe(
      "/app/actions?decisionId=d1"
    );
    expect(resolveNotificationHref({ type: "WORK_ESCALATED", entityType: "ExceptionItem", entityId: "e1" })).toBe(
      "/app/actions?exceptionId=e1"
    );
    expect(resolveNotificationHref({ type: "X", entityType: "CustomsFiling", entityId: "f1" })).toBe("/app/filing/f1");
    expect(resolveNotificationHref({ type: "X", entityType: "Shipment", entityId: "s1" })).toBe("/app/shipments/s1");
    expect(resolveNotificationHref({ type: "X", entityType: "BillingException", entityId: "b1" })).toBe(
      "/app/billing/exceptions"
    );
  });

  it("encodes entity ids", () => {
    expect(
      resolveNotificationHref({ type: "X", entityType: "AgentDecision", entityId: "a/b c" })
    ).toBe("/app/actions?decisionId=a%2Fb%20c");
  });

  it("no longer sends every notification to /app/documents", () => {
    // The pre-hub behavior. Escalations went to the documents page.
    const href = resolveNotificationHref({ type: "WORK_ESCALATED", entityType: "AgentDecision", entityId: "d9" });
    expect(href).not.toBe("/app/documents");
  });

  it("keeps document notifications on the documents page", () => {
    expect(resolveNotificationHref({ type: "INBOUND_EMAIL_DOCUMENTS", entityType: "InboundEmail", entityId: "m1" })).toBe(
      "/app/documents"
    );
  });

  it("falls back to the category home when there is no entity", () => {
    expect(resolveNotificationHref({ type: "LICENSE_EXPIRING", entityType: null, entityId: null })).toBe(
      "/app/license-management"
    );
    expect(resolveNotificationHref({ type: "REGULATORY_UPDATE", entityType: null, entityId: null })).toBe(
      "/app/regulatory"
    );
    expect(resolveNotificationHref({ type: "UNKNOWN", entityType: null, entityId: null })).toBe("/app/actions");
  });
});

const dbMock = vi.hoisted(() => ({
  notification: { findFirst: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

describe("notify()", () => {
  beforeEach(() => {
    dbMock.notification.findFirst.mockReset();
    dbMock.notification.create.mockReset();
  });

  it("creates a notification", async () => {
    const { notify } = await import("@/modules/notifications/notify");
    dbMock.notification.create.mockResolvedValue({ id: "n1" });
    const res = await notify({ accountId: "a", userId: "u", type: "WORK_ASSIGNED", message: "hi" });
    expect(res).toEqual({ created: true });
    expect(dbMock.notification.create).toHaveBeenCalledOnce();
    expect(dbMock.notification.findFirst).not.toHaveBeenCalled();
  });

  it("skips creation when dedupe finds an existing row", async () => {
    const { notify } = await import("@/modules/notifications/notify");
    dbMock.notification.findFirst.mockResolvedValue({ id: "existing" });
    const res = await notify({
      accountId: "a",
      userId: "u",
      type: "INBOUND_EMAIL_DOCUMENTS",
      message: "2 new docs",
      entityType: "InboundEmail",
      entityId: "m1",
      dedupe: true,
    });
    expect(res).toEqual({ created: false });
    expect(dbMock.notification.create).not.toHaveBeenCalled();
  });

  it("swallows DB errors -- a notification is never load-bearing", async () => {
    const { notify } = await import("@/modules/notifications/notify");
    dbMock.notification.create.mockRejectedValue(new Error("db down"));
    const res = await notify({ accountId: "a", userId: "u", type: "WORK_ESCALATED", message: "x" });
    expect(res).toEqual({ created: false });
  });
});
