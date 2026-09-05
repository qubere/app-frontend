// Bulk importer onboarding — CSV / JSON upload, dry-run validation, batch commit.
// A committed batch creates one OnboardingCase per row in `draft` status.
// Batch identity is tracked via OnboardingCase.source = "BULK_IMPORT:{batchId}"
// and a companion OnboardingEvent so getBatchProgress can recover the full set.

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { resolveNewLegalEntityParty } from "@/modules/importers/importerCreate.service";

export interface BulkImportRow {
  legalName: string;
  importerNumberType: "EIN" | "SSN" | "CBP_ASSIGNED";
  importerNumber?: string;
  entityType?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  contactEmail?: string;
}

export interface RowValidation {
  rowIndex: number;
  row: BulkImportRow;
  errors: string[];
  warnings: string[];
  status: "valid" | "invalid" | "duplicate";
  existingIorId?: string;
}

export interface DryRunResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  validations: RowValidation[];
}

const EIN_RE = /^\d{2}-\d{7}$/;

function validateEin(ein: string): boolean {
  if (!EIN_RE.test(ein)) return false;
  const prefix = parseInt(ein.split("-")[0], 10);
  return prefix >= 1 && prefix !== 7 && prefix !== 8 && prefix !== 9;
}

export async function validateBulkRows(
  accountId: string,
  rows: BulkImportRow[]
): Promise<DryRunResult> {
  const existingIors = await db.importerOfRecord.findMany({
    where: { accountId },
    select: { id: true, cbpImporterNumber: true, name: true },
  });
  const byNumber = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const ior of existingIors) {
    if (ior.cbpImporterNumber) byNumber.set(ior.cbpImporterNumber.toLowerCase(), ior.id);
    byName.set(ior.name.trim().toLowerCase(), ior.id);
  }

  const validations: RowValidation[] = rows.map((row, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let status: RowValidation["status"] = "valid";
    let existingIorId: string | undefined;

    if (!row.legalName?.trim()) errors.push("legalName is required");

    if (!["EIN", "SSN", "CBP_ASSIGNED"].includes(row.importerNumberType)) {
      errors.push("importerNumberType must be EIN, SSN, or CBP_ASSIGNED");
    }

    if (row.importerNumberType === "EIN" && row.importerNumber) {
      if (!validateEin(row.importerNumber)) {
        errors.push(`Invalid EIN format: "${row.importerNumber}" — expected XX-XXXXXXX`);
      }
    }

    if (row.importerNumberType !== "CBP_ASSIGNED" && !row.importerNumber) {
      errors.push("importerNumber is required for EIN and SSN importers");
    }

    if (row.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.contactEmail)) {
      errors.push("contactEmail is not a valid email address");
    }

    if (row.importerNumber) {
      const dup = byNumber.get(row.importerNumber.toLowerCase());
      if (dup) { status = "duplicate"; existingIorId = dup; warnings.push(`Importer number "${row.importerNumber}" already exists`); }
    }
    if (status !== "duplicate" && row.legalName) {
      const dup = byName.get(row.legalName.trim().toLowerCase());
      if (dup) warnings.push(`A record named "${row.legalName}" already exists — review for possible duplicate`);
    }

    if (errors.length > 0) status = "invalid";
    return { rowIndex: i, row, errors, warnings, status, existingIorId };
  });

  return {
    totalRows: rows.length,
    validRows: validations.filter((v) => v.status === "valid").length,
    invalidRows: validations.filter((v) => v.status === "invalid").length,
    duplicateRows: validations.filter((v) => v.status === "duplicate").length,
    validations,
  };
}

export async function parseCsvRows(csvText: string): Promise<BulkImportRow[]> {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] ?? ""; });
    const nt = (obj.importer_number_type ?? obj.importernumbertype ?? "EIN").toUpperCase();
    return {
      legalName: obj.legal_name ?? obj.legalname ?? "",
      importerNumberType: (["EIN", "SSN", "CBP_ASSIGNED"].includes(nt) ? nt : "EIN") as BulkImportRow["importerNumberType"],
      importerNumber: obj.importer_number || obj.importernumber || undefined,
      entityType: obj.entity_type || obj.entitytype || undefined,
      addressLine1: obj.address_line1 || obj.addressline1 || undefined,
      city: obj.city || undefined,
      state: obj.state || undefined,
      postalCode: obj.postal_code || obj.postalcode || obj.zip || undefined,
      country: obj.country || "US",
      contactEmail: obj.contact_email || obj.contactemail || undefined,
    };
  });
}

export interface CommitResult {
  batchId: string;
  casesCreated: number;
  rowsSkipped: number;
  caseIds: string[];
}

export async function commitBulkImport(
  accountId: string,
  userId: string | null,
  rows: BulkImportRow[],
  skipInvalid = true
): Promise<CommitResult> {
  const batchId = randomUUID();
  const batchSource = `BULK_IMPORT:${batchId}`;
  const dryRun = await validateBulkRows(accountId, rows);
  const caseIds: string[] = [];
  let rowsSkipped = 0;

  for (const validation of dryRun.validations) {
    if (validation.status === "invalid" && skipInvalid) { rowsSkipped++; continue; }
    const row = validation.row;

    const onboardingCase = await db.onboardingCase.create({
      data: {
        accountId,
        path: "BULK",
        status: "draft",
        currentStep: 1,
        stepStatus: {},
        blockers: [],
        source: batchSource,
        assignedUserId: userId,
      },
    });

    if (row.legalName && validation.status !== "invalid") {
      // Same Party-graph bridge importerCreate.service.ts's UI onboarding flow
      // uses: resolve (or create) the Party this legal entity matches -- fail-open,
      // never blocks this row's commit -- then bridge the new LegalEntity to it.
      const { partyId } = await resolveNewLegalEntityParty(
        { accountId, userId },
        {
          legalName: row.legalName,
          entityType: row.entityType || "US_CORPORATION",
          country: row.country ?? "US",
          importerNumberType: row.importerNumberType,
          importerNumber: row.importerNumber ?? null,
          addressLine1: row.addressLine1 ?? "",
          city: row.city ?? "",
          stateProvince: row.state ?? null,
          postalCode: row.postalCode ?? "",
        }
      );

      const legalEntity = await db.legalEntity.create({
        data: {
          accountId,
          legalName: row.legalName,
          entityType: row.entityType || "US_CORPORATION",
          country: row.country ?? "US",
          addressLine1: row.addressLine1 ?? null,
          city: row.city ?? null,
          stateProvince: row.state ?? null,
          postalCode: row.postalCode ?? null,
          taxIdentifier: row.importerNumber ?? null,
          taxIdentifierType: row.importerNumberType,
          partyId,
        },
      });

      const ior = await db.importerOfRecord.create({
        data: {
          accountId,
          name: row.legalName,
          irsEin: row.importerNumber ?? "",
          cbpImporterNumber: row.importerNumber ?? null,
          registrationStatus: "unregistered",
          address: {
            line1: row.addressLine1 ?? "",
            city: row.city ?? "",
            state: row.state ?? "",
            postalCode: row.postalCode ?? "",
            country: row.country ?? "US",
          },
          legalEntityId: legalEntity.id,
        },
      });

      await db.onboardingEntity.create({
        data: {
          accountId,
          caseId: onboardingCase.id,
          importerOfRecordId: ior.id,
          importerNumberType: row.importerNumberType,
          importerNumber: row.importerNumber ?? null,
          officers: [],
        },
      });

      await db.onboardingCase.update({
        where: { id: onboardingCase.id },
        data: { primaryImporterId: ior.id },
      });
    }

    await db.onboardingEvent.create({
      data: {
        accountId,
        caseId: onboardingCase.id,
        type: "STEP_COMPLETED",
        step: 0,
        actorUserId: userId,
        actorType: "USER",
        detail: { source: "BULK_IMPORT", batchId },
      },
    });

    caseIds.push(onboardingCase.id);
  }

  await createAuditLog({
    accountId,
    userId,
    action: "ONBOARDING_CASE_CREATED",
    entity: "OnboardingCase",
    entityId: batchId,
    source: "BULK_IMPORT",
    metadata: { casesCreated: caseIds.length, rowsSkipped, batchId },
  });

  return { batchId, casesCreated: caseIds.length, rowsSkipped, caseIds };
}

export async function getBatchProgress(accountId: string, batchId: string) {
  const batchSource = `BULK_IMPORT:${batchId}`;
  const cases = await db.onboardingCase.findMany({
    where: { accountId, source: batchSource },
    include: {
      primaryImporter: { select: { id: true, name: true } },
      entities: { select: { importerNumber: true, screeningStatus: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (cases.length === 0) return null;

  return {
    batchId,
    status: "done",
    totalCases: cases.length,
    cases,
  };
}
