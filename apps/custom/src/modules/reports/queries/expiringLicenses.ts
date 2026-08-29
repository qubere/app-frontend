import { db } from "@/lib/db";
import { parseDateRange, stringFilter, type ReportRowsResult } from "../queryHelpers";

/** Expiring Licenses report -- ACTIVE/SUSPENDED licenses with an expirationDate, optionally bounded by dateFrom/dateTo. */
export async function queryExpiringLicenses(
  accountId: string,
  filters: Record<string, unknown>,
  limit: number
): Promise<ReportRowsResult> {
  const dateRange = parseDateRange(filters);
  const status = stringFilter(filters, "status");

  const where = {
    accountId,
    expirationDate: { not: null, ...dateRange },
    status: (status ?? { in: ["ACTIVE", "SUSPENDED"] }) as never,
  };

  const [totalCount, licenses] = await Promise.all([
    db.license.count({ where }),
    db.license.findMany({
      where,
      orderBy: { expirationDate: "asc" },
      take: Math.min(limit, 50_000),
    }),
  ]);

  const now = Date.now();
  const rows = licenses.map((l) => ({
    licenseNumber: l.licenseNumber,
    licenseType: l.licenseType,
    status: l.status,
    expirationDate: l.expirationDate?.toISOString() ?? "",
    daysUntilExpiration: l.expirationDate ? Math.ceil((l.expirationDate.getTime() - now) / 86_400_000) : "",
    correlationId: l.id,
  }));

  return { rows, totalCount };
}
