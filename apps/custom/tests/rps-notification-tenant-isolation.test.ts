import { describe, it, expect, vi, beforeEach } from "vitest";

// Notification-settings API route: RBAC + tenant isolation.
// GET/PATCH must require compliance.restrictedParty.settings.manage (PATCH
// also write:true), and every DB read/write must be keyed by the caller's
// own accountId -- Account A's session must never be able to read or update
// Account B's AccountScreeningConfig row.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    accountScreeningConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const { createAuditLog } = vi.hoisted(() => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/audit", () => ({
  createAuditLog,
  AuditAction: { RPS_NOTIFICATION_SETTINGS_UPDATED: "RPS_NOTIFICATION_SETTINGS_UPDATED" },
}));

const guardOptionsByRoute: Array<{ permission?: string; write?: boolean }> = [];
vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: any, options: any) => {
    guardOptionsByRoute.push(options);
    return async (req: any) => handler({ req, ctx: { accountId: "acct_1", userId: "user_1" }, requestId: "req_1" });
  },
}));

const { GET, PATCH } = await import(
  "@/app/api/compliance/restricted-party-screening/notification-settings/route"
);

function jsonRequest(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET .../notification-settings", () => {
  it("requires compliance.restrictedParty.settings.manage", () => {
    expect(guardOptionsByRoute).toContainEqual({ permission: "compliance.restrictedParty.settings.manage" });
  });

  it("reads only the caller's own account's config, never another tenant's", async () => {
    dbMock.accountScreeningConfig.findUnique.mockResolvedValue({
      rpsEmailAlertsEnabled: true,
      rpsGeneralRecipients: ["a@example.com"],
      rpsHitRecipients: [],
      rpsPalRescreenRecipients: [],
      rpsEmailFormat: "HTML",
      rpsSecureEmailEnabled: false,
      rpsSuppressEmailAlerts: false,
    });

    const response = await GET(jsonRequest(undefined));
    const body = await response.json();

    expect(dbMock.accountScreeningConfig.findUnique).toHaveBeenCalledWith({ where: { accountId: "acct_1" } });
    expect(body.settings.rpsGeneralRecipients).toEqual(["a@example.com"]);
  });

  it("defaults to a safe all-disabled view when no config row exists yet for this account", async () => {
    dbMock.accountScreeningConfig.findUnique.mockResolvedValue(null);

    const response = await GET(jsonRequest(undefined));
    const body = await response.json();

    expect(body.settings).toMatchObject({
      rpsEmailAlertsEnabled: false,
      rpsGeneralRecipients: [],
      rpsHitRecipients: [],
      rpsPalRescreenRecipients: [],
      rpsEmailFormat: "HTML",
      rpsSecureEmailEnabled: false,
      rpsSuppressEmailAlerts: false,
    });
  });
});

describe("PATCH .../notification-settings", () => {
  it("requires compliance.restrictedParty.settings.manage with write:true (stricter than GET)", () => {
    expect(guardOptionsByRoute).toContainEqual({ permission: "compliance.restrictedParty.settings.manage", write: true });
  });

  it("upserts scoped strictly to the caller's accountId, never a client-supplied one", async () => {
    dbMock.accountScreeningConfig.findUnique.mockResolvedValue({
      rpsEmailAlertsEnabled: true,
      rpsHitRecipients: ["hit@example.com"],
      rpsGeneralRecipients: [],
      rpsPalRescreenRecipients: [],
      rpsEmailFormat: "HTML",
      rpsSecureEmailEnabled: false,
      rpsSuppressEmailAlerts: false,
    });
    dbMock.accountScreeningConfig.upsert.mockResolvedValue({
      id: "cfg_1",
      rpsEmailAlertsEnabled: true,
      rpsHitRecipients: ["hit@example.com"],
      rpsGeneralRecipients: [],
      rpsPalRescreenRecipients: [],
      rpsEmailFormat: "TEXT",
      rpsSecureEmailEnabled: false,
      rpsSuppressEmailAlerts: false,
    });

    // A malicious/buggy client tries to smuggle a foreign accountId into the body.
    await PATCH(jsonRequest({ rpsEmailFormat: "TEXT", accountId: "acct_OTHER_TENANT" }));

    expect(dbMock.accountScreeningConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: "acct_1" },
        create: expect.objectContaining({ accountId: "acct_1" }),
      })
    );
    const upsertArgs = dbMock.accountScreeningConfig.upsert.mock.calls[0][0];
    expect(upsertArgs.create.accountId).not.toBe("acct_OTHER_TENANT");
    expect(upsertArgs.update.accountId).toBeUndefined();
  });

  it("reads the pre-update state scoped to the caller's own account for the audit diff", async () => {
    dbMock.accountScreeningConfig.findUnique.mockResolvedValue(null);
    dbMock.accountScreeningConfig.upsert.mockResolvedValue({
      id: "cfg_1",
      rpsEmailAlertsEnabled: false,
      rpsHitRecipients: [],
      rpsGeneralRecipients: [],
      rpsPalRescreenRecipients: [],
      rpsEmailFormat: "HTML",
      rpsSecureEmailEnabled: false,
      rpsSuppressEmailAlerts: false,
    });

    await PATCH(jsonRequest({ rpsSecureEmailEnabled: true }));

    expect(dbMock.accountScreeningConfig.findUnique).toHaveBeenCalledWith({ where: { accountId: "acct_1" } });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acct_1", action: "RPS_NOTIFICATION_SETTINGS_UPDATED" })
    );
  });

  it("rejects enabling alerts with all recipient lists empty, rather than silently persisting a no-op config", async () => {
    dbMock.accountScreeningConfig.findUnique.mockResolvedValue(null);

    const response = await PATCH(jsonRequest({ rpsEmailAlertsEnabled: true }));

    expect(response.status).toBe(400);
    expect(dbMock.accountScreeningConfig.upsert).not.toHaveBeenCalled();
  });

  it("rejects a malformed body with a 400 instead of a raw 500", async () => {
    const response = await PATCH(jsonRequest({ rpsEmailFormat: "PDF" }));
    expect(response.status).toBe(400);
    expect(dbMock.accountScreeningConfig.upsert).not.toHaveBeenCalled();
  });
});
