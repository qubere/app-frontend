import { describe, expect, it, vi, beforeEach } from "vitest";
import { computeAnalyticsMetrics } from "@/lib/analytics/metricComputer";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: {
    customsFiling: {
      findMany: vi.fn(),
    },
    exceptionItem: {
      findMany: vi.fn(),
    },
    extractionField: {
      findMany: vi.fn(),
    },
    agentDecision: {
      count: vi.fn(),
    },
    postSummaryCorrection: {
      count: vi.fn(),
    },
  },
}));

describe("computeAnalyticsMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Touch rate: two decision counts (presented, then touched).
    vi.mocked(db.agentDecision.count).mockResolvedValue(0);
  });

  it("represents empty database records honestly as null, never a fabricated 100% or 0", async () => {
    vi.mocked(db.customsFiling.findMany).mockResolvedValue([]);
    vi.mocked(db.exceptionItem.findMany).mockResolvedValue([]);
    vi.mocked(db.postSummaryCorrection.count).mockResolvedValue(0);

    const metrics = await computeAnalyticsMetrics("acc-123");

    expect(metrics).toEqual({
      cyclTimeMedianHours: null,
      firstPassRate: null,
      exceptionAgeAvgHours: null,
      exceptionAgeBuckets: { under24h: 0, days1to7: 0, days7to30: 0, over30d: 0 },
      touchRate: null,
      touchCounts: { presented: 0, touched: 0 },
      dutyPerEntry: null,
      openExceptions: 0,
      filedEntries: 0,
      pscCount: 0,
    });
  });

  it("calculates median cycle time, first pass rate, and duty per entry correctly", async () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

    vi.mocked(db.customsFiling.findMany)
      .mockResolvedValueOnce([
        {
          id: "f1",
          updatedAt: now,
          totalDuties: "100.50",
          shipment: { createdAt: twoHoursAgo },
        } as any,
        {
          id: "f2",
          updatedAt: now,
          totalDuties: "300.50",
          shipment: { createdAt: fourHoursAgo },
        } as any,
      ])
      .mockResolvedValueOnce([
        { id: "f1", responses: [] } as any,
        { id: "f2", responses: [{ status: "REJECTED" }] } as any,
      ])
      .mockResolvedValueOnce([
        { id: "f1", totalDuties: "100.50" } as any,
        { id: "f2", totalDuties: "300.50" } as any,
      ]);

    vi.mocked(db.exceptionItem.findMany).mockResolvedValue([
      { id: "ex1", createdAt: twoHoursAgo } as any,
    ]);

    // 8 decisions presented to a human, 2 of them modified → 25% touch rate.
    vi.mocked(db.agentDecision.count)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2);

    vi.mocked(db.postSummaryCorrection.count).mockResolvedValue(2);

    const metrics = await computeAnalyticsMetrics("acc-123");

    expect(metrics.cyclTimeMedianHours).toBe(3);
    expect(metrics.firstPassRate).toBe(50);
    expect(metrics.touchRate).toBe(25);
    expect(metrics.touchCounts).toEqual({ presented: 8, touched: 2 });
    expect(metrics.dutyPerEntry).toBe(200.5);
    expect(metrics.openExceptions).toBe(1);
    expect(metrics.filedEntries).toBe(2);
    expect(metrics.pscCount).toBe(2);
  });

  it("touch-rate denominator counts only decisions actually presented to a human (not auto-verified)", async () => {
    vi.mocked(db.customsFiling.findMany).mockResolvedValue([]);
    vi.mocked(db.exceptionItem.findMany).mockResolvedValue([]);
    vi.mocked(db.postSummaryCorrection.count).mockResolvedValue(0);
    vi.mocked(db.agentDecision.count).mockResolvedValue(0);

    await computeAnalyticsMetrics("acc-123");

    // First call = the "presented" denominator.
    const presentedWhere = vi.mocked(db.agentDecision.count).mock.calls[0][0]?.where as any;
    expect(presentedWhere.accountId).toBe("acc-123");
    expect(presentedWhere.autoApproved).toBe(false);
  });

  it("scopes the touch-rate query to clientId when a client filter is requested", async () => {
    vi.mocked(db.customsFiling.findMany).mockResolvedValue([]);
    vi.mocked(db.exceptionItem.findMany).mockResolvedValue([]);
    vi.mocked(db.postSummaryCorrection.count).mockResolvedValue(0);
    vi.mocked(db.agentDecision.count).mockResolvedValue(0);

    await computeAnalyticsMetrics("acc-123", "client-456");

    const presentedWhere = vi.mocked(db.agentDecision.count).mock.calls[0][0]?.where as any;
    expect(presentedWhere.shipment).toEqual({ clientId: "client-456" });
  });
});
