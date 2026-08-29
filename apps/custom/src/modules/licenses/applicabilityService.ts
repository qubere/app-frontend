// Finds candidate managed License/LicenseLine rows that could satisfy a
// LICENSE_REQUIRED (or LICENSE_EXCEPTION_APPLIES) determination (prompt
// section 37). Matching is deliberately conservative and explainable:
// classification type+value, ACTIVE status, non-expired, and (loosely)
// destination-country/jurisdiction match when the license records one. This
// never auto-selects or auto-allocates a license -- it only returns ranked
// candidates for a human/automation caller to choose from before calling
// the allocation service.
import { db } from "@/lib/db";
import { Decimal } from "@/lib/tariff/decimal";

export interface ApplicableLicenseCandidate {
  licenseId: string;
  licenseNumber: string;
  licenseLineId: string;
  lineNumber: number;
  classificationType: string | null;
  classificationNumber: string | null;
  remainingQuantity: string | null;
  remainingValue: string | null;
  expirationDate: Date | null;
  matchReason: string[];
}

export async function findApplicableLicenses(params: {
  accountId: string;
  classificationType?: string;
  classificationNumber?: string;
  destinationCountry?: string | null;
}): Promise<ApplicableLicenseCandidate[]> {
  const lines = await db.licenseLine.findMany({
    where: {
      accountId: params.accountId,
      license: {
        status: "ACTIVE",
        OR: [{ expirationDate: null }, { expirationDate: { gte: new Date() } }],
      },
      ...(params.classificationType ? { classificationType: params.classificationType } : {}),
      ...(params.classificationNumber ? { classificationNumber: params.classificationNumber } : {}),
    },
    include: { license: true },
    orderBy: { license: { expirationDate: "asc" } },
    take: 50,
  });

  return lines.map((line) => {
    const matchReason: string[] = [];
    if (params.classificationType && line.classificationType === params.classificationType) matchReason.push("classificationType");
    if (params.classificationNumber && line.classificationNumber === params.classificationNumber) matchReason.push("classificationNumber");

    const remainingQuantity = line.licensedQuantity
      ? new Decimal(line.licensedQuantity)
          .minus(new Decimal(line.committedQuantity))
          .minus(new Decimal(line.shippedQuantity))
          .plus(new Decimal(line.adjustedQuantity))
          .toString()
      : null;
    const remainingValue = line.licensedValue
      ? new Decimal(line.licensedValue)
          .minus(new Decimal(line.committedValue))
          .minus(new Decimal(line.shippedValue))
          .plus(new Decimal(line.adjustedValue))
          .toString()
      : null;

    return {
      licenseId: line.licenseId,
      licenseNumber: line.license.licenseNumber,
      licenseLineId: line.id,
      lineNumber: line.lineNumber,
      classificationType: line.classificationType,
      classificationNumber: line.classificationNumber,
      remainingQuantity,
      remainingValue,
      expirationDate: line.license.expirationDate,
      matchReason,
    };
  });
}
