import { describe, it, expect, vi, beforeEach } from "vitest";

// ComplianceNotificationDispatcher.dispatchPending(): retry/backoff state
// machine. Verifies SUCCESS -> SENT, RETRYABLE_FAILURE -> RETRYABLE_FAILURE
// (with backoff) until maxRetryAttempts is exhausted -> FAILED, and
// PERMANENT_FAILURE -> immediate FAILED. Also asserts the dispatcher never
// touches RestrictedPartyScreeningResult (read-only for rendering).

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    complianceNotification: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    restrictedPartyScreeningResult: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    accountScreeningConfig: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const { createAuditLog } = vi.hoisted(() => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/audit", () => ({
  createAuditLog,
  AuditAction: {
    RPS_NOTIFICATION_SENT: "RPS_NOTIFICATION_SENT",
    RPS_NOTIFICATION_RETRY: "RPS_NOTIFICATION_RETRY",
    RPS_NOTIFICATION_FAILED: "RPS_NOTIFICATION_FAILED",
  },
}));

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/modules/email/emailProviderFactory", () => ({ getEmailProvider: () => ({ send }) }));

const emailConfigFixture = {
  provider: "ZOHO",
  transport: "SMTP",
  fromAddress: "alerts@qubere.ai",
  fromName: "Qubere Compliance",
  appBaseUrl: "https://app.qubere.ai",
  maxRetryAttempts: 5,
  retryBaseSeconds: 30,
};
vi.mock("@/modules/email/emailConfig", () => ({
  getEmailConfig: vi.fn(() => emailConfigFixture),
  EmailConfigError: class EmailConfigError extends Error {},
}));

vi.mock("@/modules/compliance/notifications/templates", () => ({
  renderRpsEmail: vi.fn(() => ({ subject: "subj", html: "<p>hi</p>", text: "hi" })),
}));

const { ComplianceNotificationDispatcher } = await import("@/modules/compliance/notifications/dispatcher");

function baseNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: "notif_1",
    accountId: "acct_1",
    notificationType: "RPS_HIT",
    screeningResultId: "result_1",
    deliveryStatus: "PENDING",
    attemptCount: 0,
    recipients: ["hit@example.com"],
    ...overrides,
  };
}

function stubScreeningResultAndConfig() {
  dbMock.restrictedPartyScreeningResult.findUnique.mockResolvedValue({
    id: "result_1",
    status: "HIT",
    screenedName: "Some Party",
    screenedAddress: null,
    screenedCity: null,
    screenedCountry: null,
    hitCount: 1,
    redFlagCount: 0,
    partyId: "party_1",
    shipmentId: null,
    matches: [],
  });
  dbMock.accountScreeningConfig.findUnique.mockResolvedValue({
    rpsSecureEmailEnabled: false,
    rpsEmailFormat: "HTML",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.complianceNotification.updateMany.mockResolvedValue({ count: 1 });
  dbMock.complianceNotification.update.mockResolvedValue({});
  stubScreeningResultAndConfig();
});

describe("ComplianceNotificationDispatcher.dispatchPending", () => {
  it("marks a successfully-sent notification SENT and audits RPS_NOTIFICATION_SENT", async () => {
    dbMock.complianceNotification.findMany.mockResolvedValue([baseNotification()]);
    send.mockResolvedValue({ outcome: "SUCCESS", providerMessageId: "msg_1" });

    const result = await ComplianceNotificationDispatcher.dispatchPending();

    expect(result).toMatchObject({ sentCount: 1, retriedCount: 0, failedCount: 0 });
    expect(dbMock.complianceNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "notif_1" }, data: expect.objectContaining({ deliveryStatus: "SENT" }) })
    );
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "RPS_NOTIFICATION_SENT" }));
  });

  it("schedules a retry with backoff when a retryable failure occurs below maxRetryAttempts", async () => {
    dbMock.complianceNotification.findMany.mockResolvedValue([baseNotification({ attemptCount: 1 })]);
    send.mockResolvedValue({ outcome: "RETRYABLE_FAILURE", errorCode: "ETIMEDOUT", errorMessage: "timed out" });

    const result = await ComplianceNotificationDispatcher.dispatchPending();

    expect(result).toMatchObject({ sentCount: 0, retriedCount: 1, failedCount: 0 });
    const updateCall = dbMock.complianceNotification.update.mock.calls[0][0];
    expect(updateCall.data.deliveryStatus).toBe("RETRYABLE_FAILURE");
    expect(updateCall.data.nextAttemptAt).toBeInstanceOf(Date);
    expect(updateCall.data.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "RPS_NOTIFICATION_RETRY" }));
  });

  it("marks FAILED (no further retry) once attemptCount reaches maxRetryAttempts even on a retryable error", async () => {
    // attemptCount=4 -> claimed attemptCount becomes 5 -> 5 < maxRetryAttempts(5) is false.
    dbMock.complianceNotification.findMany.mockResolvedValue([baseNotification({ attemptCount: 4 })]);
    send.mockResolvedValue({ outcome: "RETRYABLE_FAILURE", errorCode: "ETIMEDOUT", errorMessage: "timed out" });

    const result = await ComplianceNotificationDispatcher.dispatchPending();

    expect(result).toMatchObject({ sentCount: 0, retriedCount: 0, failedCount: 1 });
    expect(dbMock.complianceNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: "FAILED" }) })
    );
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "RPS_NOTIFICATION_FAILED" }));
  });

  it("marks a permanent failure FAILED immediately, regardless of attemptCount", async () => {
    dbMock.complianceNotification.findMany.mockResolvedValue([baseNotification({ attemptCount: 0 })]);
    send.mockResolvedValue({ outcome: "PERMANENT_FAILURE", errorCode: "EENVELOPE", errorMessage: "invalid recipient" });

    const result = await ComplianceNotificationDispatcher.dispatchPending();

    expect(result).toMatchObject({ sentCount: 0, retriedCount: 0, failedCount: 1 });
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "RPS_NOTIFICATION_FAILED" }));
  });

  it("never mutates RestrictedPartyScreeningResult on any delivery outcome", async () => {
    dbMock.complianceNotification.findMany.mockResolvedValue([
      baseNotification({ id: "n1" }),
      baseNotification({ id: "n2", attemptCount: 4 }),
    ]);
    send
      .mockResolvedValueOnce({ outcome: "SUCCESS", providerMessageId: "msg_1" })
      .mockResolvedValueOnce({ outcome: "PERMANENT_FAILURE", errorCode: "EENVELOPE", errorMessage: "bad" });

    await ComplianceNotificationDispatcher.dispatchPending();

    expect(dbMock.restrictedPartyScreeningResult.update).not.toHaveBeenCalled();
  });

  it("skips a notification whose optimistic claim lost the race (updateMany count 0)", async () => {
    dbMock.complianceNotification.findMany.mockResolvedValue([baseNotification()]);
    dbMock.complianceNotification.updateMany.mockResolvedValue({ count: 0 });

    const result = await ComplianceNotificationDispatcher.dispatchPending();

    expect(send).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sentCount: 0, retriedCount: 0, failedCount: 0 });
  });
});
