import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface Isf10Plus2Elements {
  // 10 Importer Elements
  sellerNameAddress: string;
  buyerNameAddress: string;
  importerOfRecordNumber: string;
  consigneeNumber: string;
  manufacturerNameAddress: string;
  shipToPartyNameAddress: string;
  countryOfOrigin: string;
  commodityHtsNumber: string;
  containerStuffingLocation?: string;
  consolidatorNameAddress?: string;

  // 2 Carrier Elements
  vesselStowPlan?: string;
  containerStatusMessages?: string;
}

export interface IsfFilingDeadline {
  ladingDate: string; // Foreign port departure / lading timestamp
  isfFilingDeadline: string; // Must be filed >= 24 hours prior to lading
  isLate: boolean;
  hoursUntilDeadline: number;
  potentialLiquidatedDamagesPenalty: number; // $5,000 per late/inaccurate filing, max $10,000
}

const REQUIRED_ISF_ELEMENTS: Array<keyof Isf10Plus2Elements> = [
  "sellerNameAddress",
  "buyerNameAddress",
  "importerOfRecordNumber",
  "consigneeNumber",
  "manufacturerNameAddress",
  "shipToPartyNameAddress",
  "countryOfOrigin",
  "commodityHtsNumber",
];

/**
 * Calculates ISF 10+2 filing deadline and potential liquidated damages risk.
 * The ISF must be filed no later than 24 hours before the cargo is laden
 * aboard the vessel at the foreign port.
 */
export function calculateIsfFilingDeadline(ladingDateStr: string, filedAtStr?: string): IsfFilingDeadline {
  const ladingDate = new Date(ladingDateStr);
  const deadline = new Date(ladingDate.getTime() - 24 * 3600 * 1000);
  const now = filedAtStr ? new Date(filedAtStr) : new Date();

  const isLate = now > deadline;
  const hoursUntil = (deadline.getTime() - now.getTime()) / 3600000;
  const penalty = isLate ? 5000 : 0;

  return {
    ladingDate: ladingDate.toISOString(),
    isfFilingDeadline: deadline.toISOString(),
    isLate,
    hoursUntilDeadline: Math.round(hoursUntil * 10) / 10,
    potentialLiquidatedDamagesPenalty: penalty,
  };
}

/**
 * Validates ISF 10+2 element completeness and bond coverage.
 */
export function validateIsfTransaction(
  elements: Partial<Isf10Plus2Elements>,
  hasActiveBond: boolean
): { valid: boolean; missingElements: string[]; bondRequired: boolean; errors: string[] } {
  const missing = REQUIRED_ISF_ELEMENTS.filter(
    (field) => !elements[field] || String(elements[field]).trim() === ""
  );
  const errors: string[] = [];

  if (missing.length > 0) {
    errors.push(`Missing mandatory ISF 10+2 elements: ${missing.join(", ")}.`);
  }

  if (!hasActiveBond) {
    errors.push("No active Continuous Bond (Activity Code 1) or ISF Standalone Bond (Activity Code 16) on file.");
  }

  return {
    valid: errors.length === 0,
    missingElements: missing as string[],
    bondRequired: !hasActiveBond,
    errors,
  };
}

/**
 * True when the account has a bond that can cover an ISF filing: a continuous
 * bond (activity code 1) or a standalone ISF bond (activity code 16) that is
 * active and not expired.
 */
export async function accountHasIsfBond(accountId: string): Promise<boolean> {
  const bond = await db.bond.findFirst({
    where: {
      accountId,
      // A bond only covers a filing once it has been confirmed sufficient.
      status: { in: ["verified", "attested"] },
      // Not expired.
      OR: [{ expirationDate: null }, { expirationDate: { gt: new Date() } }],
      // Continuous bond (covers ISF) or a standalone ISF bond (activity code 16).
      AND: [
        {
          OR: [{ bondType: "continuous" }, { activityCode: { in: ["1", "01", "16"] } }],
        },
      ],
    },
    select: { id: true },
  });
  return Boolean(bond);
}

export interface UpsertIsfInput {
  accountId: string;
  id?: string;
  shipmentId?: string | null;
  billOfLadingNumber?: string | null;
  ladingDate?: string | null;
  elements: Partial<Isf10Plus2Elements>;
  createdByUserId?: string | null;
}

/**
 * Creates or updates an ISF draft for a shipment, (re)computing the filing
 * deadline, the missing-element list, and the liquidated-damages exposure
 * from the current bond status and lading date.
 */
export async function upsertImporterSecurityFiling(input: UpsertIsfInput) {
  const hasBond = await accountHasIsfBond(input.accountId);
  const validation = validateIsfTransaction(input.elements, hasBond);

  let filingDeadline: Date | null = null;
  let isLate = false;
  let penaltyExposure = 0;
  if (input.ladingDate) {
    const deadline = calculateIsfFilingDeadline(input.ladingDate);
    filingDeadline = new Date(deadline.isfFilingDeadline);
    isLate = deadline.isLate;
    // $5k for a late filing plus $5k if it is also inaccurate (missing
    // elements), capped by CBP guidance at $10k per transaction.
    penaltyExposure = Math.min(
      10000,
      (isLate ? 5000 : 0) + (validation.missingElements.length > 0 ? 5000 : 0)
    );
  } else if (validation.missingElements.length > 0) {
    penaltyExposure = 5000;
  }

  const data = {
    shipmentId: input.shipmentId ?? null,
    billOfLadingNumber: input.billOfLadingNumber ?? null,
    ladingDate: input.ladingDate ? new Date(input.ladingDate) : null,
    filingDeadline,
    elements: input.elements as Prisma.InputJsonValue,
    missingElements: validation.missingElements,
    bondOnFile: hasBond,
    isLate,
    penaltyExposureUsd: new Prisma.Decimal(penaltyExposure),
  };

  if (input.id) {
    return db.importerSecurityFiling.update({
      where: { id: input.id },
      data,
    });
  }

  return db.importerSecurityFiling.create({
    data: {
      accountId: input.accountId,
      createdByUserId: input.createdByUserId ?? null,
      status: "DRAFT",
      ...data,
    },
  });
}

/**
 * Marks an ISF filing submitted. Records LATE if the 24-hour deadline has
 * already passed at submission time.
 */
export async function submitImporterSecurityFiling(accountId: string, id: string) {
  const existing = await db.importerSecurityFiling.findFirst({
    where: { id, accountId },
  });
  if (!existing) return null;

  const now = new Date();
  const late = existing.filingDeadline ? now > existing.filingDeadline : false;

  return db.importerSecurityFiling.update({
    where: { id },
    data: {
      status: late ? "LATE" : "SUBMITTED",
      submittedAt: now,
      isLate: late,
    },
  });
}

export async function listImporterSecurityFilings(
  accountId: string,
  opts: { shipmentId?: string; status?: string } = {}
) {
  return db.importerSecurityFiling.findMany({
    where: {
      accountId,
      ...(opts.shipmentId ? { shipmentId: opts.shipmentId } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getImporterSecurityFiling(accountId: string, id: string) {
  return db.importerSecurityFiling.findFirst({ where: { id, accountId } });
}
