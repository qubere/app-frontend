import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbMock, logEventMock, recordUsageEventMock } = vi.hoisted(() => ({
  dbMock: {
    shipment: {
      findUnique: vi.fn().mockResolvedValue({ clientId: "cli_1", importerOfRecordId: "imp_1" }),
      findFirst: vi.fn().mockResolvedValue({ id: "shp_1", accountId: "acc_1", lineItems: [], documents: [], shipmentParties: [], exceptionItems: [] }),
    },
    agentExecutionRecord: {
      create: vi.fn().mockResolvedValue({ id: "exec_1" }),
    },
    shipmentDocument: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    reconciliationIssue: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    exceptionItem: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "exc_1" }),
    },
    fact: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    webhookEndpoint: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    agentDecision: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
  logEventMock: vi.fn().mockResolvedValue({}),
  recordUsageEventMock: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({ logEvent: logEventMock }));
vi.mock("@qubere/billing", () => ({ recordUsageEvent: recordUsageEventMock, AGENT_BILLING_EVENT_MAP: {} }));
vi.mock("@/modules/reconciliation/reconciliationEngine", () => ({
  ReconciliationEngine: { reconcileShipment: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/modules/shipment/canonicalShipmentService", () => ({
  CanonicalShipmentService: { getCanonicalState: vi.fn().mockResolvedValue({ status: "DRAFT" }) },
}));
vi.mock("@/lib/queue", () => ({
  PgQueue: { updateProgress: vi.fn().mockResolvedValue({}) },
}));

import { PipelineOrchestrator } from "../src/modules/agents/pipelineOrchestrator";

describe("PipelineOrchestrator Short-Circuiting Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("short-circuits and terminates downstream execution when Document Intake Agent skips due to missing file", async () => {
    const result = await PipelineOrchestrator.processEvent({
      shipmentId: "shp_test_short_circuit",
      accountId: "acc_test_123",
      userId: "usr_test_123",
      triggerEvent: "DOCUMENT_UPLOADED",
      payload: {}, // No fileUrl or fileName provided
    });

    expect(result.agentsExecuted).toEqual(["Document Intake Agent"]);
    expect(result.agentsExecuted).not.toContain("Document Intelligence Agent");
    expect(result.agentsExecuted).not.toContain("Product Intelligence Agent");

    expect(dbMock.agentExecutionRecord.create).toHaveBeenCalledTimes(1);
    const createdRecord = dbMock.agentExecutionRecord.create.mock.calls[0][0].data;
    expect(createdRecord.agentName).toBe("Document Intake Agent");
    expect(createdRecord.status).toBe("SKIPPED");
    expect(createdRecord.nextStep).toBe("Terminated (Short-Circuited)");
  });

  it("short-circuits execution when an upstream agent throws an error", async () => {
    vi.spyOn(PipelineOrchestrator as any, "runSingleAgent").mockImplementationOnce(async (...args: any[]) => {
      const agentName = args[0];
      if (agentName === "Document Intake Agent") {
        throw new Error("Simulated OCR service outage");
      }
      return { input: {}, output: {} };
    });

    const result = await PipelineOrchestrator.processEvent({
      shipmentId: "shp_test_error_circuit",
      accountId: "acc_test_123",
      userId: "usr_test_123",
      triggerEvent: "DOCUMENT_UPLOADED",
      payload: { fileName: "invoice.pdf", fileUrl: "https://example.com/invoice.pdf" },
    });

    expect(result.agentsExecuted).toEqual([]);
    expect(dbMock.agentExecutionRecord.create).toHaveBeenCalledTimes(1);
    const record = dbMock.agentExecutionRecord.create.mock.calls[0][0].data;
    expect(record.status).toBe("FAILED");
    expect(record.error).toBe("Simulated OCR service outage");
    expect(record.nextStep).toBe("Terminated (Short-Circuited)");
  });
});
