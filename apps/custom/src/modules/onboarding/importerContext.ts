import { db } from "@/lib/db";

export interface ImporterContext {
  importerOfRecordId: string | null;
  importerName: string | null;
  bondId: string | null;
  needsImporterSelection: boolean;
}

export async function resolveImporterContext(
  accountId: string,
  clientId: string | null | undefined
): Promise<ImporterContext> {
  if (!clientId) return { importerOfRecordId: null, importerName: null, bondId: null, needsImporterSelection: false };

  const onboardingCase = await db.onboardingCase.findFirst({
    where: { accountId, clientId, status: { in: ["active", "ready_to_activate"] } },
    orderBy: { activatedAt: "desc" },
    select: {
      id: true,
      primaryImporterId: true,
      primaryImporter: {
        select: {
          id: true,
          cbpImporterNumber: true,
          onboardingEntities: {
            where: { caseId: undefined },
            select: {
              id: true,
              importerOfRecordId: true,
              bondId: true,
              importerOfRecord: { select: { id: true, cbpImporterNumber: true } },
              bond: { select: { id: true } },
            },
          },
        },
      },
      entities: {
        select: {
          id: true,
          importerOfRecordId: true,
          bondId: true,
          importerOfRecord: { select: { id: true, cbpImporterNumber: true } },
        },
      },
    },
  });

  if (!onboardingCase) {
    const client = await db.client.findFirst({
      where: { id: clientId, accountId },
      select: { name: true },
    });
    return {
      importerOfRecordId: null,
      importerName: client?.name ?? null,
      bondId: null,
      needsImporterSelection: false,
    };
  }

  const entities = onboardingCase.entities;

  if (entities.length === 0) {
    const client = await db.client.findFirst({
      where: { id: clientId, accountId },
      select: { name: true },
    });
    return {
      importerOfRecordId: onboardingCase.primaryImporterId ?? null,
      importerName: client?.name ?? null,
      bondId: null,
      needsImporterSelection: false,
    };
  }

  if (entities.length > 1) {
    const primary = entities.find((e) => e.importerOfRecordId === onboardingCase.primaryImporterId) ?? entities[0];
    const legalEntity = primary.importerOfRecordId
        ? await db.importerOfRecord.findUnique({
          where: { id: primary.importerOfRecordId },
          select: { name: true },
        })
      : null;
    return {
      importerOfRecordId: primary.importerOfRecordId ?? null,
      importerName: legalEntity?.name ?? null,
      bondId: primary.bondId ?? null,
      needsImporterSelection: true,
    };
  }

  const entity = entities[0];
  const legalEntity = entity.importerOfRecordId
    ? await db.importerOfRecord.findUnique({
        where: { id: entity.importerOfRecordId },
        select: { name: true },
      })
    : null;

  return {
    importerOfRecordId: entity.importerOfRecordId ?? null,
    importerName: legalEntity?.name ?? null,
    bondId: entity.bondId ?? null,
    needsImporterSelection: false,
  };
}
