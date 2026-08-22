import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@qubere/db", () => ({
  db: { pipelineJob: { findFirst } },
}));
vi.mock("@qubere/decisions", () => ({ createAuditLog: vi.fn() }));

import {
  getTmsPipelineStatus,
  TMS_PIPELINE_STEPS,
  TMS_WORKFLOW_TYPE,
} from "../src/lib/tmsPipelineEngine";
import { parseStoredFreightExtraction } from "../src/modules/documents/services/documentFreightExtraction";

describe("durable TMS document orchestration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the six honest document-to-operations stages", () => {
    expect(TMS_PIPELINE_STEPS.map((step) => step.agentName)).toEqual([
      "Document Intake Agent",
      "Shipment Enrichment Agent",
      "Document Readiness Agent",
      "Movement Readiness Agent",
      "Cost & Carrier Readiness Agent",
      "Operational Risk Agent",
    ]);
  });

  it("returns no synthetic completion when no persisted job exists", async () => {
    findFirst.mockResolvedValue(null);
    await expect(getTmsPipelineStatus("acc_1", "shp_1")).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          accountId: "acc_1",
          shipmentId: "shp_1",
          workflowType: TMS_WORKFLOW_TYPE,
        },
      })
    );
  });

  it("reports the latest durable attempt and active agent", async () => {
    findFirst.mockResolvedValue({
      id: "job_1",
      workflowType: TMS_WORKFLOW_TYPE,
      status: "PROCESSING",
      currentStep: 2,
      totalSteps: 6,
      attemptCount: 2,
      maxAttempts: 3,
      heartbeatAt: new Date(),
      errorMessage: null,
      nextRetryAt: null,
      startedAt: new Date(),
      completedAt: null,
      correlationId: "corr_1",
      stepExecutions: [
        { stepNumber: 1, status: "SUCCESS", attempt: 1, startedAt: new Date(), completedAt: new Date(), output: {}, errorMessage: null },
        { stepNumber: 2, status: "FAILED", attempt: 1, startedAt: new Date(), completedAt: new Date(), output: null, errorMessage: "provider timeout" },
        { stepNumber: 2, status: "RUNNING", attempt: 2, startedAt: new Date(), completedAt: null, output: null, errorMessage: null },
      ],
    });
    const status = await getTmsPipelineStatus("acc_1", "shp_1");
    expect(status?.activeAgent).toBe("Shipment Enrichment Agent");
    expect(status?.steps[1]).toMatchObject({ status: "RUNNING", attempt: 2 });
    expect(status?.progressPercent).toBe(17);
  });

  it("rejects malformed stored extraction instead of promoting it", () => {
    expect(parseStoredFreightExtraction("{\"documentType\":\"BILL_OF_LADING\"}")).toBeNull();
    expect(parseStoredFreightExtraction("not-json")).toBeNull();
  });
});
