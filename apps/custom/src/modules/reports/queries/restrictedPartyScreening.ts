import { db } from "@/lib/db";
import { parseDateRange, stringFilter, type ReportRowsResult } from "../queryHelpers";

function displayPartyName(party: { names: { rawName: string; isPrimary: boolean }[] } | null | undefined, fallback: string): string {
  if (!party) return fallback;
  const primary = party.names.find((n) => n.isPrimary) ?? party.names[0];
  return primary?.rawName ?? fallback;
}

/** Restricted Party Screening report -- sourced from RestrictedPartyScreeningResult, one row per screening pass. */
export async function queryRestrictedPartyScreening(
  accountId: string,
  filters: Record<string, unknown>,
  limit: number
): Promise<ReportRowsResult> {
  const dateRange = parseDateRange(filters);
  const status = stringFilter(filters, "status");
  const partyId = stringFilter(filters, "partyId");

  const where = {
    accountId,
    ...(Object.keys(dateRange).length ? { screeningDate: dateRange } : {}),
    ...(status ? { status: status as never } : {}),
    ...(partyId ? { partyId } : {}),
  };

  const [totalCount, results] = await Promise.all([
    db.restrictedPartyScreeningResult.count({ where }),
    db.restrictedPartyScreeningResult.findMany({
      where,
      include: { party: { include: { names: true } } },
      orderBy: { screeningDate: "desc" },
      take: Math.min(limit, 50_000),
    }),
  ]);

  const rows = results.map((r) => ({
    party: displayPartyName(r.party, r.screenedName),
    screeningDate: r.screeningDate.toISOString(),
    automatedResult: r.status,
    hitCount: r.hitCount,
    redFlagCount: r.redFlagCount,
    matcherVersion: r.matcherVersion ?? "",
    referenceDataAsOf: r.referenceDataAsOf?.toISOString() ?? "",
    correlationId: r.correlationId,
  }));

  return { rows, totalCount };
}
