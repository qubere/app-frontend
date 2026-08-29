import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { getCatalogEntry } from "@/modules/reports/catalog";
import { inngest } from "@/lib/inngest/client";
import { REPORT_RUN_REQUESTED_EVENT } from "@/lib/inngest/functions/reportRun";
import { createAuditLog } from "@/lib/audit";

/**
 * Queues a report for generation. The run row is created synchronously
 * (QUEUED) so it is inspectable immediately, then handed off to a durable
 * Inngest job -- generation never blocks the request/response cycle and
 * survives a serverless function being frozen mid-flight.
 */
export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json().catch(() => null);
  const reportType = typeof body?.reportType === "string" ? body.reportType : undefined;
  const format = typeof body?.format === "string" ? body.format : "CSV";
  const filters = (body?.filters ?? {}) as Record<string, unknown>;
  const reportDefinitionId = typeof body?.reportDefinitionId === "string" ? body.reportDefinitionId : undefined;

  if (!reportType) {
    return NextResponse.json({ error: "reportType is required.", code: "INVALID_REQUEST" }, { status: 400 });
  }

  const catalogEntry = getCatalogEntry(reportType);
  if (!catalogEntry) {
    return NextResponse.json({ error: "Unknown report type.", code: "INVALID_REQUEST" }, { status: 400 });
  }
  if (!catalogEntry.formats.includes(format as never)) {
    return NextResponse.json(
      { error: `Format "${format}" is not available for this report.`, code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const run = await db.reportRun.create({
    data: {
      accountId: ctx.accountId,
      reportDefinitionId,
      reportType,
      format,
      requestedByUserId: ctx.userId,
      filterSnapshot: filters as Prisma.InputJsonValue,
    },
  });

  await inngest.send({ name: REPORT_RUN_REQUESTED_EVENT, data: { runId: run.id } });

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "COMPLIANCE_REPORT_REQUESTED",
    entity: "ReportRun",
    entityId: run.id,
    source: "UI",
    metadata: { reportType, format, generationStatus: run.generationStatus },
  });

  return NextResponse.json({ run }, { status: 202 });
}, { permission: "compliance.reports.generate", write: true });
