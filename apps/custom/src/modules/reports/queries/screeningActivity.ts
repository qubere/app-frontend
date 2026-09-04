import { db } from "@/lib/db";
import { parseDateRange, stringFilter, type ReportRowsResult } from "../queryHelpers";

/** Screening Activity report -- sourced from ScreeningLog, the authoritative screening attempt history. */
export async function queryScreeningActivity(
  accountId: string,
  filters: Record<string, unknown>,
  limit: number
): Promise<ReportRowsResult> {
  const dateRange = parseDateRange(filters);
  const matchStatus = stringFilter(filters, "matchStatus");
  const targetType = stringFilter(filters, "targetType");

  const where = {
    accountId,
    ...(Object.keys(dateRange).length ? { screenedAt: dateRange } : {}),
    ...(matchStatus ? { matchStatus } : {}),
    ...(targetType ? { targetType } : {}),
  };

  const [totalCount, logs] = await Promise.all([
    db.screeningLog.count({ where }),
    db.screeningLog.findMany({
      where,
      orderBy: { screenedAt: "desc" },
      take: Math.min(limit, 50_000),
    }),
  ]);

  const rows = logs.map((l) => ({
    screenedAt: l.screenedAt.toISOString(),
    party: l.targetName,
    screeningType: l.targetType,
    result: l.matchStatus,
    topMatch: l.matchedParty ?? "",
    score: l.matchScore,
    listSource: l.listSource ?? "",
  }));

  return { rows, totalCount };
}
