import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  queue: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@qubere/db", () => ({
  db: {
    workflowOutboxEvent: {
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
      update: mocks.update,
    },
  },
}));
vi.mock("../src/lib/tmsPipelineEngine", () => ({
  executeTmsPipelineJob: mocks.execute,
  TMS_PIPELINE_OUTBOX_EVENT: "tms.pipeline.requested",
  TMS_WORKFLOW_TYPE: "TMS_DOCUMENT_PROCESSING",
}));
vi.mock("../src/lib/inngest/tmsPipelineEvents", () => ({
  queueTmsPipelineJob: mocks.queue,
}));

import { dispatchTmsPipelineOutboxEvent } from "../src/lib/tmsPipelineOutbox";

function pendingEvent() {
  return {
    id: "evt_1",
    status: "PENDING",
    attemptCount: 0,
    maxAttempts: 12,
    nextAttemptAt: new Date(0),
  };
}

describe("TMS workflow outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INNGEST_EVENT_KEY = "test-key";
    mocks.findFirst.mockResolvedValue(pendingEvent());
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.update.mockResolvedValue({});
    mocks.queue.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.INNGEST_EVENT_KEY;
  });

  it("claims the persisted event before publishing and records delivery", async () => {
    await expect(dispatchTmsPipelineOutboxEvent("job_1")).resolves.toBe("INNGEST");
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "DISPATCHING" }),
    }));
    expect(mocks.queue).toHaveBeenCalledWith("job_1");
    expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "DISPATCHED" }),
    }));
  });

  it("keeps a failed publication recoverable with backoff", async () => {
    mocks.queue.mockRejectedValue(new Error("provider unavailable"));
    await expect(dispatchTmsPipelineOutboxEvent("job_1")).resolves.toBe("OUTBOX_PENDING");
    expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "FAILED",
        lastError: "provider unavailable",
        nextAttemptAt: expect.any(Date),
      }),
    }));
  });
});
