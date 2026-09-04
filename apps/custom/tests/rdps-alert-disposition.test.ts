import { describe, it, expect, vi, beforeEach } from "vitest";

// RDPS: dispositionAlert (rdpsQueryService.ts) and its route
// (alerts/[id]/disposition/route.ts). Covers the happy path delegating to
// ExceptionService.updateException with the right arguments, a stale-version
// conflict surfacing as a 409 rather than a raw 500, and RdpsAlertNotFoundError
// for an outcome with no linked exceptionItemId (no worsening alert to
// disposition) surfacing as a 404.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    rdpsPartyOutcome: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const updateException = vi.fn();
vi.mock("@/modules/exceptions/exception.service", () => ({
  ExceptionService: { updateException: (...args: unknown[]) => updateException(...args) },
}));

const createAuditLog = vi.fn();
vi.mock("@/lib/audit", () => ({
  createAuditLog: (...args: unknown[]) => createAuditLog(...args),
  AuditAction: { RDPS_ALERT_DISPOSITIONED: "RDPS_ALERT_DISPOSITIONED" },
}));

const hasPermission = vi.fn();
vi.mock("@/lib/auth", () => ({ hasPermission: (...args: unknown[]) => hasPermission(...args) }));

vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: any) => {
    return async (req: any, context: any) =>
      handler({
        req,
        ctx: { accountId: "acct_1", userId: "user_1", firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
        requestId: "req_1",
        params: context ? await context.params : {},
      });
  },
}));

const { dispositionAlert, RdpsAlertNotFoundError } = await import("@/modules/compliance/rdps/rdpsQueryService");
const { POST } = await import("@/app/api/compliance/rdps/alerts/[id]/disposition/route");

function jsonRequest(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  hasPermission.mockResolvedValue(true);
});

describe("dispositionAlert: happy path delegation", () => {
  it("delegates to ExceptionService.updateException with the outcome's exceptionItemId and passes through the resolver + input fields", async () => {
    dbMock.rdpsPartyOutcome.findFirst.mockResolvedValue({ id: "outcome_1", accountId: "acct_1", exceptionItemId: "exc_1" });
    updateException.mockResolvedValue({ id: "exc_1", status: "Resolved", version: 3 });

    const result = await dispositionAlert(
      "acct_1",
      "outcome_1",
      { status: "Resolved", expectedVersion: 2, resolutionReasonCode: "RC1", resolutionReason: "Reviewed and cleared" },
      { userId: "user_1", name: "Jane Doe" }
    );

    expect(updateException).toHaveBeenCalledWith(
      "acct_1",
      "exc_1",
      {
        status: "Resolved",
        expectedVersion: 2,
        resolutionReasonCode: "RC1",
        resolutionReason: "Reviewed and cleared",
      },
      { userId: "user_1", name: "Jane Doe" }
    );
    expect(result).toEqual({ id: "exc_1", status: "Resolved", version: 3 });
  });
});

describe("dispositionAlert: stale version conflict", () => {
  it("propagates ExceptionService's STALE_VERSION error rather than swallowing it", async () => {
    dbMock.rdpsPartyOutcome.findFirst.mockResolvedValue({ id: "outcome_1", accountId: "acct_1", exceptionItemId: "exc_1" });
    updateException.mockRejectedValue(new Error("STALE_VERSION"));

    await expect(
      dispositionAlert("acct_1", "outcome_1", { status: "Resolved", expectedVersion: 1 }, { userId: "u1", name: "U" })
    ).rejects.toThrow("STALE_VERSION");
  });
});

describe("dispositionAlert: not-found cases", () => {
  it("throws RdpsAlertNotFoundError when the outcome has no exceptionItemId", async () => {
    dbMock.rdpsPartyOutcome.findFirst.mockResolvedValue({ id: "outcome_1", accountId: "acct_1", exceptionItemId: null });

    await expect(
      dispositionAlert("acct_1", "outcome_1", { status: "Resolved", expectedVersion: 1 }, { userId: "u1", name: "U" })
    ).rejects.toBeInstanceOf(RdpsAlertNotFoundError);
    expect(updateException).not.toHaveBeenCalled();
  });

  it("throws RdpsAlertNotFoundError when the outcome id does not resolve at all (non-worsening outcome is excluded from the isWorsening: true lookup)", async () => {
    dbMock.rdpsPartyOutcome.findFirst.mockResolvedValue(null);

    await expect(
      dispositionAlert("acct_1", "outcome_1", { status: "Resolved", expectedVersion: 1 }, { userId: "u1", name: "U" })
    ).rejects.toBeInstanceOf(RdpsAlertNotFoundError);
  });
});

describe("POST /api/compliance/rdps/alerts/[id]/disposition: route error translation", () => {
  it("returns 404 when dispositionAlert throws RdpsAlertNotFoundError", async () => {
    dbMock.rdpsPartyOutcome.findFirst.mockResolvedValue(null);

    const response = await POST(jsonRequest({ status: "Resolved", expectedVersion: 1 }), {
      params: Promise.resolve({ id: "outcome_1" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 409 when the underlying exception update reports a stale version", async () => {
    dbMock.rdpsPartyOutcome.findFirst.mockResolvedValue({ id: "outcome_1", accountId: "acct_1", exceptionItemId: "exc_1" });
    updateException.mockRejectedValue(new Error("STALE_VERSION"));

    const response = await POST(jsonRequest({ status: "Resolved", expectedVersion: 1 }), {
      params: Promise.resolve({ id: "outcome_1" }),
    });

    expect(response.status).toBe(409);
  });

  it("returns 200 with the updated exception on success", async () => {
    dbMock.rdpsPartyOutcome.findFirst.mockResolvedValue({ id: "outcome_1", accountId: "acct_1", exceptionItemId: "exc_1" });
    updateException.mockResolvedValue({ id: "exc_1", status: "Resolved" });

    const response = await POST(jsonRequest({ status: "Resolved", expectedVersion: 1 }), {
      params: Promise.resolve({ id: "outcome_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.exception).toEqual({ id: "exc_1", status: "Resolved" });
  });

  it("blocks a WAIVED disposition without the risk-acceptance permission, returning 403 before ever calling dispositionAlert", async () => {
    hasPermission.mockResolvedValue(false);

    const response = await POST(jsonRequest({ status: "Waived", expectedVersion: 1 }), {
      params: Promise.resolve({ id: "outcome_1" }),
    });

    expect(response.status).toBe(403);
    expect(dbMock.rdpsPartyOutcome.findFirst).not.toHaveBeenCalled();
  });
});
