import { describe, it, expect, vi, beforeEach } from "vitest";

// RDPS: CSV export (rdpsExport.ts). Verifies header row content, correct
// CSV escaping (commas/quotes/newlines), that both exports are tenant-scoped
// (achieved by delegating to the already-tenant-scoped query functions), and
// correct row-content mapping into each export's columns.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    rdpsPartyOutcome: { findMany: vi.fn(), count: vi.fn() },
    exceptionItem: { findMany: vi.fn() },
    party: { count: vi.fn() },
    rdpsRun: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const { buildRdpsRunExport, buildRdpsReportsExport } = await import("@/modules/compliance/rdps/rdpsExport");

function outcomeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "outcome_1",
    partyId: "party_1",
    accountId: "acct_1",
    previousStatus: "CLEAR",
    newStatus: "HIT",
    isWorsening: true,
    hadActivePreApproval: false,
    candidateReasons: ["EXACT"],
    errorMessage: null,
    createdAt: new Date("2026-08-01T12:00:00.000Z"),
    party: { names: [{ rawName: "Acme Trading Co" }] },
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([]);
  dbMock.rdpsPartyOutcome.count.mockResolvedValue(0);
  dbMock.exceptionItem.findMany.mockResolvedValue([]);
  dbMock.party.count.mockResolvedValue(0);
  dbMock.rdpsRun.findFirst.mockResolvedValue(null);
});

describe("buildRdpsRunExport", () => {
  it("emits the correct header row", async () => {
    const { body } = await buildRdpsRunExport("acct_1", "run_1");
    const headerLine = body.split("\r\n")[0];
    expect(headerLine).toBe(
      "Party ID,Party Name,Previous Status,New Status,Worsening,Had Active Pre-Approval,Candidate Reasons,Error,Created At"
    );
  });

  it("is tenant-scoped by delegating to listOutcomesForRun with the given accountId", async () => {
    await buildRdpsRunExport("acct_1", "run_1");
    expect(dbMock.rdpsPartyOutcome.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ runId: "run_1", accountId: "acct_1" }) })
    );
  });

  it("maps outcome row content into the correct columns", async () => {
    dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([outcomeRow()]);
    dbMock.rdpsPartyOutcome.count.mockResolvedValue(1);

    const { body } = await buildRdpsRunExport("acct_1", "run_1");
    const dataLine = body.split("\r\n")[1];

    expect(dataLine).toBe(
      "party_1,Acme Trading Co,CLEAR,HIT,YES,NO,EXACT,,2026-08-01T12:00:00.000Z"
    );
  });

  it("escapes a party name containing a comma by quoting the whole field", async () => {
    dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([
      outcomeRow({ party: { names: [{ rawName: "Acme, Inc." }] } }),
    ]);
    dbMock.rdpsPartyOutcome.count.mockResolvedValue(1);

    const { body } = await buildRdpsRunExport("acct_1", "run_1");
    const dataLine = body.split("\r\n")[1];

    expect(dataLine).toContain('"Acme, Inc."');
  });

  it("escapes a value containing a double quote by doubling it and wrapping in quotes", async () => {
    dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([
      outcomeRow({ party: { names: [{ rawName: 'Acme "Global" Trading' }] } }),
    ]);
    dbMock.rdpsPartyOutcome.count.mockResolvedValue(1);

    const { body } = await buildRdpsRunExport("acct_1", "run_1");
    const dataLine = body.split("\r\n")[1];

    expect(dataLine).toContain('"Acme ""Global"" Trading"');
  });

  it("escapes a value containing a newline by quoting the whole field", async () => {
    dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([
      outcomeRow({ errorMessage: "Line one\nLine two" }),
    ]);
    dbMock.rdpsPartyOutcome.count.mockResolvedValue(1);

    const { body } = await buildRdpsRunExport("acct_1", "run_1");

    expect(body).toContain('"Line one\nLine two"');
  });

  it("renders a null previousStatus as an empty field, not the literal string 'null'", async () => {
    dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([outcomeRow({ previousStatus: null })]);
    dbMock.rdpsPartyOutcome.count.mockResolvedValue(1);

    const { body } = await buildRdpsRunExport("acct_1", "run_1");
    const dataLine = body.split("\r\n")[1];

    expect(dataLine).not.toContain("null");
    expect(dataLine?.split(",")[2]).toBe("");
  });

  it("joins multiple candidateReasons with '; ' inside one CSV field", async () => {
    dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([
      outcomeRow({ candidateReasons: ["EXACT", "RAW_WORD", "DOUBLE_METAPHONE"] }),
    ]);
    dbMock.rdpsPartyOutcome.count.mockResolvedValue(1);

    const { body } = await buildRdpsRunExport("acct_1", "run_1");

    expect(body).toContain("EXACT; RAW_WORD; DOUBLE_METAPHONE");
  });

  it("names the export file after the runId and sets a text/csv content type", async () => {
    const result = await buildRdpsRunExport("acct_1", "run_1");
    expect(result.fileName).toBe("rdps-run-run_1.csv");
    expect(result.contentType).toBe("text/csv; charset=utf-8");
  });
});

describe("buildRdpsReportsExport", () => {
  it("is tenant-scoped: the summary metrics and alert list are both queried with the given accountId", async () => {
    await buildRdpsReportsExport("acct_1");

    expect(dbMock.exceptionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acct_1" }) })
    );
    expect(dbMock.rdpsPartyOutcome.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acct_1" }) })
    );
  });

  it("includes a summary section with the reports-summary metrics, followed by the alert rows with the correct header", async () => {
    dbMock.party.count.mockResolvedValue(42);
    dbMock.rdpsPartyOutcome.count
      .mockResolvedValueOnce(3) // openAlerts uses exceptionItem query separately, but outcome.count is used for worsening/screened
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(10);
    dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([
      {
        partyId: "party_1",
        previousStatus: "CLEAR",
        newStatus: "HIT",
        exceptionItemId: "exc_1",
        createdAt: new Date("2026-08-02T00:00:00.000Z"),
        party: { names: [{ rawName: "Globex Corp" }] },
        run: { runType: "FULL_POPULATION" },
      },
    ]);
    dbMock.exceptionItem.findMany.mockResolvedValue([{ id: "exc_1", status: "Open" }]);

    const { body } = await buildRdpsReportsExport("acct_1");
    const lines = body.split("\r\n");

    expect(lines[0]).toBe("Metric,Value");
    expect(lines).toContain("Total Monitored Parties,42");
    const reportHeaderIndex = lines.indexOf(
      "Party ID,Party Name,Previous Status,New Status,Disposition Status,Run Type,Detected At"
    );
    expect(reportHeaderIndex).toBeGreaterThan(0);
    expect(lines[reportHeaderIndex + 1]).toBe(
      "party_1,Globex Corp,CLEAR,HIT,Open,FULL_POPULATION,2026-08-02T00:00:00.000Z"
    );
  });

  it("names the reports export file after the accountId", async () => {
    const result = await buildRdpsReportsExport("acct_1");
    expect(result.fileName).toBe("rdps-reports-acct_1.csv");
  });
});
