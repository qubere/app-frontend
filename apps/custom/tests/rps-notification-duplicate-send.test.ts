import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// evaluateAndQueue must be idempotent for a given (screeningResultId,
// notificationType): concurrent workers, an API-level retry, or the same
// screening result being persisted twice must never produce two
// ComplianceNotification rows or a second QUEUED audit entry. This is
// enforced by the DB's `@@unique([screeningResultId, notificationType])`
// constraint -- evaluateAndQueue must catch the resulting P2002 and treat it
// as "already queued", not surface it as an error.

const { createAuditLog } = vi.hoisted(() => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/audit", () => ({
  createAuditLog,
  AuditAction: {
    RPS_NOTIFICATION_QUEUED: "RPS_NOTIFICATION_QUEUED",
    RPS_NOTIFICATION_SUPPRESSED: "RPS_NOTIFICATION_SUPPRESSED",
  },
}));

const { evaluateAndQueue } = await import("@/modules/compliance/notifications/notificationService");

function fakeConfig(overrides: Record<string, unknown> = {}) {
  return {
    accountId: "acct_1",
    rpsEmailAlertsEnabled: true,
    rpsHitRecipients: ["hit@example.com"],
    rpsGeneralRecipients: [],
    rpsPalRescreenRecipients: [],
    rpsSuppressEmailAlerts: false,
    ...overrides,
  };
}

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

function makeTx(config: Record<string, unknown> | null) {
  return {
    accountScreeningConfig: { findUnique: vi.fn().mockResolvedValue(config) },
    complianceNotification: { create: vi.fn() },
  };
}

const baseParams = {
  accountId: "acct_1",
  screeningResultId: "result_1",
  status: "HIT" as const,
  notificationType: "RPS_HIT" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("evaluateAndQueue: duplicate-send prevention", () => {
  it("creates exactly one ComplianceNotification and one QUEUED audit entry on the first call", async () => {
    const tx = makeTx(fakeConfig());
    tx.complianceNotification.create.mockResolvedValue({ id: "notif_1" });

    await evaluateAndQueue(tx as any, baseParams);

    expect(tx.complianceNotification.create).toHaveBeenCalledTimes(1);
    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "RPS_NOTIFICATION_QUEUED" }));
  });

  it("swallows a P2002 unique-constraint violation on a second call for the same result/type without throwing or re-auditing", async () => {
    const tx = makeTx(fakeConfig());
    tx.complianceNotification.create.mockRejectedValue(p2002());

    await expect(evaluateAndQueue(tx as any, baseParams)).resolves.toBeUndefined();

    expect(tx.complianceNotification.create).toHaveBeenCalledTimes(1);
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("simulates two concurrent workers: first succeeds, second collides on P2002 and is a no-op", async () => {
    const config = fakeConfig();
    const txA = makeTx(config);
    const txB = makeTx(config);
    txA.complianceNotification.create.mockResolvedValue({ id: "notif_1" });
    txB.complianceNotification.create.mockRejectedValue(p2002());

    await Promise.all([evaluateAndQueue(txA as any, baseParams), evaluateAndQueue(txB as any, baseParams)]);

    expect(txA.complianceNotification.create).toHaveBeenCalledTimes(1);
    expect(txB.complianceNotification.create).toHaveBeenCalledTimes(1);
    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "RPS_NOTIFICATION_QUEUED" }));
  });

  it("re-throws a non-P2002 database error instead of silently swallowing it", async () => {
    const tx = makeTx(fakeConfig());
    tx.complianceNotification.create.mockRejectedValue(new Error("connection reset"));

    await expect(evaluateAndQueue(tx as any, baseParams)).rejects.toThrow("connection reset");
  });

  it("never calls create when the result is ineligible (no notification, no duplicate risk)", async () => {
    const tx = makeTx(fakeConfig({ rpsEmailAlertsEnabled: false }));

    await evaluateAndQueue(tx as any, baseParams);

    expect(tx.complianceNotification.create).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("audits RPS_NOTIFICATION_SUPPRESSED (not QUEUED) when suppressed, and still never creates a row", async () => {
    const tx = makeTx(fakeConfig({ rpsSuppressEmailAlerts: true }));

    await evaluateAndQueue(tx as any, baseParams);

    expect(tx.complianceNotification.create).not.toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "RPS_NOTIFICATION_SUPPRESSED" }));
  });
});
