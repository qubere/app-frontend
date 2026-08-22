import { beforeEach, describe, expect, it, vi } from "vitest";

const { findJobs, findOutbox } = vi.hoisted(() => ({ findJobs: vi.fn(), findOutbox: vi.fn() }));

vi.mock("@qubere/db", () => ({
  db: {
    pipelineJob: { findMany: findJobs },
    workflowOutboxEvent: { findMany: findOutbox },
  },
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
    findJobs.mockResolvedValue([]);
    await expect(getTmsPipelineStatus("acc_1", "shp_1")).resolves.toBeNull();
    expect(findJobs).toHaveBeenCalledWith(
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
    const now = new Date();
    findJobs.mockResolvedValue([{
      id: "job_1",
      workflowType: TMS_WORKFLOW_TYPE,
      status: "PROCESSING",
      currentStep: 2,
      totalSteps: 6,
      attemptCount: 2,
      maxAttempts: 3,
      heartbeatAt: now,
      errorMessage: null,
      nextRetryAt: null,
      startedAt: new Date(),
      completedAt: null,
      correlationId: "corr_1",
      createdAt: now,
      updatedAt: now,
      stepExecutions: [
        { stepNumber: 1, status: "SUCCESS", attempt: 1, startedAt: new Date(), completedAt: new Date(), output: {}, errorMessage: null },
        { stepNumber: 2, status: "FAILED", attempt: 1, startedAt: new Date(), completedAt: new Date(), output: null, errorMessage: "provider timeout" },
        { stepNumber: 2, status: "RUNNING", attempt: 2, startedAt: new Date(), completedAt: null, output: null, errorMessage: null },
      ],
    }]);
    findOutbox.mockResolvedValue([{
      aggregateId: "job_1",
      status: "DISPATCHED",
      attemptCount: 1,
      maxAttempts: 12,
      nextAttemptAt: now,
      dispatchedAt: now,
      lastError: null,
    }]);
    const status = await getTmsPipelineStatus("acc_1", "shp_1");
    expect(status?.activeAgent).toBe("Shipment Enrichment Agent");
    expect(status?.steps[1]).toMatchObject({ status: "RUNNING", attempt: 2 });
    expect(status?.progressPercent).toBe(17);
    expect(status?.dispatch?.status).toBe("DISPATCHED");
    expect(status?.runs).toHaveLength(1);
  });

  it("surfaces an undelivered pending job as stalled", async () => {
    const old = new Date(Date.now() - 3 * 60_000);
    findJobs.mockResolvedValue([{
      id: "job_pending",
      workflowType: TMS_WORKFLOW_TYPE,
      status: "PENDING",
      currentStep: 0,
      totalSteps: 6,
      attemptCount: 0,
      maxAttempts: 3,
      heartbeatAt: null,
      errorMessage: null,
      nextRetryAt: null,
      startedAt: null,
      completedAt: null,
      correlationId: "corr_pending",
      createdAt: old,
      updatedAt: old,
      stepExecutions: [],
    }]);
    findOutbox.mockResolvedValue([{
      aggregateId: "job_pending",
      status: "FAILED",
      attemptCount: 1,
      maxAttempts: 12,
      nextAttemptAt: new Date(),
      dispatchedAt: null,
      lastError: "temporary publish failure",
    }]);
    const status = await getTmsPipelineStatus("acc_1", "shp_1");
    expect(status).toMatchObject({
      stalled: true,
      stallReason: "temporary publish failure",
      dispatch: { status: "FAILED" },
    });
  });

  it("rejects malformed stored extraction instead of promoting it", () => {
    expect(parseStoredFreightExtraction("{\"documentType\":\"BILL_OF_LADING\"}")).toBeNull();
    expect(parseStoredFreightExtraction("not-json")).toBeNull();
  });
});
