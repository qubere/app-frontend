import { db } from "@/lib/db";
import { parseDateRange, stringFilter, type ReportRowsResult } from "../queryHelpers";

/** Compliance Audit report -- sourced from ComplianceExecution + linked overrides, never recomputed. */
export async function queryComplianceAudit(
  accountId: string,
  filters: Record<string, unknown>,
  limit: number
): Promise<ReportRowsResult> {
  const dateRange = parseDateRange(filters);
  const shipmentId = stringFilter(filters, "shipmentId");
  const executionType = stringFilter(filters, "executionType");
  const status = stringFilter(filters, "status");

  const where = {
    accountId,
    ...(Object.keys(dateRange).length ? { startedAt: dateRange } : {}),
    ...(shipmentId ? { shipmentId } : {}),
    ...(executionType ? { executionType: executionType as never } : {}),
    ...(status ? { status: status as never } : {}),
  };

  const [totalCount, executions] = await Promise.all([
    db.complianceExecution.count({ where }),
    db.complianceExecution.findMany({
      where,
      include: {
        shipment: { select: { shipmentNumber: true } },
        initiatedByUser: { select: { email: true, firstName: true, lastName: true } },
        overrides: { select: { overrideDecision: true, reason: true, overriddenByUserId: true } },
      },
      orderBy: { startedAt: "desc" },
      take: Math.min(limit, 50_000),
    }),
  ]);

  const rows = executions.map((e) => {
    const override = e.overrides[0];
    const reviewer = e.initiatedByUser
      ? [e.initiatedByUser.firstName, e.initiatedByUser.lastName].filter(Boolean).join(" ") ||
        e.initiatedByUser.email
      : "";
    return {
      executionId: e.id,
      dateTime: e.startedAt.toISOString(),
      shipment: e.shipment?.shipmentNumber ?? "",
      complianceService: e.executionType,
      automatedResult: e.status,
      finalOutcome: override ? override.overrideDecision : (e.finalStatus ?? e.status),
      override: Boolean(override),
      reviewer,
      reason: override?.reason ?? "",
      correlationId: e.correlationId,
    };
  });

  return { rows, totalCount };
}
