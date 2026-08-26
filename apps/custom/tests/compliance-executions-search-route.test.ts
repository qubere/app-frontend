import { describe, it, expect, vi, beforeEach } from "vitest";

// GET /api/v1/compliance/executions and /executions/summary.
// Covers: accountId is always derived from the authenticated session (never
// the query string) so tenant isolation holds, and that summary.total always
// reconciles with the search endpoint's pagination.total for an identical
// filter set (both delegate to the same buildExecutionWhere).

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    complianceExecution: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

let currentCtx = { accountId: "acct_1", userId: "user_1" };

vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: any) => (req: any) =>
    handler({ req, ctx: currentCtx, requestId: "req_1", params: {} }),
}));

const { GET: searchGET } = await import("@/app/api/v1/compliance/executions/route");
const { GET: summaryGET } = await import("@/app/api/v1/compliance/executions/summary/route");

function req(url: string) {
  return { url } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentCtx = { accountId: "acct_1", userId: "user_1" };
  dbMock.complianceExecution.count.mockResolvedValue(0);
  dbMock.complianceExecution.findMany.mockResolvedValue([]);
  dbMock.complianceExecution.groupBy.mockResolvedValue([]);
  dbMock.complianceExecution.aggregate.mockResolvedValue({ _avg: { durationMs: null } });
});

describe("GET /api/v1/compliance/executions", () => {
  it("scopes every query by the authenticated session's accountId, never a client-supplied one", async () => {
    await searchGET(req("https://x/api/v1/compliance/executions?accountId=someone-elses-account"));

    const countWhere = dbMock.complianceExecution.count.mock.calls[0][0].where;
    const findWhere = dbMock.complianceExecution.findMany.mock.calls[0][0].where;
    expect(countWhere.accountId).toBe("acct_1");
    expect(findWhere.accountId).toBe("acct_1");
  });

  it("never leaks another tenant's rows even when a shipmentId filter is supplied", async () => {
    currentCtx = { accountId: "acct_2", userId: "user_9" };
    await searchGET(req("https://x/api/v1/compliance/executions?shipmentId=shp_1"));

    const findWhere = dbMock.complianceExecution.findMany.mock.calls[0][0].where;
    expect(findWhere.accountId).toBe("acct_2");
    expect(findWhere.shipmentId).toBe("shp_1");
  });

  it("paginates and sorts using validated query params", async () => {
    dbMock.complianceExecution.count.mockResolvedValue(42);
    const response = await searchGET(
      req("https://x/api/v1/compliance/executions?page=2&pageSize=10&sortBy=durationMs&sortDir=asc")
    );
    const body = await response.json();

    const findArgs = dbMock.complianceExecution.findMany.mock.calls[0][0];
    expect(findArgs.skip).toBe(10);
    expect(findArgs.take).toBe(10);
    expect(findArgs.orderBy).toEqual({ durationMs: "asc" });
    expect(body.pagination).toEqual({ page: 2, pageSize: 10, total: 42, totalPages: 5 });
  });

  it("rejects invalid query params with a 400 before touching the database", async () => {
    const response = await searchGET(req("https://x/api/v1/compliance/executions?pageSize=999999"));
    expect(response.status).toBe(400);
    expect(dbMock.complianceExecution.findMany).not.toHaveBeenCalled();
  });
});

describe("service-usage summary reconciles with search for the same filters", () => {
  it("summary.total matches search's pagination.total given identical filters", async () => {
    dbMock.complianceExecution.count.mockResolvedValue(17);

    const filterQuery = "status=COMPLETED&executionType=EMBARGO_SCREENING";
    const searchRes = await searchGET(req(`https://x/api/v1/compliance/executions?${filterQuery}&pageSize=5`));
    const summaryRes = await summaryGET(req(`https://x/api/v1/compliance/executions/summary?${filterQuery}`));

    const searchBody = await searchRes.json();
    const summaryBody = await summaryRes.json();

    expect(summaryBody.summary.total).toBe(searchBody.pagination.total);

    // Both endpoints must have scoped the identical count() call by the same
    // tenant + filters -- not two independently-drifting where clauses.
    const searchCountWhere = dbMock.complianceExecution.count.mock.calls[0][0].where;
    const summaryCountWhere = dbMock.complianceExecution.count.mock.calls[1][0].where;
    expect(summaryCountWhere).toEqual(searchCountWhere);
  });

  it("summary is scoped to the authenticated session's accountId as well", async () => {
    currentCtx = { accountId: "acct_3", userId: "user_5" };
    await summaryGET(req("https://x/api/v1/compliance/executions/summary"));
    const where = dbMock.complianceExecution.count.mock.calls[0][0].where;
    expect(where.accountId).toBe("acct_3");
  });
});
