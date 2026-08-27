/**
 * GET  /api/compliance/rdps/runs
 * POST /api/compliance/rdps/runs
 *
 * Lists RDPS runs (platform-level aggregate metadata -- RdpsRun has no
 * accountId, since a single DELTA_IMPACT/FULL_POPULATION run can span
 * Parties across many accounts) and triggers a manual/targeted scan.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { createAuditLog, AuditAction } from "@/lib/audit";
import {
  listRuns,
  triggerManualScan,
  RdpsFullPopulationAlreadyRunningError,
} from "@/modules/compliance/rdps/rdpsQueryService";
import { db } from "@/lib/db";
import { recordRdpsOutcome } from "@/modules/compliance/rdps/outcomeRecorder";

export const GET = withAuthenticatedRoute(
  async ({ req, requestId }) => {
    const url = new URL(req.url);
    const runType = url.searchParams.get("runType");
    const status = url.searchParams.get("status");
    const page = url.searchParams.get("page");
    const pageSize = url.searchParams.get("pageSize");

    const result = await listRuns({
      runType: (runType as any) ?? undefined,
      status: (status as any) ?? undefined,
      page: page ? Number.parseInt(page, 10) : undefined,
      pageSize: pageSize ? Number.parseInt(pageSize, 10) : undefined,
    });

    return NextResponse.json({ ...result, requestId });
  },
  { permission: "compliance.rdps.read" }
);

const bodySchema = z.object({
  jobType: z.enum(["DELTA_IMPACT", "FULL_POPULATION", "TARGETED"]),
  partyIds: z.array(z.string().min(1)).optional(),
});

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body", requestId }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues, requestId }, { status: 400 });
    }
    const data = parsed.data;

    try {
      if (data.jobType === "TARGETED") {
        if (!data.partyIds || data.partyIds.length === 0) {
          return NextResponse.json({ error: "partyIds is required for a TARGETED scan", requestId }, { status: 400 });
        }
        const parties = await db.party.findMany({
          where: { id: { in: data.partyIds }, accountId: ctx.accountId },
          select: { id: true },
        });
        if (parties.length === 0) {
          return NextResponse.json({ error: "No matching parties found in this account", requestId }, { status: 404 });
        }

        const run = await db.rdpsRun.create({
          data: { runType: "TARGETED", status: "RUNNING", triggeredBy: `MANUAL:${ctx.userId}` },
        });

        let worsenedCount = 0;
        let erroredCount = 0;
        for (const party of parties) {
          const outcome = await recordRdpsOutcome({
            runId: run.id,
            accountId: ctx.accountId,
            partyId: party.id,
            candidateReasons: [],
          });
          if (outcome.isWorsening) worsenedCount++;
          if (outcome.errored) erroredCount++;
        }

        const completedRun = await db.rdpsRun.update({
          where: { id: run.id },
          data: {
            status: erroredCount > 0 ? "PARTIAL" : "COMPLETED",
            candidatePartyCount: parties.length,
            screenedCount: parties.length,
            worsenedCount,
            erroredCount,
            completedAt: new Date(),
          },
        });

        await createAuditLog({
          accountId: ctx.accountId,
          userId: ctx.userId,
          action: AuditAction.RDPS_MANUAL_SCAN_TRIGGERED,
          entity: "RdpsRun",
          entityId: run.id,
          source: "UI",
          metadata: { jobType: data.jobType, partyIds: data.partyIds },
          requestId,
        });

        return NextResponse.json({ run: completedRun, requestId }, { status: 201 });
      }

      const run = await triggerManualScan(ctx.userId, { jobType: data.jobType });

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: AuditAction.RDPS_MANUAL_SCAN_TRIGGERED,
        entity: "RdpsRun",
        entityId: run?.id ?? "none",
        source: "UI",
        metadata: { jobType: data.jobType },
        requestId,
      });

      return NextResponse.json({ run, requestId }, { status: 201 });
    } catch (err) {
      if (err instanceof RdpsFullPopulationAlreadyRunningError) {
        return buildErrorResponse(409, "CONFLICT", err.message, undefined, requestId);
      }
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(err), undefined, requestId);
    }
  },
  { permission: "compliance.rdps.manage", write: true }
);
