import { db } from "@/lib/db";
import { parseDateRange, stringFilter, type ReportRowsResult } from "../queryHelpers";

function displayPartyName(party: { names: { rawName: string; isPrimary: boolean }[] } | null | undefined, fallback: string): string {
  if (!party) return fallback;
  const primary = party.names.find((n) => n.isPrimary) ?? party.names[0];
  return primary?.rawName ?? fallback;
}

/** Continuous Party Monitoring report -- sourced from RdpsPartyOutcome, one row per re-screened party per RDPS run. */
export async function queryContinuousPartyMonitoring(
  accountId: string,
  filters: Record<string, unknown>,
  limit: number
): Promise<ReportRowsResult> {
  const dateRange = parseDateRange(filters);
  const transitionType = stringFilter(filters, "transitionType");

  const where = {
    accountId,
    ...(Object.keys(dateRange).length ? { createdAt: dateRange } : {}),
    ...(transitionType ? { transitionType } : {}),
  };

  const [totalCount, outcomes] = await Promise.all([
    db.rdpsPartyOutcome.count({ where }),
    db.rdpsPartyOutcome.findMany({
      where,
      include: { party: { include: { names: true } } },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 50_000),
    }),
  ]);

  const rows = outcomes.map((o) => ({
    party: displayPartyName(o.party, o.partyId),
    previousStatus: o.previousStatus ?? "",
    newStatus: o.newStatus,
    transitionType: o.transitionType ?? "",
    isWorsening: o.isWorsening,
    runId: o.runId,
    createdAt: o.createdAt.toISOString(),
  }));

  return { rows, totalCount };
}
