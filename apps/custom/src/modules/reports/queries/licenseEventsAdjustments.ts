import { db } from "@/lib/db";
import { parseDateRange, stringFilter, type ReportRowsResult } from "../queryHelpers";

/** License Events & Adjustments report -- merges the immutable LicenseEvent ledger and LicenseAdjustment corrections. */
export async function queryLicenseEventsAdjustments(
  accountId: string,
  filters: Record<string, unknown>,
  limit: number
): Promise<ReportRowsResult> {
  const dateRange = parseDateRange(filters);
  const licenseLineId = stringFilter(filters, "licenseLineId");
  const take = Math.min(limit, 50_000);

  const eventWhere = {
    accountId,
    ...(Object.keys(dateRange).length ? { eventAt: dateRange } : {}),
    ...(licenseLineId ? { licenseLineId } : {}),
  };
  const adjustmentWhere = {
    accountId,
    ...(Object.keys(dateRange).length ? { createdAt: dateRange } : {}),
    ...(licenseLineId ? { licenseLineId } : {}),
  };

  const [eventTotal, adjustmentTotal, events, adjustments] = await Promise.all([
    db.licenseEvent.count({ where: eventWhere }),
    db.licenseAdjustment.count({ where: adjustmentWhere }),
    db.licenseEvent.findMany({
      where: eventWhere,
      include: { licenseLine: { select: { lineNumber: true, licenseId: true } } },
      orderBy: { eventAt: "desc" },
      take,
    }),
    db.licenseAdjustment.findMany({
      where: adjustmentWhere,
      include: { licenseLine: { select: { lineNumber: true, licenseId: true } } },
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);

  const eventRows = events.map((e) => ({
    date: e.eventAt.toISOString(),
    recordType: "EVENT",
    licenseLineNumber: e.licenseLine.lineNumber,
    type: e.eventType,
    quantityDelta: e.quantityDelta.toString(),
    valueDelta: e.valueDelta.toString(),
    reason: e.reason ?? "",
    postedByUserId: e.postedByUserId ?? "",
    correlationId: e.id,
  }));
  const adjustmentRows = adjustments.map((a) => ({
    date: a.createdAt.toISOString(),
    recordType: "ADJUSTMENT",
    licenseLineNumber: a.licenseLine.lineNumber,
    type: a.adjustmentType,
    quantityDelta: a.quantityDelta.toString(),
    valueDelta: a.valueDelta.toString(),
    reason: a.reason,
    postedByUserId: a.postedByUserId ?? "",
    correlationId: a.id,
  }));

  const rows = [...eventRows, ...adjustmentRows]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, take);

  return { rows, totalCount: eventTotal + adjustmentTotal };
}
