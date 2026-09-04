import { describe, it, expect, vi, beforeEach } from "vitest";

// RDPS: tenant isolation. Every accountId-scoped function in
// rdpsQueryService.ts must scope its RdpsPartyOutcome/Party lookups by the
// calling account, so a row belonging to a different tenant is never
// returned, never mutated, and never leaks through an unhandled error --
// including dispositionAlert, which must throw the dedicated
// RdpsAlertNotFoundError (never a raw/leaking error, never a silent success)
// when the target outcome belongs to another tenant.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    rdpsPartyOutcome: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    exceptionItem: {
      findMany: vi.fn(),
    },
    party: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    rdpsRun: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const updateException = vi.fn();
vi.mock("@/modules/exceptions/exception.service", () => ({
  ExceptionService: { updateException: (...args: unknown[]) => updateException(...args) },
}));

const {
  listOutcomesForRun,
  listAlerts,
  listPopulation,
  getReportsSummary,
  getPartyMonitoringHistory,
  dispositionAlert,
  RdpsAlertNotFoundError,
} = await import("@/modules/compliance/rdps/rdpsQueryService");

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([]);
  dbMock.rdpsPartyOutcome.count.mockResolvedValue(0);
  dbMock.exceptionItem.findMany.mockResolvedValue([]);
  dbMock.party.findMany.mockResolvedValue([]);
  dbMock.party.count.mockResolvedValue(0);
  dbMock.rdpsRun.findFirst.mockResolvedValue(null);
});

describe("listOutcomesForRun: tenant scoping", () => {
  it("scopes the where clause by accountId in addition to runId", async () => {
    await listOutcomesForRun("acct_1", "run_1", {});

    expect(dbMock.rdpsPartyOutcome.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ runId: "run_1", accountId: "acct_1" }) })
    );
  });

  it("returns an empty page (not another tenant's rows) when the mocked db has nothing for this account", async () => {
    dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([]);
    dbMock.rdpsPartyOutcome.count.mockResolvedValue(0);

    const result = await listOutcomesForRun("acct_2", "run_1", {});

    expect(result.outcomes).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("listAlerts: tenant scoping", () => {
  it("scopes the where clause by accountId", async () => {
    await listAlerts("acct_1", {});

    expect(dbMock.rdpsPartyOutcome.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acct_1", isWorsening: true }) })
    );
  });

  it("resolves the dispositioned exceptionItemId filter against exceptions scoped to the same accountId", async () => {
    await listAlerts("acct_1", { dispositioned: true });

    expect(dbMock.exceptionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acct_1" }) })
    );
  });

  it("returns no alerts for a tenant with no rows, never falling back to an unscoped result", async () => {
    dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([]);
    const result = await listAlerts("acct_2", {});
    expect(result.alerts).toEqual([]);
  });
});

describe("listPopulation: tenant scoping", () => {
  it("scopes the Party lookup by accountId and excludes soft-deleted parties", async () => {
    await listPopulation("acct_1", {});

    expect(dbMock.party.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: "acct_1", deletedAt: null } })
    );
    expect(dbMock.party.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: "acct_1", deletedAt: null } })
    );
  });
});

describe("getReportsSummary: tenant scoping", () => {
  it("scopes every per-tenant metric query by accountId", async () => {
    await getReportsSummary("acct_1");

    expect(dbMock.exceptionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acct_1" }) })
    );
    expect(dbMock.party.count).toHaveBeenCalledWith(expect.objectContaining({ where: { accountId: "acct_1", deletedAt: null } }));
    for (const call of dbMock.rdpsPartyOutcome.count.mock.calls) {
      expect(call[0].where.accountId).toBe("acct_1");
    }
  });
});

describe("getPartyMonitoringHistory: tenant scoping", () => {
  it("scopes the party existence check by accountId and returns null (not another tenant's history) for a cross-tenant partyId", async () => {
    dbMock.party.findFirst.mockResolvedValue(null);

    const result = await getPartyMonitoringHistory("acct_2", "party_1");

    expect(dbMock.party.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "party_1", accountId: "acct_2" } })
    );
    expect(result).toBeNull();
    expect(dbMock.rdpsPartyOutcome.findMany).not.toHaveBeenCalled();
  });

  it("scopes the outcome history query by both partyId and accountId when the party does belong to this tenant", async () => {
    dbMock.party.findFirst.mockResolvedValue({ id: "party_1" });
    dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([]);

    await getPartyMonitoringHistory("acct_1", "party_1");

    expect(dbMock.rdpsPartyOutcome.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { partyId: "party_1", accountId: "acct_1" } })
    );
  });
});

describe("dispositionAlert: tenant scoping and not-found behavior", () => {
  it("scopes the outcome lookup by id, accountId, and isWorsening: true", async () => {
    dbMock.rdpsPartyOutcome.findFirst.mockResolvedValue(null);

    await expect(
      dispositionAlert("acct_1", "outcome_1", { status: "Resolved", expectedVersion: 1 }, { userId: "u1", name: "U" })
    ).rejects.toThrow(RdpsAlertNotFoundError);

    expect(dbMock.rdpsPartyOutcome.findFirst).toHaveBeenCalledWith({
      where: { id: "outcome_1", accountId: "acct_1", isWorsening: true },
    });
  });

  it("throws RdpsAlertNotFoundError (never a raw/leaking error, never a silent success) for another tenant's outcome id", async () => {
    // Simulates the cross-tenant case: the row exists for a *different*
    // account, so the accountId-scoped findFirst mock resolves null exactly
    // as it would against a real database.
    dbMock.rdpsPartyOutcome.findFirst.mockResolvedValue(null);

    await expect(
      dispositionAlert("acct_2", "outcome_owned_by_acct_1", { status: "Resolved", expectedVersion: 1 }, { userId: "u2", name: "U2" })
    ).rejects.toBeInstanceOf(RdpsAlertNotFoundError);

    expect(updateException).not.toHaveBeenCalled();
  });

  it("throws RdpsAlertNotFoundError when the outcome exists for this tenant but has no linked exceptionItemId (non-worsening/never-alerted outcome)", async () => {
    dbMock.rdpsPartyOutcome.findFirst.mockResolvedValue({ id: "outcome_1", accountId: "acct_1", exceptionItemId: null });

    await expect(
      dispositionAlert("acct_1", "outcome_1", { status: "Resolved", expectedVersion: 1 }, { userId: "u1", name: "U" })
    ).rejects.toBeInstanceOf(RdpsAlertNotFoundError);

    expect(updateException).not.toHaveBeenCalled();
  });

  it("delegates to ExceptionService.updateException scoped by accountId when the outcome is owned by this tenant and has an exception", async () => {
    dbMock.rdpsPartyOutcome.findFirst.mockResolvedValue({ id: "outcome_1", accountId: "acct_1", exceptionItemId: "exc_1" });
    updateException.mockResolvedValue({ id: "exc_1", status: "Resolved" });

    const result = await dispositionAlert(
      "acct_1",
      "outcome_1",
      { status: "Resolved", expectedVersion: 2 },
      { userId: "u1", name: "U" }
    );

    expect(updateException).toHaveBeenCalledWith(
      "acct_1",
      "exc_1",
      expect.objectContaining({ status: "Resolved", expectedVersion: 2 }),
      { userId: "u1", name: "U" }
    );
    expect(result).toEqual({ id: "exc_1", status: "Resolved" });
  });
});
