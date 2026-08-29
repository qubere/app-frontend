import { db } from "@/lib/db";
import { parseDateRange, stringFilter, type ReportRowsResult } from "../queryHelpers";

/** Reference Data Changes report -- sourced from ReferenceDataChangeSet, one row per ingested watchlist change. */
export async function queryReferenceDataChanges(
  accountId: string,
  filters: Record<string, unknown>,
  limit: number
): Promise<ReportRowsResult> {
  const dateRange = parseDateRange(filters);
  const changeType = stringFilter(filters, "changeType");
  const sourceList = stringFilter(filters, "sourceList");

  // ReferenceDataChangeSet is platform reference data, not tenant-scoped -- accountId is accepted
  // for signature consistency with every other report query but intentionally unused here.
  void accountId;

  const where = {
    ...(Object.keys(dateRange).length ? { occurredAt: dateRange } : {}),
    ...(changeType ? { changeType: changeType as never } : {}),
    ...(sourceList ? { sourceList } : {}),
  };

  const [totalCount, changes] = await Promise.all([
    db.referenceDataChangeSet.count({ where }),
    db.referenceDataChangeSet.findMany({
      where,
      include: { screeningEntity: true },
      orderBy: { occurredAt: "desc" },
      take: Math.min(limit, 50_000),
    }),
  ]);

  const rows = changes.map((c) => ({
    occurredAt: c.occurredAt.toISOString(),
    sourceList: c.sourceList,
    entityName: c.screeningEntity?.name ?? "",
    changeType: c.changeType,
    datasetId: c.datasetId,
    ingestionRunId: c.ingestionRunId,
    consumedAt: c.consumedAt ? c.consumedAt.toISOString() : "",
  }));

  return { rows, totalCount };
}
