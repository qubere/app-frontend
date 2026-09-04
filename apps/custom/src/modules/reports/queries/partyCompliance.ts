import { db } from "@/lib/db";
import { stringFilter, type ReportRowsResult } from "../queryHelpers";

function displayPartyName(party: { names: { rawName: string; isPrimary: boolean }[] } | null | undefined, fallback: string): string {
  if (!party) return fallback;
  const primary = party.names.find((n) => n.isPrimary) ?? party.names[0];
  return primary?.rawName ?? fallback;
}

/** Party Compliance report -- sourced from PartyScreeningSummary, the authoritative current RPS state per party. */
export async function queryPartyCompliance(
  accountId: string,
  filters: Record<string, unknown>,
  limit: number
): Promise<ReportRowsResult> {
  const partyId = stringFilter(filters, "partyId");
  const status = stringFilter(filters, "status");

  const where = {
    accountId,
    ...(partyId ? { partyId } : {}),
    ...(status ? { screeningStatus: status as never } : {}),
  };

  const [totalCount, summaries] = await Promise.all([
    db.partyScreeningSummary.count({ where }),
    db.partyScreeningSummary.findMany({
      where,
      include: { party: { include: { names: true } } },
      orderBy: { updatedAt: "desc" },
      take: Math.min(limit, 50_000),
    }),
  ]);

  const rows = summaries.map((s) => ({
    party: displayPartyName(s.party, s.partyId),
    currentRpsStatus: s.screeningStatus,
    lastActualRpsScreen: s.lastScreenedAt?.toISOString() ?? "",
  }));

  return { rows, totalCount };
}
