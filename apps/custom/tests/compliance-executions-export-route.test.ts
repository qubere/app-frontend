import { describe, it, expect, vi, beforeEach } from "vitest";

// GET /api/v1/compliance/executions/export.
// Covers: the CSV contains only the declared safe summary fields (never raw
// request/response snapshots or any other free-text), the export is gated on
// `audit.export` specifically (stricter than the read-only search/summary
// endpoints), and rows are bounded.

const { dbMock } = vi.hoisted(() => ({
  dbMock: { complianceExecution: { findMany: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

const capturedOptions: any[] = [];
vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: any, options: any) => {
    capturedOptions.push(options);
    return (req: any) => handler({ req, ctx: { accountId: "acct_1", userId: "user_1" }, requestId: "req_1", params: {} });
  },
}));

const { GET } = await import("@/app/api/v1/compliance/executions/export/route");

function req(url: string) {
  return { url } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.complianceExecution.findMany.mockResolvedValue([
    {
      id: "exec_1",
      startedAt: new Date("2026-08-20T10:00:00Z"),
      completedAt: new Date("2026-08-20T10:00:05Z"),
      executionType: "EMBARGO_SCREENING",
      source: "SHIPMENT_PIPELINE",
      status: "COMPLETED",
      finalStatus: "CLEAR",
      shipmentId: "shp_1",
      partyId: null,
      productId: null,
      countryChecked: "IR",
      correlationId: "corr_1",
      initiatedByUserId: "user_1",
      durationMs: 120,
      _count: { overrides: 0 },
      // If a raw snapshot ever leaked onto the select, this test's CSV
      // assertion below would fail -- the route's `select` intentionally
      // omits these fields, but this simulates a select mistake to prove
      // the CSV writer itself never emits them even if present on the row.
      requestSnapshot: { authorization: "Bearer super-secret-token" },
    },
  ]);
});

describe("GET /api/v1/compliance/executions/export", () => {
  it("is gated on audit.export specifically, not audit.read/compliance.read", () => {
    expect(capturedOptions[0]).toEqual({ permission: "audit.export" });
  });

  it("emits only the declared safe headers, and never a raw snapshot field", async () => {
    const response = await GET(req("https://x/api/v1/compliance/executions/export"));
    const text = await response.text();
    const [headerLine] = text.split("\r\n");

    expect(headerLine).toBe(
      [
        "Execution ID",
        "Started At",
        "Completed At",
        "Type",
        "Source",
        "Status",
        "Final Status",
        "Shipment ID",
        "Party ID",
        "Product ID",
        "Country Checked",
        "Correlation ID",
        "Initiated By User ID",
        "Duration (ms)",
        "Override Count",
      ].join(",")
    );
    expect(text).not.toContain("super-secret-token");
    expect(text).not.toContain("Bearer");
  });

  it("returns a CSV content-type and attachment disposition", async () => {
    const response = await GET(req("https://x/api/v1/compliance/executions/export"));
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
  });

  it("bounds the exported row count via take", async () => {
    await GET(req("https://x/api/v1/compliance/executions/export"));
    expect(dbMock.complianceExecution.findMany.mock.calls[0][0].take).toBe(5000);
  });

  it("scopes the export by the authenticated session's accountId", async () => {
    await GET(req("https://x/api/v1/compliance/executions/export?accountId=someone-elses"));
    expect(dbMock.complianceExecution.findMany.mock.calls[0][0].where.accountId).toBe("acct_1");
  });
});
