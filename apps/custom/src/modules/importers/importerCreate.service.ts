import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export class ImporterCreateError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "CONFLICT",
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ImporterCreateError";
  }
}

export interface ImporterLegalEntityInput {
  legalName: string;
  tradeName?: string | null;
  entityType: string;
  country: string;
  importerNumberType: "EIN" | "SSN" | "CBP_ASSIGNED";
  importerNumber?: string | null;
  cbpImporterNumber?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  stateProvince?: string | null;
  postalCode: string;
}

interface CreateImporterInput {
  accountId: string;
  userId: string;
  requestId?: string;
  clientId: string;
  path: "STANDARD" | "SWITCHING" | "NON_RESIDENT";
  legalEntityId?: string;
  legalEntity?: ImporterLegalEntityInput;
}

function normalizedIdentifier(value: string | null | undefined, type: ImporterLegalEntityInput["importerNumberType"]) {
  if (!value) return "";
  return type === "CBP_ASSIGNED" ? value.trim().toUpperCase() : value.replace(/\D/g, "");
}

export async function createImporter(input: CreateImporterInput) {
  if (Boolean(input.legalEntityId) === Boolean(input.legalEntity)) {
    throw new ImporterCreateError("CONFLICT", "Choose a new legal entity or one existing legal entity.");
  }

  return db.$transaction(async (tx) => {
    const client = await tx.client.findFirst({
      where: { id: input.clientId, accountId: input.accountId },
      select: { id: true, name: true },
    });
    if (!client) throw new ImporterCreateError("NOT_FOUND", "Client not found.");

    let legalEntity;
    if (input.legalEntityId) {
      legalEntity = await tx.legalEntity.findFirst({
        where: { id: input.legalEntityId, accountId: input.accountId },
        include: { importerOfRecord: { select: { id: true, name: true } } },
      });
      if (!legalEntity) throw new ImporterCreateError("NOT_FOUND", "Legal entity not found.");
      if (legalEntity.importerOfRecord) {
        throw new ImporterCreateError("CONFLICT", "This legal entity is already registered as an importer.", {
          existingImporter: legalEntity.importerOfRecord,
        });
      }
      if (legalEntity.clientId && legalEntity.clientId !== client.id) {
        throw new ImporterCreateError("CONFLICT", "This legal entity belongs to another client.");
      }
      if (!legalEntity.clientId) {
        legalEntity = await tx.legalEntity.update({
          where: { id: legalEntity.id, accountId: input.accountId },
          data: { clientId: client.id },
          include: { importerOfRecord: { select: { id: true, name: true } } },
        });
      }
    } else {
      const legal = input.legalEntity!;
      legalEntity = await tx.legalEntity.create({
        data: {
          accountId: input.accountId,
          clientId: client.id,
          legalName: legal.legalName.trim(),
          tradeName: legal.tradeName?.trim() || null,
          entityType: legal.entityType,
          country: legal.country,
          addressLine1: legal.addressLine1.trim(),
          addressLine2: legal.addressLine2?.trim() || null,
          city: legal.city.trim(),
          stateProvince: legal.stateProvince?.trim() || null,
          postalCode: legal.postalCode.trim(),
          taxIdentifier: normalizedIdentifier(legal.importerNumber, legal.importerNumberType) || null,
          taxIdentifierType: legal.importerNumberType,
        },
        include: { importerOfRecord: { select: { id: true, name: true } } },
      });
    }

    const supplied = input.legalEntity;
    const importerNumberType = (supplied?.importerNumberType ?? legalEntity.taxIdentifierType ?? "EIN") as ImporterLegalEntityInput["importerNumberType"];
    const identifier = normalizedIdentifier(supplied?.importerNumber ?? legalEntity.taxIdentifier, importerNumberType);
    if (identifier) {
      const existing = await tx.importerOfRecord.findFirst({
        where: {
          accountId: input.accountId,
          OR: [{ irsEin: identifier }, { irsEin: supplied?.importerNumber?.trim() ?? identifier }],
        },
        select: { id: true, name: true, clientId: true },
      });
      if (existing) {
        throw new ImporterCreateError("CONFLICT", "An importer with this tax identifier already exists.", {
          existingImporter: existing,
        });
      }
    }

    const importer = await tx.importerOfRecord.create({
      data: {
        accountId: input.accountId,
        clientId: client.id,
        legalEntityId: legalEntity.id,
        name: legalEntity.legalName,
        irsEin: identifier,
        cbpImporterNumber: supplied?.cbpImporterNumber?.trim()
          || (importerNumberType === "CBP_ASSIGNED" ? null : identifier || null),
        registrationStatus: "pending_5106",
        address: {
          line1: legalEntity.addressLine1 ?? "",
          line2: legalEntity.addressLine2 ?? "",
          city: legalEntity.city ?? "",
          state: legalEntity.stateProvince ?? "",
          postalCode: legalEntity.postalCode ?? "",
          country: legalEntity.country,
        },
      },
    });

    const onboardingCase = await tx.onboardingCase.create({
      data: {
        accountId: input.accountId,
        clientId: client.id,
        primaryImporterId: importer.id,
        path: input.path,
        status: "in_progress",
        currentStep: 2,
        stepStatus: { step_1: "done" },
        blockers: [],
        source: "UI",
        assignedUserId: input.userId,
      },
    });

    const entity = await tx.onboardingEntity.create({
      data: {
        accountId: input.accountId,
        caseId: onboardingCase.id,
        legalEntityId: legalEntity.id,
        importerOfRecordId: importer.id,
        importerNumberType,
        importerNumber: identifier || null,
        officers: [],
      },
    });

    await Promise.all([
      tx.onboardingEvent.create({
        data: {
          accountId: input.accountId,
          caseId: onboardingCase.id,
          type: "STEP_COMPLETED",
          step: 1,
          actorUserId: input.userId,
          actorType: "USER",
          detail: { entityId: entity.id, importerId: importer.id, legalName: importer.name },
        },
      }),
      tx.auditLog.create({
        data: {
          accountId: input.accountId,
          userId: input.userId,
          action: "importer.created",
          entity: "ImporterOfRecord",
          entityId: importer.id,
          source: "UI",
          requestId: input.requestId,
          metadata: { clientId: client.id, legalEntityId: legalEntity.id, onboardingCaseId: onboardingCase.id, path: input.path },
        },
      }),
    ]);

    return { importer, client, legalEntity, onboardingCase };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
}
