import { db } from "@/lib/db";
import { stringFilter, type ReportRowsResult } from "../queryHelpers";

/** License Inventory report -- managed License headers with line counts. */
export async function queryLicenseInventory(
  accountId: string,
  filters: Record<string, unknown>,
  limit: number
): Promise<ReportRowsResult> {
  const status = stringFilter(filters, "status");
  const licenseType = stringFilter(filters, "licenseType");

  const where = {
    accountId,
    ...(status ? { status: status as never } : {}),
    ...(licenseType ? { licenseType } : {}),
  };

  const [totalCount, licenses] = await Promise.all([
    db.license.count({ where }),
    db.license.findMany({
      where,
      include: { _count: { select: { lines: true } } },
      orderBy: { effectiveDate: "desc" },
      take: Math.min(limit, 50_000),
    }),
  ]);

  const rows = licenses.map((l) => ({
    licenseNumber: l.licenseNumber,
    licenseType: l.licenseType,
    agency: l.agency ?? "",
    jurisdiction: l.jurisdiction ?? "",
    status: l.status,
    effectiveDate: l.effectiveDate.toISOString(),
    expirationDate: l.expirationDate?.toISOString() ?? "",
    lineCount: l._count.lines,
    correlationId: l.id,
  }));

  return { rows, totalCount };
}
