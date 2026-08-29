// License Determination -- repository layer.
// Isolates all reference-data/config access so the matcher/service code
// never issues raw Prisma calls directly (mirrors embargoRepository.ts).
import { db } from "@/lib/db";
import type { ClassificationValue } from "./types";

export interface AccountLicenseConfigValues {
  licenseDeterminationEnabled: boolean;
  importControlDeterminationEnabled: boolean;
  genericExportLicenseDeterminationEnabled: boolean;
  licenseManagementEnabled: boolean;
  licenseExpiryLeadDays: number;
  remainingQuantityThresholdPct: number;
  remainingValueThresholdPct: number;
  committedButUnshippedQuantityThresholdPct: number;
  committedButUnshippedValueThresholdPct: number;
  licenseAlertRecipients: string[];
}

const DEFAULT_ACCOUNT_LICENSE_CONFIG: AccountLicenseConfigValues = {
  licenseDeterminationEnabled: true,
  importControlDeterminationEnabled: false,
  genericExportLicenseDeterminationEnabled: true,
  licenseManagementEnabled: true,
  licenseExpiryLeadDays: 90,
  remainingQuantityThresholdPct: 20,
  remainingValueThresholdPct: 20,
  committedButUnshippedQuantityThresholdPct: 50,
  committedButUnshippedValueThresholdPct: 50,
  licenseAlertRecipients: [],
};

/** Resolves the account's License Determination/Management configuration, defaulting to safe on-values when no row exists. */
export async function getAccountLicenseConfig(accountId: string): Promise<AccountLicenseConfigValues> {
  const row = await db.accountLicenseConfig.findUnique({ where: { accountId } });
  if (!row) return DEFAULT_ACCOUNT_LICENSE_CONFIG;
  const recipients = Array.isArray(row.licenseAlertRecipients)
    ? (row.licenseAlertRecipients as unknown[]).filter((r): r is string => typeof r === "string")
    : [];
  return {
    licenseDeterminationEnabled: row.licenseDeterminationEnabled,
    importControlDeterminationEnabled: row.importControlDeterminationEnabled,
    genericExportLicenseDeterminationEnabled: row.genericExportLicenseDeterminationEnabled,
    licenseManagementEnabled: row.licenseManagementEnabled,
    licenseExpiryLeadDays: row.licenseExpiryLeadDays,
    remainingQuantityThresholdPct: row.remainingQuantityThresholdPct,
    remainingValueThresholdPct: row.remainingValueThresholdPct,
    committedButUnshippedQuantityThresholdPct: row.committedButUnshippedQuantityThresholdPct,
    committedButUnshippedValueThresholdPct: row.committedButUnshippedValueThresholdPct,
    licenseAlertRecipients: recipients,
  };
}

/** Looks up commerce_control_list rows for an ECCN, scoped optionally to a destination country. Reused reference data -- never a parallel master. */
export async function findCommerceControlListEntries(eccn: string, country?: string) {
  return db.commerceControlList.findMany({
    where: {
      cclId: eccn,
      ...(country ? { cclCountry: country } : {}),
    },
  });
}

/** Resolves the current, non-superseded ProductClassification rows for a product, across all jurisdictions/nomenclatures. */
export async function findProductClassifications(accountId: string, productId: string) {
  return db.productClassification.findMany({
    where: {
      accountId,
      productId,
      status: { in: ["CONFIRMED", "APPROVED"] as never },
      effectiveTo: null,
    },
    orderBy: { effectiveFrom: "desc" },
  });
}

/** Maps a Qubere ProductClassification nomenclature onto the License Determination classification taxonomy. Returns null for nomenclatures outside the License scope (e.g. HTSUS import tariff codes are only relevant for import-control determinations). */
export function classificationTypeFromNomenclature(nomenclature: string): ClassificationValue["type"] | null {
  const upper = nomenclature.toUpperCase();
  if (upper === "ECCN" || upper === "CCL") return "ECCN";
  if (upper === "USML") return "USML";
  if (upper === "HTSUS" || upper === "HTS") return "HTS";
  if (upper === "SCHEDULE_B" || upper === "SCHEDULEB") return "SCHEDULE_B";
  if (upper === "ICN") return "ICN";
  return null;
}
