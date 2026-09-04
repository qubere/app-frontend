import { db } from "@/lib/db";
import { Decimal } from "@/lib/tariff/decimal";
import { stringFilter, type ReportRowsResult } from "../queryHelpers";

/** License Utilization report -- per-line ledger totals and remaining capacity (licensed - committed - shipped + adjusted). */
export async function queryLicenseUtilization(
  accountId: string,
  filters: Record<string, unknown>,
  limit: number
): Promise<ReportRowsResult> {
  const licenseId = stringFilter(filters, "licenseId");
  const classificationType = stringFilter(filters, "classificationType");

  const where = {
    accountId,
    ...(licenseId ? { licenseId } : {}),
    ...(classificationType ? { classificationType } : {}),
  };

  const [totalCount, lines] = await Promise.all([
    db.licenseLine.count({ where }),
    db.licenseLine.findMany({
      where,
      include: { license: { select: { licenseNumber: true } } },
      orderBy: [{ licenseId: "asc" }, { lineNumber: "asc" }],
      take: Math.min(limit, 50_000),
    }),
  ]);

  const rows = lines.map((line) => {
    const remainingQuantity = line.licensedQuantity
      ? new Decimal(line.licensedQuantity)
          .minus(new Decimal(line.committedQuantity))
          .minus(new Decimal(line.shippedQuantity))
          .plus(new Decimal(line.adjustedQuantity))
          .toFixed(4)
      : "";
    const remainingValue = line.licensedValue
      ? new Decimal(line.licensedValue)
          .minus(new Decimal(line.committedValue))
          .minus(new Decimal(line.shippedValue))
          .plus(new Decimal(line.adjustedValue))
          .toFixed(2)
      : "";

    return {
      licenseNumber: line.license.licenseNumber,
      lineNumber: line.lineNumber,
      classificationType: line.classificationType ?? "",
      classificationNumber: line.classificationNumber ?? "",
      licensedQuantity: line.licensedQuantity?.toString() ?? "",
      committedQuantity: line.committedQuantity.toString(),
      shippedQuantity: line.shippedQuantity.toString(),
      adjustedQuantity: line.adjustedQuantity.toString(),
      remainingQuantity,
      licensedValue: line.licensedValue?.toString() ?? "",
      committedValue: line.committedValue.toString(),
      shippedValue: line.shippedValue.toString(),
      adjustedValue: line.adjustedValue.toString(),
      remainingValue,
      correlationId: line.id,
    };
  });

  return { rows, totalCount };
}
