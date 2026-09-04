import { authorizeWrite } from "@/lib/api/auth-guards";
import { buildErrorResponse, generateRequestId, handleApiError } from "@/lib/api/error";
import { checkIdempotency, persistIdempotency } from "@/lib/api/idempotency";
import { createAuditLog } from "@/lib/audit";
import { db, withAccountIdContext } from "@/lib/db";
import { PipelineOrchestrator } from "@/modules/agents/pipelineOrchestrator";
import { logApiRequest, logEvent } from "@/lib/logging/logger";
import { NextResponse } from "next/server";
import { after } from "next/server";

/**
 * Re-queue a failed or stalled pipeline job.
 *
 * Jobs can fail or stall mid-run (lockedAt older than 5 minutes). This endpoint
 * unlocks and re-queues the job so background workers or in-process execution
 * can resume the pipeline run from where it left off.
 *
 * This route predates `withAuthenticatedRoute` and hand-rolls auth, so it
 * doesn't get that wrapper's automatic request logging -- logged explicitly
 * here instead.
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = generateRequestId();
  const startedAt = Date.now();
  const { pathname } = new URL(req.url);

  try {
    const { ctx, errorResponse } = await authorizeWrite();
    if (errorResponse) {
      logApiRequest({ method: req.method, path: pathname, status: errorResponse.status, durationMs: Date.now() - startedAt, requestId });
      return errorResponse;
    }
    if (!ctx) {
      const response = buildErrorResponse(401, "UNAUTHENTICATED", "Authentication required", requestId);
      logApiRequest({ method: req.method, path: pathname, status: response.status, durationMs: Date.now() - startedAt, requestId });
      return response;
    }

    const { idempotencyKey, requestHash, cachedResponse, errorResponse: idempError } = await checkIdempotency(req, ctx.accountId, requestId);
    if (cachedResponse) {
      logApiRequest({ method: req.method, path: pathname, status: cachedResponse.status, durationMs: Date.now() - startedAt, accountId: ctx.accountId, userId: ctx.userId, requestId });
      return cachedResponse;
    }
    if (idempError) {
      logApiRequest({ method: req.method, path: pathname, status: idempError.status, durationMs: Date.now() - startedAt, accountId: ctx.accountId, userId: ctx.userId, requestId });
      return idempError;
    }

    const { id } = await context.params;

    const response = await withAccountIdContext(ctx.accountId, async () => {
      const shipment = await db.shipment.findFirst({
        where: { accountId: ctx.accountId, id, deletedAt: null },
        select: { id: true },
      });
      if (!shipment) {
        return buildErrorResponse(404, "SHIPMENT_NOT_FOUND", "Shipment not found", requestId);
      }

      const job = await db.pipelineJob.findFirst({
        where: { shipmentId: shipment.id, accountId: ctx.accountId },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, lockedAt: true },
      });
      if (!job) {
        return buildErrorResponse(
          404,
          "NO_PIPELINE_JOB",
          "No pipeline run has been recorded for this shipment",
          requestId
        );
      }

      const STALL_THRESHOLD_MS = 5 * 60 * 1000;
      const isStalled =
        job.status === "PROCESSING" &&
        job.lockedAt !== null &&
        Date.now() - new Date(job.lockedAt).getTime() > STALL_THRESHOLD_MS;

      if (job.status !== "FAILED" && !isStalled) {
        return buildErrorResponse(
          409,
          "JOB_NOT_FAILED",
          `The latest pipeline run is ${job.status}. Only a failed or stalled run can be retried.`,
          requestId
        );
      }

      const applied = await db.pipelineJob.updateMany({
        where: {
          id: job.id,
          accountId: ctx.accountId,
          OR: [
            { status: "FAILED" },
            {
              status: "PROCESSING",
              lockedAt: { lt: new Date(Date.now() - STALL_THRESHOLD_MS) },
            },
          ],
        },
        data: {
          status: "PENDING",
          errorMessage: null,
          lockedAt: null,
          startedAt: null,
          completedAt: null,
        },
      });

      if (applied.count === 0) {
        return buildErrorResponse(
          409,
          "JOB_NOT_FAILED",
          "The pipeline run changed before the retry was applied.",
          requestId
        );
      }

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: "PIPELINE_RETRY",
        entity: "PipelineJob",
        entityId: job.id,
        source: "UI",
        metadata: { shipmentId: shipment.id, wasStalled: isStalled },
        requestId,
      });

      logEvent({
        action: "pipeline.retry_requested",
        message: `POST /api/shipments/${shipment.id}/pipeline-retry job ${job.id} re-queued (was ${job.status}${isStalled ? ", stalled" : ""})`,
        accountId: ctx.accountId,
        userId: ctx.userId,
        resourceType: "shipment",
        resourceId: shipment.id,
        requestId,
        metadata: { jobId: job.id, previousStatus: job.status, wasStalled: isStalled },
      });

      try {
        after(async () => {
          try {
            await PipelineOrchestrator.processEvent({
              shipmentId: shipment.id,
              accountId: ctx.accountId,
              userId: ctx.userId,
              triggerEvent: "DOCUMENT_UPLOADED",
              jobId: job.id,
            });
          } catch (err) {
            console.error("[pipeline retry] PipelineOrchestrator background run error:", err);
          }
        });
      } catch {
        // next/server after() called outside Next.js request context in unit test environment
      }

      const responsePayload = { jobId: job.id, status: "PENDING", requestId };
      if (idempotencyKey) {
        await persistIdempotency(ctx.accountId, idempotencyKey, requestHash ?? "", 200, responsePayload);
      }

      return NextResponse.json(responsePayload);
    });

    logApiRequest({
      method: req.method,
      path: pathname,
      status: response.status,
      durationMs: Date.now() - startedAt,
      accountId: ctx.accountId,
      userId: ctx.userId,
      requestId,
    });
    return response;
  } catch (error) {
    const response = handleApiError(error, requestId);
    logApiRequest({
      method: req.method,
      path: pathname,
      status: response.status,
      durationMs: Date.now() - startedAt,
      requestId,
      error,
    });
    return response;
  }
}
