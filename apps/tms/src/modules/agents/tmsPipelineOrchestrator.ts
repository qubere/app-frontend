import { Prisma } from "@prisma/client";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import { runDocumentIntake } from "./services/documentIntakeAgent";
import { runShipmentEnrichment } from "./services/shipmentEnrichmentAgent";
import { runDocumentReadiness } from "./services/documentReadinessAgent";
import { runMovementReadiness } from "./services/movementReadinessAgent";
import { runCostCarrierReadiness } from "./services/costCarrierReadinessAgent";
import { runOperationalRisk } from "./services/operationalRiskAgent";
import {
  asState,
  loadJob,
  PENDING_STALL_THRESHOLD_MS,
  safeJson,
  STALL_THRESHOLD_MS,
  TMS_PIPELINE_OUTBOX_EVENT,
  TMS_PIPELINE_STEPS,
  TMS_WORKFLOW_TYPE,
  TMS_WORKFLOW_VERSION,
  type StepResult,
} from "./shared/pipelineShared";

export {
  TMS_PIPELINE_OUTBOX_EVENT,
  TMS_PIPELINE_STEPS,
  TMS_WORKFLOW_TYPE,
  TMS_WORKFLOW_VERSION,
};

type StepRunner = (
  job: Awaited<ReturnType<typeof loadJob>>,
  documentId: string
) => Promise<StepResult>;

const STEP_RUNNERS_BY_NUMBER: Record<number, StepRunner> = {
  1: runDocumentIntake,
  2: runShipmentEnrichment,
  3: runDocumentReadiness,
  4: runMovementReadiness,
  5: runCostCarrierReadiness,
  6: runOperationalRisk,
};

export async function enqueueTmsDocumentPipeline(input: {
  accountId: string;
  userId: string;
  shipmentId: string;
  documentId: string;
  correlationId: string;
  runKey?: string;
  forceExtraction?: boolean;
}) {
  const document = await db.shipmentDocument.findFirst({
    where: {
      id: input.documentId,
      accountId: input.accountId,
      shipmentId: input.shipmentId,
      shipment: { deletedAt: null },
    },
    select: { id: true, fileName: true, checksum: true, updatedAt: true },
  });
  if (!document) throw new Error("The document is not attached to this account's shipment.");

  const triggerVersion = document.checksum || document.updatedAt.toISOString();
  const idempotencyKey = `${TMS_WORKFLOW_VERSION}:${input.shipmentId}:${document.id}:${input.runKey ?? triggerVersion}`;
  const data = {
    accountId: input.accountId,
    userId: input.userId,
    shipmentId: input.shipmentId,
    workflowType: TMS_WORKFLOW_TYPE,
    idempotencyKey,
    correlationId: input.correlationId,
    status: "PENDING",
    currentStep: 0,
    totalSteps: TMS_PIPELINE_STEPS.length,
    priority: 10,
    maxAttempts: 3,
    state: {
      workflowVersion: TMS_WORKFLOW_VERSION,
      trigger: "DOCUMENT_UPLOADED",
      documentId: document.id,
      fileName: document.fileName,
      forceExtraction: Boolean(input.forceExtraction),
    },
  };

  let job = await db.pipelineJob.findFirst({
    where: { accountId: input.accountId, idempotencyKey },
  });
  if (!job) {
    try {
      job = await db.$transaction(async (tx) => {
        const createdJob = await tx.pipelineJob.create({ data });
        const eventKey = `${TMS_PIPELINE_OUTBOX_EVENT}:${createdJob.id}`;
        await tx.workflowOutboxEvent.upsert({
          where: { eventKey },
          update: { status: "PENDING", attemptCount: 0, nextAttemptAt: new Date(), lockedAt: null, lastError: null },
          create: {
            accountId: input.accountId,
            eventKey,
            eventType: TMS_PIPELINE_OUTBOX_EVENT,
            aggregateType: "PipelineJob",
            aggregateId: createdJob.id,
            correlationId: input.correlationId,
            payload: { jobId: createdJob.id },
          },
        });
        return createdJob;
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        job = await db.pipelineJob.findFirst({
          where: { accountId: input.accountId, idempotencyKey },
        });
      } else {
        throw error;
      }
    }
  }

  if (!job) throw new Error("Failed to enqueue TMS document processing pipeline.");

  await createAuditLog({
    accountId: input.accountId,
    userId: input.userId,
    action: "TMS_PIPELINE_ENQUEUED",
    entity: "PipelineJob",
    entityId: job.id,
    source: "SYSTEM",
    correlationId: input.correlationId,
    metadata: { shipmentId: input.shipmentId, documentId: document.id, idempotencyKey },
  });

  return job;
}

export async function executeTmsPipelineJob(jobId: string) {
  const initial = await loadJob(jobId);
  if (!initial || initial.workflowType !== TMS_WORKFLOW_TYPE) throw new Error("TMS pipeline job not found.");
  if (initial.status === "COMPLETED") return initial;
  if (initial.attemptCount >= initial.maxAttempts) throw new Error("TMS pipeline exhausted its retry budget.");
  if (initial.status === "PROCESSING" && initial.heartbeatAt && Date.now() - initial.heartbeatAt.getTime() <= STALL_THRESHOLD_MS) return initial;
  if (initial.status === "FAILED" && initial.nextRetryAt && initial.nextRetryAt.getTime() > Date.now()) {
    throw new Error(`TMS pipeline retry is scheduled for ${initial.nextRetryAt.toISOString()}.`);
  }

  const claimed = await db.pipelineJob.updateMany({
    where: {
      id: jobId,
      attemptCount: { lt: initial.maxAttempts },
      OR: [
        { status: "PENDING" },
        { status: "FAILED", OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }] },
        { status: "PROCESSING", heartbeatAt: { lt: new Date(Date.now() - STALL_THRESHOLD_MS) } },
      ],
    },
    data: {
      status: "PROCESSING",
      errorMessage: null,
      startedAt: initial.startedAt ?? new Date(),
      completedAt: null,
      lockedAt: new Date(),
      heartbeatAt: new Date(),
      nextRetryAt: null,
      attemptCount: { increment: 1 },
    },
  });
  if (claimed.count !== 1) return loadJob(jobId);

  const job = await loadJob(jobId);
  if (!job) throw new Error("TMS pipeline disappeared after claim.");
  const state = asState(job.state);
  if (!state.documentId) throw new Error("TMS pipeline is missing its document trigger.");
  const completedSteps = new Set(job.stepExecutions.filter((step) => ["SUCCESS", "REVIEW_REQUIRED"].includes(step.status)).map((step) => step.stepNumber));

  await createAuditLog({
    accountId: job.accountId, userId: job.userId, action: "TMS_PIPELINE_STARTED",
    entity: "PipelineJob", entityId: job.id, source: "SYSTEM", correlationId: job.correlationId,
    metadata: { shipmentId: job.shipmentId, documentId: state.documentId, attempt: job.attemptCount },
  });

  try {
    for (let index = 0; index < TMS_PIPELINE_STEPS.length; index++) {
      const definition = TMS_PIPELINE_STEPS[index];
      if (completedSteps.has(definition.stepNumber)) continue;
      await db.pipelineJob.update({ where: { id: job.id }, data: { currentStep: definition.stepNumber, heartbeatAt: new Date(), lockedAt: new Date() } });
      const execution = await db.pipelineStepExecution.create({
        data: { jobId: job.id, stepNumber: definition.stepNumber, agentName: definition.agentName, status: "RUNNING", attempt: job.attemptCount },
      });
      try {
        const runner = STEP_RUNNERS_BY_NUMBER[definition.stepNumber];
        if (!runner) throw new Error(`No agent registered for step ${definition.stepNumber}`);
        
        const result = await runner(job, state.documentId);
        const accumulatedData = {
          ...((state as any).accumulatedData || {}),
          [definition.agentName]: result.details,
        };
        (state as any).accumulatedData = accumulatedData;

        await db.pipelineStepExecution.update({
          where: { id: execution.id },
          data: { status: result.status, completedAt: new Date(), output: safeJson({ summary: result.summary, confidence: result.confidence, decisionId: result.decisionId, ...result.details }) },
        });
        await db.pipelineJob.update({
          where: { id: job.id },
          data: {
            heartbeatAt: new Date(),
            state: safeJson({ ...state, lastCompletedStep: definition.stepNumber, lastSummary: result.summary, accumulatedData }),
          },
        });
        await createAuditLog({
          accountId: job.accountId, userId: job.userId, action: "TMS_AGENT_STEP_COMPLETED",
          entity: "Shipment", entityId: job.shipmentId, source: "AGENT", correlationId: job.correlationId,
          metadata: { jobId: job.id, documentId: state.documentId, stepNumber: definition.stepNumber, agentName: definition.agentName, status: result.status, summary: result.summary, decisionId: result.decisionId },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db.pipelineStepExecution.update({ where: { id: execution.id }, data: { status: "FAILED", completedAt: new Date(), errorMessage: message.slice(0, 2000) } });
        throw error;
      }
    }

    const completed = await db.pipelineJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", currentStep: TMS_PIPELINE_STEPS.length, completedAt: new Date(), lockedAt: null, heartbeatAt: new Date(), errorMessage: null },
      include: { stepExecutions: true },
    });
    await createAuditLog({
      accountId: job.accountId, userId: job.userId, action: "TMS_PIPELINE_COMPLETED",
      entity: "PipelineJob", entityId: job.id, source: "SYSTEM", correlationId: job.correlationId,
      metadata: { shipmentId: job.shipmentId, documentId: state.documentId, attempt: job.attemptCount },
    });
    return completed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retryable = job.attemptCount < job.maxAttempts;
    const nextRetryAt = retryable ? new Date(Date.now() + Math.min(60_000, 5_000 * 2 ** Math.max(0, job.attemptCount - 1))) : null;
    await db.pipelineJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 2000), completedAt: new Date(), lockedAt: null, heartbeatAt: new Date(), nextRetryAt },
    });
    await createAuditLog({
      accountId: job.accountId, userId: job.userId, action: "TMS_PIPELINE_FAILED",
      entity: "PipelineJob", entityId: job.id, source: "SYSTEM", correlationId: job.correlationId, success: false,
      metadata: { shipmentId: job.shipmentId, documentId: state.documentId, attempt: job.attemptCount, retryable, nextRetryAt: nextRetryAt?.toISOString(), error: message },
    });
    throw error;
  }
}

export async function getTmsPipelineStatus(accountId: string, shipmentId: string) {
  const jobs = await db.pipelineJob.findMany({
    where: { accountId, shipmentId, workflowType: TMS_WORKFLOW_TYPE },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { stepExecutions: { orderBy: [{ attempt: "desc" }, { stepNumber: "asc" }] } },
  });
  if (jobs.length === 0) return null;
  const outboxEvents = await db.workflowOutboxEvent.findMany({
    where: { eventType: TMS_PIPELINE_OUTBOX_EVENT, aggregateId: { in: jobs.map((job) => job.id) } },
  });
  const outboxByJob = new Map(outboxEvents.map((event) => [event.aggregateId, event]));
  const runs = jobs.map((job) => {
    const latestByStep = new Map<number, (typeof job.stepExecutions)[number]>();
    for (const execution of job.stepExecutions) {
      const current = latestByStep.get(execution.stepNumber);
      if (!current || execution.attempt > current.attempt) latestByStep.set(execution.stepNumber, execution);
    }
    const outbox = outboxByJob.get(job.id);
    const processingStalled = job.status === "PROCESSING" && !!job.heartbeatAt && Date.now() - job.heartbeatAt.getTime() > STALL_THRESHOLD_MS;
    const pendingStalled = job.status === "PENDING" && (
      Date.now() - job.createdAt.getTime() > PENDING_STALL_THRESHOLD_MS || outbox?.status === "FAILED"
    );
    const stalled = processingStalled || pendingStalled;
    const stallReason = processingStalled
      ? "The active worker heartbeat expired. The recovery sweep will safely reclaim this run."
      : pendingStalled
        ? outbox?.lastError || "The dispatch event has not claimed this queued job. Recovery is pending."
        : null;
    return {
      jobId: job.id,
      workflowType: job.workflowType,
      status: job.status,
      currentStep: job.currentStep,
      totalSteps: job.totalSteps,
      progressPercent: job.status === "COMPLETED" ? 100 : Math.round((Math.max(0, job.currentStep - (job.status === "PROCESSING" ? 1 : 0)) / job.totalSteps) * 100),
      activeAgent: job.status === "PROCESSING" ? TMS_PIPELINE_STEPS.find((step) => step.stepNumber === job.currentStep)?.agentName ?? null : null,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
      stalled,
      stallReason,
      errorMessage: job.errorMessage,
      nextRetryAt: job.nextRetryAt,
      lastHeartbeatAt: job.heartbeatAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      correlationId: job.correlationId,
      dispatch: outbox ? {
        status: outbox.status,
        attemptCount: outbox.attemptCount,
        maxAttempts: outbox.maxAttempts,
        nextAttemptAt: outbox.nextAttemptAt,
        dispatchedAt: outbox.dispatchedAt,
        lastError: outbox.lastError,
      } : null,
      steps: TMS_PIPELINE_STEPS.map((definition) => {
        const execution = latestByStep.get(definition.stepNumber);
        return {
          ...definition,
          status: execution?.status ?? "PENDING",
          attempt: execution?.attempt ?? null,
          startedAt: execution?.startedAt ?? null,
          completedAt: execution?.completedAt ?? null,
          errorMessage: execution?.errorMessage ?? null,
          output: execution?.output ?? null,
        };
      }),
    };
  });
  return { ...runs[0], runs };
}

export async function retryTmsPipeline(accountId: string, shipmentId: string, userId: string) {
  const job = await db.pipelineJob.findFirst({
    where: { accountId, shipmentId, workflowType: TMS_WORKFLOW_TYPE },
    orderBy: { createdAt: "desc" },
  });
  if (!job) throw new Error("No TMS pipeline run exists for this shipment.");
  const outbox = await db.workflowOutboxEvent.findFirst({
    where: { eventType: TMS_PIPELINE_OUTBOX_EVENT, aggregateId: job.id },
  });
  const processingStalled = job.status === "PROCESSING" && !!job.heartbeatAt && Date.now() - job.heartbeatAt.getTime() > STALL_THRESHOLD_MS;
  const pendingStalled = job.status === "PENDING" && (
    Date.now() - job.createdAt.getTime() > PENDING_STALL_THRESHOLD_MS || outbox?.status === "FAILED"
  );
  const stalled = processingStalled || pendingStalled;
  if (job.status !== "FAILED" && !stalled) throw new Error(`The latest TMS pipeline is ${job.status} and cannot be retried.`);
  if (job.attemptCount >= job.maxAttempts) throw new Error("The TMS pipeline exhausted its retry budget.");
  const eventKey = `${TMS_PIPELINE_OUTBOX_EVENT}:${job.id}`;
  await db.$transaction(async (tx) => {
    await tx.pipelineJob.update({
      where: { id: job.id },
      data: { status: "PENDING", errorMessage: null, nextRetryAt: null, lockedAt: null, heartbeatAt: null, completedAt: null },
    });
    await tx.workflowOutboxEvent.upsert({
      where: { eventKey },
      update: { status: "PENDING", attemptCount: 0, nextAttemptAt: new Date(), lockedAt: null, lastError: null },
      create: {
        accountId,
        eventKey,
        eventType: TMS_PIPELINE_OUTBOX_EVENT,
        aggregateType: "PipelineJob",
        aggregateId: job.id,
        correlationId: job.correlationId,
        payload: { jobId: job.id },
      },
    });
  });
  await createAuditLog({
    accountId, userId, action: "TMS_PIPELINE_RETRY_REQUESTED", entity: "PipelineJob", entityId: job.id, source: "UI",
    correlationId: job.correlationId, metadata: { shipmentId, previousStatus: job.status, stalled },
  });
  return job.id;
}
