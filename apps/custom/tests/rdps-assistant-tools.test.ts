import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AccountContext } from "@/lib/auth";

// RDPS: Ask Qubere tools. Verifies the 8 planned tools exist, are permission-
// gated correctly (read tools require compliance.rdps.read, the one write
// tool requires compliance.rdps.manage), stay tenant-scoped (always pass
// ctx.accountId into the underlying service call), and that the write tool
// requires a validated partyIds set for TARGETED scans -- it must never fall
// through to screening another tenant's parties.

const { queryServiceMock } = vi.hoisted(() => ({
  queryServiceMock: {
    getReportsSummary: vi.fn(),
    listAlerts: vi.fn(),
    listReferenceChanges: vi.fn(),
    getPartyMonitoringHistory: vi.fn(),
    getRun: vi.fn(),
    listOutcomesForRun: vi.fn(),
    triggerManualScan: vi.fn(),
    RdpsFullPopulationAlreadyRunningError: class RdpsFullPopulationAlreadyRunningError extends Error {},
  },
}));
vi.mock("@/modules/compliance/rdps/rdpsQueryService", () => queryServiceMock);

const recordRdpsOutcome = vi.fn();
vi.mock("@/modules/compliance/rdps/outcomeRecorder", () => ({
  recordRdpsOutcome: (...args: unknown[]) => recordRdpsOutcome(...args),
}));

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    party: { findMany: vi.fn() },
    rdpsRun: { create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const createAuditLog = vi.fn();
vi.mock("@/lib/audit", () => ({
  createAuditLog: (...args: unknown[]) => createAuditLog(...args),
  AuditAction: { RDPS_MANUAL_SCAN_TRIGGERED: "RDPS_MANUAL_SCAN_TRIGGERED" },
}));

const { ASSISTANT_TOOLS } = await import("@/modules/assistant/tools");
const { canUseTool } = await import("@/modules/assistant/shared/toolAccess");

const RDPS_TOOL_NAMES = [
  "get_rdps_overview",
  "list_open_rdps_alerts",
  "get_reference_data_changes",
  "explain_party_rdps_status_change",
  "get_rdps_run_detail",
  "get_rdps_reports_summary",
  "get_party_rdps_monitoring_history",
  "trigger_manual_rdps_scan",
] as const;

function tool(name: (typeof RDPS_TOOL_NAMES)[number]) {
  const t = ASSISTANT_TOOLS.find((t) => t.declaration.name === name);
  if (!t) throw new Error(`tool ${name} not found in ASSISTANT_TOOLS`);
  return t;
}

function accountContext(overrides: Partial<AccountContext> = {}): AccountContext {
  return {
    userId: "user_1",
    accountId: "acct_alpha",
    isPlatformAdmin: false,
    roleNames: ["MEMBER"],
    permissions: [],
    ...overrides,
  } as unknown as AccountContext;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("all 8 planned RDPS tools are registered", () => {
  it("every planned tool name exists in ASSISTANT_TOOLS", () => {
    const registryNames = new Set(ASSISTANT_TOOLS.map((t) => t.declaration.name));
    for (const name of RDPS_TOOL_NAMES) {
      expect(registryNames.has(name), `expected ${name} to exist in ASSISTANT_TOOLS`).toBe(true);
    }
  });
});

describe("read tools require compliance.rdps.read", () => {
  const readToolNames = RDPS_TOOL_NAMES.filter((n) => n !== "trigger_manual_rdps_scan");

  it.each(readToolNames)("%s is gated on compliance.rdps.read", (name) => {
    const t = tool(name);
    expect(t.access?.permission).toBe("compliance.rdps.read");
    expect(canUseTool(accountContext(), t.access)).toBe(false);
    expect(canUseTool(accountContext({ permissions: ["compliance.rdps.read"] }), t.access)).toBe(true);
  });
});

describe("trigger_manual_rdps_scan requires compliance.rdps.manage", () => {
  const t = tool("trigger_manual_rdps_scan");

  it("is gated on compliance.rdps.manage, not merely .read", () => {
    expect(t.access?.permission).toBe("compliance.rdps.manage");
    expect(canUseTool(accountContext({ permissions: ["compliance.rdps.read"] }), t.access)).toBe(false);
    expect(canUseTool(accountContext({ permissions: ["compliance.rdps.manage"] }), t.access)).toBe(true);
  });
});

describe("get_rdps_overview / get_rdps_reports_summary", () => {
  it("pass ctx.accountId into getReportsSummary and shape the response", async () => {
    queryServiceMock.getReportsSummary.mockResolvedValue({
      totalMonitoredParties: 10,
      openAlerts: 2,
      worseningLast30Days: 1,
      screenedLast30Days: 5,
      lastDeltaImpactRun: null,
      lastFullPopulationRun: null,
      lastRecallValidation: null,
    });

    const result = await tool("get_rdps_overview").execute(accountContext(), {});
    expect(queryServiceMock.getReportsSummary).toHaveBeenCalledWith("acct_alpha");
    expect(result).toMatchObject({ totalMonitoredParties: 10, openAlerts: 2 });
  });

  it("get_rdps_reports_summary also scopes to ctx.accountId", async () => {
    queryServiceMock.getReportsSummary.mockResolvedValue({
      totalMonitoredParties: 0,
      openAlerts: 0,
      worseningLast30Days: 0,
      screenedLast30Days: 0,
      lastDeltaImpactRun: null,
      lastFullPopulationRun: null,
      lastRecallValidation: null,
    });

    await tool("get_rdps_reports_summary").execute(accountContext({ accountId: "acct_beta" }), {});
    expect(queryServiceMock.getReportsSummary).toHaveBeenCalledWith("acct_beta");
  });
});

describe("list_open_rdps_alerts", () => {
  it("always requests dispositioned:false and scopes to ctx.accountId", async () => {
    queryServiceMock.listAlerts.mockResolvedValue({ alerts: [], total: 0 });

    await tool("list_open_rdps_alerts").execute(accountContext(), {});
    expect(queryServiceMock.listAlerts).toHaveBeenCalledWith("acct_alpha", expect.objectContaining({ dispositioned: false }));
  });
});

describe("explain_party_rdps_status_change / get_party_rdps_monitoring_history", () => {
  it("returns an error, not another tenant's data, when getPartyMonitoringHistory resolves null", async () => {
    queryServiceMock.getPartyMonitoringHistory.mockResolvedValue(null);

    const result: any = await tool("explain_party_rdps_status_change").execute(accountContext(), { partyId: "party_other_tenant" });
    expect(queryServiceMock.getPartyMonitoringHistory).toHaveBeenCalledWith("acct_alpha", "party_other_tenant");
    expect(result.error).toBeTruthy();
  });

  it("get_party_rdps_monitoring_history scopes the lookup to ctx.accountId", async () => {
    queryServiceMock.getPartyMonitoringHistory.mockResolvedValue([]);

    await tool("get_party_rdps_monitoring_history").execute(accountContext({ accountId: "acct_gamma" }), { partyId: "party_1" });
    expect(queryServiceMock.getPartyMonitoringHistory).toHaveBeenCalledWith("acct_gamma", "party_1");
  });
});

describe("get_rdps_run_detail", () => {
  it("returns aggregate run metadata and only this tenant's outcome count, never other tenants' outcome detail", async () => {
    queryServiceMock.getRun.mockResolvedValue({
      id: "run_1",
      runType: "DELTA_IMPACT",
      status: "COMPLETED",
      triggeredBy: "CRON",
      candidatePartyCount: 3,
      screenedCount: 3,
      worsenedCount: 1,
      erroredCount: 0,
      startedAt: new Date("2026-08-20T00:00:00Z"),
      completedAt: new Date("2026-08-20T00:05:00Z"),
    });
    queryServiceMock.listOutcomesForRun.mockResolvedValue({ outcomes: [], total: 2 });

    const result: any = await tool("get_rdps_run_detail").execute(accountContext(), { runId: "run_1" });

    expect(queryServiceMock.listOutcomesForRun).toHaveBeenCalledWith("acct_alpha", "run_1", expect.objectContaining({ pageSize: 1 }));
    expect(result.thisAccountOutcomeCount).toBe(2);
    expect(result).not.toHaveProperty("outcomes");
  });

  it("surfaces a not-found error rather than throwing when the run doesn't exist", async () => {
    queryServiceMock.getRun.mockResolvedValue(null);

    const result: any = await tool("get_rdps_run_detail").execute(accountContext(), { runId: "missing" });
    expect(result.error).toBeTruthy();
  });
});

describe("trigger_manual_rdps_scan", () => {
  it("rejects a TARGETED scan with no matching parties in this tenant, never falling through to another tenant's parties", async () => {
    dbMock.party.findMany.mockResolvedValue([]);

    const result: any = await tool("trigger_manual_rdps_scan").execute(accountContext(), {
      jobType: "TARGETED",
      partyIds: ["party_owned_by_another_tenant"],
    });

    expect(dbMock.party.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acct_alpha" }) })
    );
    expect(result.error).toBeTruthy();
    expect(dbMock.rdpsRun.create).not.toHaveBeenCalled();
  });

  it("runs a TARGETED scan only over parties confirmed to belong to ctx.accountId, and audits the trigger", async () => {
    dbMock.party.findMany.mockResolvedValue([{ id: "party_1" }]);
    dbMock.rdpsRun.create.mockResolvedValue({ id: "run_new" });
    dbMock.rdpsRun.update.mockResolvedValue({ id: "run_new", status: "COMPLETED" });
    recordRdpsOutcome.mockResolvedValue({ outcomeId: "o1", isWorsening: false, errored: false });

    await tool("trigger_manual_rdps_scan").execute(accountContext(), {
      jobType: "TARGETED",
      partyIds: ["party_1"],
    });

    expect(recordRdpsOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run_new", accountId: "acct_alpha", partyId: "party_1" })
    );
    expect(dbMock.rdpsRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "run_new" }, data: expect.objectContaining({ status: "COMPLETED" }) })
    );
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "RDPS_MANUAL_SCAN_TRIGGERED", accountId: "acct_alpha" }));
  });

  it("marks the run PARTIAL, not COMPLETED, when any TARGETED outcome errors", async () => {
    dbMock.party.findMany.mockResolvedValue([{ id: "party_1" }]);
    dbMock.rdpsRun.create.mockResolvedValue({ id: "run_new" });
    dbMock.rdpsRun.update.mockResolvedValue({ id: "run_new", status: "PARTIAL" });
    recordRdpsOutcome.mockResolvedValue({ outcomeId: "o1", isWorsening: false, errored: true });

    await tool("trigger_manual_rdps_scan").execute(accountContext(), {
      jobType: "TARGETED",
      partyIds: ["party_1"],
    });

    expect(dbMock.rdpsRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PARTIAL" }) })
    );
  });

  it("requires partyIds for a TARGETED scan", async () => {
    const result: any = await tool("trigger_manual_rdps_scan").execute(accountContext(), { jobType: "TARGETED" });
    expect(result.error).toBeTruthy();
    expect(dbMock.party.findMany).not.toHaveBeenCalled();
  });

  it("delegates DELTA_IMPACT/FULL_POPULATION to triggerManualScan and surfaces the already-running error as a message, not a throw", async () => {
    queryServiceMock.triggerManualScan.mockRejectedValue(new queryServiceMock.RdpsFullPopulationAlreadyRunningError("already running"));

    const result: any = await tool("trigger_manual_rdps_scan").execute(accountContext(), { jobType: "FULL_POPULATION" });

    expect(queryServiceMock.triggerManualScan).toHaveBeenCalledWith("user_1", expect.objectContaining({ jobType: "FULL_POPULATION" }));
    expect(result.error).toBeTruthy();
  });
});
