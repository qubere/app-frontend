import { db } from "@/lib/db";
import { parseDateRange, stringFilter, type ReportRowsResult } from "../queryHelpers";

/** Compliance Exceptions & Overrides report -- sourced from ComplianceFormalOverride; the original decision is never hidden. */
export async function queryExceptionsOverrides(
  accountId: string,
  filters: Record<string, unknown>,
  limit: number
): Promise<ReportRowsResult> {
  const dateRange = parseDateRange(filters);
  const resultRefType = stringFilter(filters, "resultRefType");

  const where = {
    accountId,
    ...(Object.keys(dateRange).length ? { overriddenAt: dateRange } : {}),
    ...(resultRefType ? { resultRefType } : {}),
  };

  const [totalCount, overrides] = await Promise.all([
    db.complianceFormalOverride.count({ where }),
    db.complianceFormalOverride.findMany({
      where,
      orderBy: { overriddenAt: "desc" },
      take: Math.min(limit, 50_000),
    }),
  ]);

  const rows = overrides.map((o) => ({
    date: o.overriddenAt.toISOString(),
    resultRefType: o.resultRefType,
    originalDecision: o.originalDecision,
    overrideDecision: o.overrideDecision,
    reason: o.reason,
    overriddenBy: o.overriddenByUserId,
    revoked: Boolean(o.revokedAt),
    correlationId: o.executionId ?? o.resultRefId,
  }));

  return { rows, totalCount };
}
