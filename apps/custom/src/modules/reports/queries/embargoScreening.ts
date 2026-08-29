import { db } from "@/lib/db";
import { parseDateRange, stringFilter, type ReportRowsResult } from "../queryHelpers";

/** Embargo Screening report -- sourced from EmbargoUsageLine, the authoritative per-line embargo decision. */
export async function queryEmbargoScreening(
  accountId: string,
  filters: Record<string, unknown>,
  limit: number
): Promise<ReportRowsResult> {
  const dateRange = parseDateRange(filters);
  const result = stringFilter(filters, "result");
  const shipmentId = stringFilter(filters, "shipmentId");

  const where = {
    accountId,
    ...(Object.keys(dateRange).length ? { screenedAt: dateRange } : {}),
    ...(result ? { result } : {}),
    ...(shipmentId ? { shipmentId } : {}),
  };

  const [totalCount, lines] = await Promise.all([
    db.embargoUsageLine.count({ where }),
    db.embargoUsageLine.findMany({
      where,
      orderBy: { screenedAt: "desc" },
      take: Math.min(limit, 50_000),
    }),
  ]);

  const rows = lines.map((l) => ({
    shipment: l.shipmentId,
    complianceCountry: l.complianceCountry,
    screenedCountry: l.screenedCountry,
    eccn: l.eccn ?? "",
    militaryEndUse: l.militaryEndUse ?? false,
    matcher: l.matcher,
    ruleId: l.ruleId ?? "",
    decision: l.result === "P" ? "PASS" : "FAIL",
    screenedAt: l.screenedAt.toISOString(),
  }));

  return { rows, totalCount };
}
