import { db } from "@/lib/db";
import { parseDateRange, stringFilter, type ReportRowsResult } from "../queryHelpers";

/** License Determination report -- sourced from LicenseDeterminationResult, base and final decisions both shown. */
export async function queryLicenseDetermination(
  accountId: string,
  filters: Record<string, unknown>,
  limit: number
): Promise<ReportRowsResult> {
  const dateRange = parseDateRange(filters);
  const status = stringFilter(filters, "status");
  const operationType = stringFilter(filters, "operationType");
  const shipmentId = stringFilter(filters, "shipmentId");

  const where = {
    accountId,
    ...(Object.keys(dateRange).length ? { automatedAt: dateRange } : {}),
    ...(status ? { status: status as never } : {}),
    ...(operationType ? { operationType: operationType as never } : {}),
    ...(shipmentId ? { shipmentId } : {}),
  };

  const [totalCount, results] = await Promise.all([
    db.licenseDeterminationResult.count({ where }),
    db.licenseDeterminationResult.findMany({
      where,
      orderBy: { automatedAt: "desc" },
      take: Math.min(limit, 50_000),
    }),
  ]);

  const rows = results.map((r) => ({
    date: r.automatedAt.toISOString(),
    operationType: r.operationType,
    shipment: r.shipmentId ?? "",
    destinationCountry: r.destinationCountry ?? "",
    originCountry: r.originCountry ?? "",
    status: r.status,
    baseDecision: r.baseDecision ?? "",
    finalDecision: r.finalDecision ?? "",
    exceptionCode: r.exceptionCode ?? "",
    reason: r.reason ?? "",
    reviewerDisposition: r.reviewerDisposition ?? "",
    reviewedByUserId: r.reviewedByUserId ?? "",
    correlationId: r.id,
  }));

  return { rows, totalCount };
}
